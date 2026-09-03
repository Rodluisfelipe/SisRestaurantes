import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Popup, Marker, useMap, FeatureGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import { MAP_TILE_URL, MAP_ATTRIBUTION } from '../utils/mapTiles';
import api from '../services/api';
import { useAuth } from '../Context/AuthContext';
import { AlertTriangle, MapPin, X, RotateCw, Check, Store, CheckCircle2, XCircle, Map, Circle as CircleIcon, FileText } from 'lucide-react';

// Fix para los iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Icono personalizado para la tienda/restaurante
const storeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Componente para centrar el mapa en Colombia por defecto
// Componente para centrar el mapa dinámicamente
function MapInitializer({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && (Array.isArray(center) ? center[0] && center[1] : true)) {
      console.log('🎯 Centrando mapa en:', center);
      map.setView(center, 13);
    }
  }, [center, map]);
  
  return null;
}

// Componente personalizado para controles de dibujo
function DrawControl({ onCreated, onEdited, color }) {
  const map = useMap();
  const featureGroupRef = useRef(new L.FeatureGroup());
  
  useEffect(() => {
    const featureGroup = featureGroupRef.current;
    map.addLayer(featureGroup);
    
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: false,
        marker: false,
        circlemarker: false,
        rectangle: false,
        polygon: {
          shapeOptions: {
            color: color || '#3B82F6'
          }
        },
        circle: {
          shapeOptions: {
            color: color || '#3B82F6'
          }
        }
      },
      edit: {
        featureGroup: featureGroup,
        remove: true
      }
    });
    
    map.addControl(drawControl);
    
    const handleCreated = (e) => {
      const { layer, layerType } = e;
      featureGroup.addLayer(layer);
      if (onCreated) {
        onCreated({ layer, layerType });
      }
    };
    
    const handleEdited = (e) => {
      if (onEdited) {
        onEdited(e);
      }
    };
    
    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    
    return () => {
      map.removeControl(drawControl);
      map.removeLayer(featureGroup);
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
    };
  }, [map, onCreated, onEdited, color]);
  
  return null;
}

const DeliveryZoneManager = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [mapCenter, setMapCenter] = useState([4.7110, -74.0721]); // Bogotá por defecto
  const [businessLocation, setBusinessLocation] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempLocation, setTempLocation] = useState(null); // Ubicación temporal antes de guardar
  const locationCheckedRef = useRef(false); // Para evitar múltiples aperturas del modal
  
  // Formulario de zona
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'polygon',
    geometry: null,
    pricing: {
      mode: 'fixed',
      basePrice: 0,
      pricePerKm: 0,
      freeDistanceKm: 0,
      minimumOrder: 0,
      tiers: []
    },
    estimatedTime: {
      min: 30,
      max: 45
    },
    priority: 1,
    color: '#3B82F6',
    isActive: true,
    schedule: {
      enabled: false,
      days: []
    }
  });

  // Cargar configuración del negocio y ubicación
  const loadBusinessLocation = async () => {
    // Prevenir múltiples llamadas
    if (locationCheckedRef.current) return;
    locationCheckedRef.current = true;

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const businessId = user.businessId;
      
      if (!businessId) return;
      
      // Cargar configuración del negocio
      const response = await api.get(`/business-config?businessId=${businessId}`);
      const business = response.data;
      
      // Si el negocio tiene coordenadas configuradas, usarlas
      if (business.location?.coordinates?.lat && business.location?.coordinates.lng) {
        const lat = business.location.coordinates.lat;
        const lng = business.location.coordinates.lng;
        setMapCenter([lat, lng]);
        setBusinessLocation({ lat, lng });
        console.log('✅ Ubicación del negocio cargada:', { lat, lng });
      } else {
        // Si no tiene ubicación guardada, mostrar modal inmediatamente
        console.log('⚠️ No hay ubicación guardada, mostrando modal...');
        setTimeout(() => setShowLocationModal(true), 100);
      }
    } catch (error) {
      console.error('❌ Error al cargar ubicación del negocio:', error);
    }
  };

  // Cargar zonas al montar el componente
  useEffect(() => {
    // Solo cargar si está autenticado y no está cargando la auth
    if (isAuthenticated && !authLoading) {
      loadZones();
      loadBusinessLocation();
    } else if (!authLoading) {
      // Si no está autenticado y terminó de cargar auth, detener loading
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  const loadZones = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Iniciando carga de zonas...');
      
      // Obtener businessId del usuario almacenado (necesario para SuperAdmin)
      const userStr = localStorage.getItem('user');
      console.log('👤 Usuario en localStorage:', userStr ? 'existe' : 'NO existe');
      
      let businessId = null;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          businessId = user.businessId;
          console.log('🏢 BusinessId:', businessId);
        } catch (e) {
          console.error('❌ Error parseando user:', e);
        }
      }
      
      // Construir URL con businessId si existe
      const url = businessId ? `/delivery-zones?businessId=${businessId}` : '/delivery-zones';
      console.log('🌐 URL a consultar:', url);
      
      const response = await api.get(url);
      console.log('✅ Respuesta recibida:', response.data);
      
      const loadedZones = response.data.zones || [];
      console.log('📋 Zonas cargadas:', loadedZones.length);
      
      // Debug: mostrar estructura de la primera zona
      if (loadedZones.length > 0) {
        console.log('🔍 Estructura de primera zona:', loadedZones[0]);
        console.log('🗺️ Geometry de primera zona:', loadedZones[0].geometry);
      }
      
      setZones(loadedZones);
    } catch (error) {
      console.error('Error al cargar zonas:', error);
      
      // Si es error 401, mostrar mensaje específico
      if (error.response?.status === 401) {
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.message;
        
        if (errorCode === 'OUTDATED_TOKEN') {
          // Token desactualizado, forzar logout
          console.warn('Token desactualizado detectado. Redirigiendo a login...');
          alert('Tu sesión ha expirado. Por favor, cierra sesión y vuelve a iniciar sesión.');
          // Opcional: limpiar tokens y redirigir
          // localStorage.clear();
          // window.location.href = '/login';
        } else {
          console.warn('No autorizado:', errorMessage || 'Es posible que necesites iniciar sesión nuevamente.');
        }
        setZones([]);
      } else {
        alert('Error al cargar las zonas de entrega: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZone = async () => {
    try {
      if (!formData.name.trim()) {
        alert('El nombre de la zona es requerido');
        return;
      }

      // Si estamos editando y NO se dibujó una nueva zona, usar la geometría existente
      const geometryToUse = formData.geometry || (selectedZone ? selectedZone.geometry : null);
      
      if (!geometryToUse) {
        alert('Debes dibujar un área en el mapa');
        return;
      }

      // Obtener businessId del usuario actual
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        alert('No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.');
        return;
      }
      
      const user = JSON.parse(userStr);
      const businessId = user.businessId;
      
      if (!businessId) {
        alert('No se pudo determinar el negocio. Por favor, inicia sesión nuevamente.');
        return;
      }

      // Agregar businessId a los datos
      const dataToSend = {
        ...formData,
        geometry: geometryToUse, // Usar la geometría determinada (nueva o existente)
        businessId
      };

      if (selectedZone) {
        // Actualizar zona existente
        await api.put(`/delivery-zones/${selectedZone.id}`, dataToSend, {
          params: { businessId }
        });
        alert('Zona actualizada exitosamente');
      } else {
        // Crear nueva zona
        await api.post('/delivery-zones', dataToSend, {
          params: { businessId }
        });
        alert('Zona creada exitosamente');
      }

      setShowModal(false);
      resetForm();
      loadZones();
    } catch (error) {
      console.error('Error al guardar zona:', error);
      // El backend manda el motivo puntual (ej: nombre muy largo) en `errors`,
      // no en `message` (que es genérico: "Datos de zona inválidos").
      const detalle = Array.isArray(error.response?.data?.errors) && error.response.data.errors.length
        ? error.response.data.errors.join('\n')
        : error.response?.data?.message;
      alert(detalle || 'Error al guardar la zona');
    }
  };

  const handleDeleteZone = async (zoneId) => {
    if (!confirm('¿Estás seguro de eliminar esta zona?')) return;

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};
      const businessId = user?.businessId;
      await api.delete(`/delivery-zones/${zoneId}`, {
        params: { businessId }
      });
      alert('Zona eliminada exitosamente');
      loadZones();
    } catch (error) {
      console.error('Error al eliminar zona:', error);
      alert('Error al eliminar la zona');
    }
  };

  const handleToggleZone = async (zoneId) => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};
      const businessId = user?.businessId;
      await api.patch(`/delivery-zones/${zoneId}/toggle`, null, {
        params: { businessId }
      });
      loadZones();
    } catch (error) {
      console.error('Error al cambiar estado de zona:', error);
      alert('Error al cambiar el estado de la zona');
    }
  };

  const handleDuplicateZone = async (zoneId) => {
    try {
      await api.post(`/delivery-zones/${zoneId}/duplicate`);
      alert('Zona duplicada exitosamente');
      loadZones();
    } catch (error) {
      console.error('Error al duplicar zona:', error);
      alert('Error al duplicar la zona');
    }
  };

  const openEditModal = (zone) => {
    setSelectedZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || '',
      type: zone.type,
      geometry: zone.geometry, // ✅ CARGAR la geometría existente para mostrarla en el mapa
      pricing: zone.pricing,
      estimatedTime: zone.estimatedTime,
      priority: zone.priority,
      color: zone.color,
      isActive: zone.isActive,
      schedule: zone.schedule || { enabled: false, days: [] }
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setSelectedZone(null);
    setFormData({
      name: '',
      description: '',
      type: 'polygon',
      geometry: null,
      pricing: {
        mode: 'fixed',
        basePrice: 0,
        pricePerKm: 0,
        freeDistanceKm: 0,
        minimumOrder: 0,
        tiers: []
      },
      estimatedTime: {
        min: 30,
        max: 45
      },
      priority: 1,
      color: '#3B82F6',
      isActive: true,
      schedule: {
        enabled: false,
        days: []
      }
    });
  };

  const handleCreated = useCallback((e) => {
    const { layerType, layer } = e;
    
    let geometry;
    
    if (layerType === 'polygon') {
      const coordinates = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
      // Cerrar el polígono (primer punto = último punto)
      coordinates.push(coordinates[0]);
      
      geometry = {
        type: 'Polygon',
        coordinates: [coordinates]
      };
      
      setFormData(prev => ({
        ...prev,
        type: 'polygon',
        geometry
      }));
    } else if (layerType === 'circle') {
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      
      geometry = {
        type: 'Point',
        coordinates: [center.lng, center.lat],
        radius: radius
      };
      
      setFormData(prev => ({
        ...prev,
        type: 'radius',
        geometry
      }));
    }
    
    console.log('Zona dibujada:', geometry);
  }, []);

  const handleEdited = useCallback((e) => {
    const layers = e.layers;
    layers.eachLayer((layer) => {
      let geometry;
      
      if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        
        geometry = {
          type: 'Point',
          coordinates: [center.lng, center.lat],
          radius: radius
        };
        
        setFormData(prev => ({
          ...prev,
          type: 'radius',
          geometry
        }));
      } else if (layer instanceof L.Polygon) {
        const coordinates = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
        coordinates.push(coordinates[0]);
        
        geometry = {
          type: 'Polygon',
          coordinates: [coordinates]
        };
        
        setFormData(prev => ({
          ...prev,
          type: 'polygon',
          geometry
        }));
      }
    });
  }, []);

  // Mostrar loading mientras se verifica autenticación o se cargan datos
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-lg text-gray-600">
            {authLoading ? 'Verificando autenticación...' : 'Cargando zonas de entrega...'}
          </div>
        </div>
      </div>
    );
  }
  
  // Verificar si el usuario está autenticado
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center mb-3">
            <AlertTriangle className="w-6 h-6 mr-2 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-800">Sesión Expirada</h3>
          </div>
          <p className="text-yellow-700 mb-4">
            Tu sesión ha expirado. Por favor, inicia sesión nuevamente para gestionar las zonas de entrega.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
          >
            Recargar Página
          </button>
        </div>
      </div>
    );
  }

  // Modal para configurar ubicación del negocio
  const LocationSetupModal = () => {
    const [gettingLocation, setGettingLocation] = useState(false);

    const handleUseCurrentLocation = () => {
      if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
      }

      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          try {
            // Obtener el nombre de la dirección usando geocodificación inversa
            const response = await api.get(`/delivery-zones/reverse-geocode?lat=${lat}&lon=${lng}`);
            
            const address = response.data.success && response.data.result 
              ? (response.data.result.displayName || response.data.result.display_name)
              : `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

            setTempLocation({
              lat,
              lng,
              address
            });
            
            setMapCenter([lat, lng]);
            console.log('Ubicación actual detectada:', { lat, lng, address });
          } catch (error) {
            console.error('Error al obtener dirección:', error);
            // Aún así usar las coordenadas aunque no se pueda obtener la dirección
            setTempLocation({
              lat,
              lng,
              address: `Ubicación actual: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            });
            setMapCenter([lat, lng]);
          } finally {
            setGettingLocation(false);
          }
        },
        (error) => {
          console.error('Error al obtener ubicación:', error);
          setGettingLocation(false);
          
          let errorMessage = 'No se pudo obtener tu ubicación. ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Permiso denegado. Por favor, permite el acceso a tu ubicación en el navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Ubicación no disponible.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Tiempo de espera agotado.';
              break;
            default:
              errorMessage += 'Error desconocido.';
          }
          
          alert(errorMessage + '\n\nPuedes buscar tu dirección manualmente en el campo de abajo.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    };

    const handleSaveLocation = async () => {
      if (!tempLocation) {
        alert('Por favor, selecciona una ubicación');
        return;
      }

      try {
        const userStr = localStorage.getItem('user');
        const user = JSON.parse(userStr);
        const businessId = user.businessId;

        await api.put(`/business-config/${businessId}`, {
          location: {
            coordinates: {
              lat: tempLocation.lat,
              lng: tempLocation.lng
            },
            address: tempLocation.address
          }
        });

        setBusinessLocation({ lat: tempLocation.lat, lng: tempLocation.lng });
        setTempLocation(null); // Limpiar ubicación temporal
        setShowLocationModal(false);
        alert('Ubicación del negocio guardada exitosamente');
      } catch (error) {
        console.error('Error al guardar ubicación:', error);
        alert('Error al guardar la ubicación del negocio');
      }
    };

    if (!showLocationModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-t-2xl lg:rounded-lg p-6 max-w-2xl w-full mx-0 lg:mx-4 max-h-[92vh] lg:max-h-[90vh] overflow-y-auto relative z-[10000]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg lg:text-xl font-bold inline-flex items-center gap-2"><MapPin className="w-5 h-5" /> Configurar Ubicación</h3>
            <button
              onClick={() => setShowLocationModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-gray-600 mb-4">
              Para poder crear zonas de entrega, necesitamos saber dónde está ubicada tu tienda.
            </p>

            {/* Usar ubicación actual */}
            <div className="mb-6">
              <button
                onClick={handleUseCurrentLocation}
                disabled={gettingLocation}
                className="w-full bg-red-500 lg:bg-blue-600 text-white px-6 py-3 rounded-xl lg:rounded-lg hover:opacity-90 active:scale-[0.97] lg:active:scale-100 disabled:bg-gray-400 flex items-center justify-center gap-2 font-medium"
              >
                {gettingLocation ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Obteniendo ubicación...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" /> Usar Mi Ubicación Actual
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                El navegador te pedirá permiso para acceder a tu ubicación GPS
              </p>
            </div>

            {tempLocation && (
              <div className="mt-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <p className="text-sm font-medium text-green-800 mb-2 inline-flex items-center gap-1"><Check className="w-4 h-4" /> Ubicación seleccionada:</p>
                  <p className="text-sm text-green-700">{tempLocation.address}</p>
                  <p className="text-xs text-green-600 mt-1">
                    Lat: {tempLocation.lat.toFixed(6)}, Lng: {tempLocation.lng.toFixed(6)}
                  </p>
                </div>

                {/* Mapa de vista previa */}
                <div className="border rounded-lg overflow-hidden" style={{ height: '300px', width: '100%' }}>
                  <MapContainer 
                    center={[tempLocation.lat, tempLocation.lng]} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%' }}
                    key={`${tempLocation.lat}-${tempLocation.lng}`}
                  >
                    <TileLayer
                      url={MAP_TILE_URL}
                      attribution={MAP_ATTRIBUTION}
                    />
                    <Marker 
                      position={[tempLocation.lat, tempLocation.lng]} 
                      icon={storeIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong className="text-red-600 inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Tu Tienda</strong>
                          <br />
                          <span className="text-xs text-gray-600">{tempLocation.address}</span>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={() => setShowLocationModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveLocation}
              disabled={!tempLocation}
              className="px-4 py-2.5 lg:py-2 bg-red-500 lg:bg-blue-600 text-white rounded-xl lg:rounded-lg hover:opacity-90 text-[13px] lg:text-sm font-semibold active:scale-[0.97] lg:active:scale-100 disabled:bg-gray-400"
            >
              Guardar Ubicación
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <LocationSetupModal />
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">Zonas de Entrega</h1>
            {businessLocation && (
              <p className="text-sm text-gray-600 mt-1 inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Ubicación de la tienda: Lat {businessLocation.lat.toFixed(4)}, Lng {businessLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLocationModal(true)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              title="Configurar ubicación de la tienda"
            >
              <MapPin className="w-4 h-4" /> Ubicación
            </button>
            <button
              onClick={openCreateModal}
              className="bg-red-500 lg:bg-blue-600 text-white px-4 py-2.5 lg:py-2 rounded-xl lg:rounded-lg hover:opacity-90 text-[13px] lg:text-sm font-semibold active:scale-[0.97] lg:active:scale-100"
            >
              + Nueva Zona
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl lg:rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow p-3 lg:p-4 mb-4">
          <p className="text-gray-600">
            Gestiona las zonas de entrega de tu negocio. Define áreas, precios y tiempos estimados para cada zona.
          </p>
        </div>
      </div>

      {/* Mapa con todas las zonas */}
      <div className="bg-white rounded-2xl lg:rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow p-3 lg:p-4 mb-6 relative z-0">
        <h2 className="text-xl font-semibold mb-4">Mapa de Cobertura</h2>
        <div className="relative z-0" style={{ height: '500px', width: '100%' }}>
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url={MAP_TILE_URL}
              attribution={MAP_ATTRIBUTION}
            />
            
            {/* Actualizar centro del mapa cuando cambia la ubicación de la tienda */}
            {businessLocation && (
              <MapInitializer center={[businessLocation.lat, businessLocation.lng]} />
            )}
            
            {/* Marcador de la ubicación de la tienda */}
            {businessLocation && (
              <Marker 
                position={[businessLocation.lat, businessLocation.lng]} 
                icon={storeIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <strong className="text-red-600 inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Mi Tienda</strong>
                    <br />
                    <span className="text-gray-600">
                      Esta es la ubicación de tu negocio
                    </span>
                    <br />
                    <span className="text-xs text-gray-500">
                      Lat: {businessLocation.lat.toFixed(6)}
                      <br />
                      Lng: {businessLocation.lng.toFixed(6)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            )}
            
            {(() => {
              console.log('🗺️ Renderizando zonas en mapa. Total zones:', zones.length);
              return zones.map((zone, index) => {
                console.log(`🔍 Zona ${index}:`, {
                  id: zone.id,
                  name: zone.name,
                  type: zone.type,
                  hasGeometry: !!zone.geometry,
                  geometryCoords: zone.geometry?.coordinates,
                  color: zone.color
                });

                if (zone.type === 'polygon' && zone.geometry?.coordinates) {
                  const positions = zone.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                  console.log(`✅ Renderizando POLYGON para "${zone.name}":`, positions);
                  return (
                    <Polygon
                      key={zone.id}
                      positions={positions}
                      pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.3 }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{zone.name}</strong>
                          <br />
                          Estado: {zone.isActive ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 inline" /> Activa</span> : <span className="inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5 inline" /> Inactiva</span>}
                          <br />
                          Precio base: ${zone.pricing.basePrice}
                          <br />
                          Tiempo: {zone.estimatedTime.min}-{zone.estimatedTime.max} min
                        </div>
                      </Popup>
                    </Polygon>
                  );
                } else if (zone.type === 'radius' && zone.geometry?.coordinates) {
                  const center = [zone.geometry.coordinates[1], zone.geometry.coordinates[0]];
                  console.log(`✅ Renderizando CIRCLE para "${zone.name}":`, center, 'radio:', zone.geometry.radius);
                  return (
                    <Circle
                      key={zone.id}
                      center={center}
                      radius={zone.geometry.radius}
                      pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.3 }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{zone.name}</strong>
                          <br />
                          Estado: {zone.isActive ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 inline" /> Activa</span> : <span className="inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5 inline" /> Inactiva</span>}
                          <br />
                          Radio: {Math.round(zone.geometry.radius)}m
                          <br />
                          Precio base: ${zone.pricing.basePrice}
                        </div>
                      </Popup>
                    </Circle>
                  );
                } else {
                  console.log(`❌ Zona "${zone.name}" NO se puede renderizar. Type:`, zone.type, 'Has geometry:', !!zone.geometry);
                  return null;
                }
              });
            })()}
          </MapContainer>
        </div>
      </div>

      {/* Lista de zonas */}
      <div className="bg-white rounded-2xl lg:rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Lista de Zonas ({zones.length})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiempo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedidos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {zones.map((zone) => (
                <tr key={zone.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className="w-4 h-4 rounded mr-2"
                        style={{ backgroundColor: zone.color }}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{zone.name}</div>
                        {zone.description && (
                          <div className="text-sm text-gray-500">{zone.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 inline-flex items-center gap-1">
                    {zone.type === 'polygon' ? <><Map className="w-3.5 h-3.5" /> Polígono</> : <><CircleIcon className="w-3.5 h-3.5" /> Radio</>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${zone.pricing.basePrice}
                    {zone.pricing.mode === 'distance' && ` + $${zone.pricing.pricePerKm}/km`}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {zone.estimatedTime.min}-{zone.estimatedTime.max} min
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {zone.priority}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleZone(zone.id)}
                      className={`px-2 py-1 text-xs rounded ${
                        zone.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {zone.isActive ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {zone.stats?.totalOrders || 0}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => openEditModal(zone)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDuplicateZone(zone.id)}
                      className="text-green-600 hover:text-green-900 mr-3"
                    >
                      Duplicar
                    </button>
                    <button
                      onClick={() => handleDeleteZone(zone.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {zones.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay zonas de entrega configuradas. Crea tu primera zona.
            </div>
          )}
        </div>
      </div>

      {/* Modal de creación/edición */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-t-2xl lg:rounded-lg max-w-4xl w-full max-h-[92vh] lg:max-h-[90vh] overflow-y-auto relative z-[10000]">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">
                {selectedZone ? 'Editar Zona' : 'Nueva Zona'}
              </h2>
            </div>
            
            <div className="p-6">
              {/* Información básica */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Información Básica</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: Zona Centro"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Color</label>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-full border rounded px-3 py-2 h-10"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Descripción</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full border rounded px-3 py-2"
                      rows="2"
                      placeholder="Descripción opcional de la zona"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Prioridad</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className="w-full border rounded px-3 py-2"
                      min="1"
                      max="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Mayor número = mayor prioridad</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Estado</label>
                    <select
                      value={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="true">Activa</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Mapa para dibujar */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Dibujar Área en el Mapa</h3>
                {selectedZone && formData.geometry ? (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-800 font-medium inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Zona existente cargada en el mapa
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Puedes ver la zona actual marcada en <span className="font-semibold" style={{ color: formData.color }}>color {formData.color}</span>. 
                          Si quieres cambiar el área, usa las herramientas de dibujo para crear una nueva. Si solo cambias nombre/precio, la zona se mantendrá igual.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 mb-2">
                    Usa las herramientas de dibujo para crear un polígono o círculo que represente tu zona de entrega.
                  </p>
                )}
                <div style={{ height: '400px', width: '100%' }}>
                  <MapContainer
                    center={businessLocation ? [businessLocation.lat, businessLocation.lng] : mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url={MAP_TILE_URL}
                      attribution={MAP_ATTRIBUTION}
                    />
                    <MapInitializer center={businessLocation ? [businessLocation.lat, businessLocation.lng] : mapCenter} />
                    
                    {/* Marcador de la tienda en el modal */}
                    {businessLocation && (
                      <Marker 
                        position={[businessLocation.lat, businessLocation.lng]} 
                        icon={storeIcon}
                      >
                        <Popup>
                          <div className="text-sm">
                            <strong className="text-red-600 inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Mi Tienda</strong>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    
                    <DrawControl
                      onCreated={handleCreated}
                      onEdited={handleEdited}
                      color={formData.color}
                    />
                    
                    {/* Mostrar la zona que se está editando (si existe) */}
                    {selectedZone && formData.geometry && (
                      <>
                        {formData.type === 'polygon' && formData.geometry?.coordinates ? (
                          <Polygon
                            positions={formData.geometry.coordinates[0].map(coord => [coord[1], coord[0]])}
                            pathOptions={{ 
                              color: formData.color, 
                              fillColor: formData.color, 
                              fillOpacity: 0.35,
                              weight: 3
                            }}
                          >
                            <Popup>
                              <div className="text-sm">
                                <strong className="text-blue-600 inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {formData.name}</strong>
                                <p className="text-xs text-gray-600 mt-1">Zona en edición</p>
                              </div>
                            </Popup>
                          </Polygon>
                        ) : formData.type === 'radius' && formData.geometry?.coordinates ? (
                          <Circle
                            center={[formData.geometry.coordinates[1], formData.geometry.coordinates[0]]}
                            radius={formData.geometry.radius}
                            pathOptions={{ 
                              color: formData.color, 
                              fillColor: formData.color, 
                              fillOpacity: 0.35,
                              weight: 3
                            }}
                          >
                            <Popup>
                              <div className="text-sm">
                                <strong className="text-blue-600 inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {formData.name}</strong>
                                <p className="text-xs text-gray-600 mt-1">Zona en edición</p>
                                <p className="text-xs text-gray-600">Radio: {formData.geometry.radius}m</p>
                              </div>
                            </Popup>
                          </Circle>
                        ) : null}
                      </>
                    )}
                    
                    {/* Mostrar zonas existentes en el fondo (solo las otras zonas) */}
                    {zones.filter(z => !selectedZone || z.id !== selectedZone.id).map((zone) => {
                      if (zone.type === 'polygon' && zone.geometry?.coordinates) {
                        const positions = zone.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                        return (
                          <Polygon
                            key={zone.id}
                            positions={positions}
                            pathOptions={{ 
                              color: zone.color, 
                              fillColor: zone.color, 
                              fillOpacity: 0.15,
                              weight: 1,
                              dashArray: '5, 5'
                            }}
                          >
                            <Popup>
                              <div className="text-sm">
                                <strong>{zone.name}</strong> (Existente)
                              </div>
                            </Popup>
                          </Polygon>
                        );
                      } else if (zone.type === 'radius' && zone.geometry?.coordinates) {
                        const center = [zone.geometry.coordinates[1], zone.geometry.coordinates[0]];
                        return (
                          <Circle
                            key={zone.id}
                            center={center}
                            radius={zone.geometry.radius}
                            pathOptions={{ 
                              color: zone.color, 
                              fillColor: zone.color, 
                              fillOpacity: 0.15,
                              weight: 1,
                              dashArray: '5, 5'
                            }}
                          >
                            <Popup>
                              <div className="text-sm">
                                <strong>{zone.name}</strong> (Existente)
                              </div>
                            </Popup>
                          </Circle>
                        );
                      }
                      return null;
                    })}
                  </MapContainer>
                </div>
              </div>

              {/* Configuración de precios */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Configuración de Precios</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Modo de Precio</label>
                    <select
                      value={formData.pricing.mode}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        pricing: { ...prev.pricing, mode: e.target.value }
                      }))}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="fixed">Tarifa Fija</option>
                      <option value="distance">Por Distancia</option>
                      <option value="tiered">Por Tramos</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Precio Base ($)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={formData.pricing.basePrice}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        pricing: { ...prev.pricing, basePrice: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full border rounded px-3 py-2"
                      min="0"
                      step="100"
                    />
                  </div>
                  
                  {formData.pricing.mode === 'distance' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">Precio por KM ($)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={formData.pricing.pricePerKm}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            pricing: { ...prev.pricing, pricePerKm: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border rounded px-3 py-2"
                          min="0"
                          step="100"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Distancia Gratis (KM)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={formData.pricing.freeDistanceKm}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            pricing: { ...prev.pricing, freeDistanceKm: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border rounded px-3 py-2"
                          min="0"
                          step="0.5"
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Pedido Mínimo ($)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={formData.pricing.minimumOrder}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        pricing: { ...prev.pricing, minimumOrder: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full border rounded px-3 py-2"
                      min="0"
                      step="1000"
                    />
                  </div>
                </div>
              </div>

              {/* Tiempo estimado */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Tiempo Estimado de Entrega</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Mínimo (minutos)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={formData.estimatedTime.min}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        estimatedTime: { ...prev.estimatedTime, min: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full border rounded px-3 py-2"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Máximo (minutos)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={formData.estimatedTime.max}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        estimatedTime: { ...prev.estimatedTime, max: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full border rounded px-3 py-2"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveZone}
                className="px-4 py-2.5 lg:py-2 bg-red-500 lg:bg-blue-600 text-white rounded-xl lg:rounded hover:opacity-90 text-[13px] lg:text-sm font-semibold active:scale-[0.97] lg:active:scale-100"
              >
                {selectedZone ? 'Actualizar' : 'Crear'} Zona
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryZoneManager;

