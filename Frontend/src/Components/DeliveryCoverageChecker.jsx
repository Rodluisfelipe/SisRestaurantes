import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';

// Fix para los iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DeliveryCoverageChecker = ({ businessId, orderTotal, onCoverageResult }) => {
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [coverageResult, setCoverageResult] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [zones, setZones] = useState([]);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  // Obtener zonas activas para mostrar en el mapa
  useEffect(() => {
    if (showMap && businessId) {
      loadActiveZones();
    }
  }, [showMap, businessId]);

  const loadActiveZones = async () => {
    try {
      const response = await api.get(`/delivery-zones?businessId=${businessId}`);
      setZones(response.data.zones?.filter(z => z.isActive) || []);
    } catch (error) {
      console.error('Error al cargar zonas:', error);
    }
  };

  const handleSearchAddress = async () => {
    if (!address.trim()) {
      alert('Por favor ingresa una dirección');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/delivery-zones/geocode', {
        address,
        country: 'CO'
      });

      if (response.data.results && response.data.results.length > 0) {
        setSearchResults(response.data.results);
        if (response.data.results.length === 1) {
          // Si solo hay un resultado, seleccionarlo automáticamente
          handleSelectLocation(response.data.results[0]);
        }
      } else {
        alert('No se encontraron resultados para esta dirección');
      }
    } catch (error) {
      console.error('Error al buscar dirección:', error);
      alert('Error al buscar la dirección. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = async (location) => {
    setSelectedLocation(location);
    setSearchResults([]);
    setShowMap(true);
    await checkCoverage(location.lat, location.lon);
  };

  const checkCoverage = async (lat, lon) => {
    if (!businessId) {
      console.error('businessId no proporcionado');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/delivery-zones/check-coverage', {
        businessId,
        lat,
        lon,
        orderTotal
      });

      const result = response.data;
      setCoverageResult(result);

      // Notificar al componente padre sobre el resultado
      if (onCoverageResult) {
        onCoverageResult(result);
      }
    } catch (error) {
      console.error('Error al verificar cobertura:', error);
      alert('Error al verificar la cobertura de entrega');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }

    setUseCurrentLocation(true);
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Obtener dirección aproximada con geocodificación inversa
        try {
          const response = await api.post('/delivery-zones/reverse-geocode', {
            lat: latitude,
            lon: longitude
          });

          const location = {
            lat: latitude,
            lon: longitude,
            displayName: response.data.result?.displayName || 'Tu ubicación actual',
            address: response.data.result?.address || {}
          };

          setSelectedLocation(location);
          setShowMap(true);
          await checkCoverage(latitude, longitude);
        } catch (error) {
          console.error('Error al obtener dirección:', error);
          // Aún así usar la ubicación
          const location = {
            lat: latitude,
            lon: longitude,
            displayName: 'Tu ubicación actual',
            address: {}
          };
          setSelectedLocation(location);
          setShowMap(true);
          await checkCoverage(latitude, longitude);
        } finally {
          setLoading(false);
          setUseCurrentLocation(false);
        }
      },
      (error) => {
        console.error('Error al obtener ubicación:', error);
        alert('No se pudo obtener tu ubicación. Por favor, verifica los permisos.');
        setLoading(false);
        setUseCurrentLocation(false);
      }
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Verificar Cobertura de Entrega</h2>

      {/* Búsqueda de dirección */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Ingresa tu dirección
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchAddress()}
            aria-label="Dirección de entrega"
            placeholder="Ej: Calle 100 #10-20, Bogotá"
            className="flex-1 border rounded px-4 py-2"
            disabled={loading}
          />
          <button
            onClick={handleSearchAddress}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Botón de ubicación actual */}
        <button
          onClick={handleUseCurrentLocation}
          disabled={loading || useCurrentLocation}
          className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
        >
          📍 {useCurrentLocation ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
        </button>
      </div>

      {/* Resultados de búsqueda */}
      {searchResults.length > 0 && (
        <div className="mb-4 border rounded p-4 bg-gray-50">
          <p className="font-medium mb-2">Selecciona una dirección:</p>
          <div className="space-y-2">
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => handleSelectLocation(result)}
                className="p-3 bg-white border rounded cursor-pointer hover:bg-blue-50 hover:border-blue-500"
              >
                <p className="font-medium">{result.displayName}</p>
                <p className="text-sm text-gray-600">
                  {result.address?.road}, {result.address?.city || result.address?.town || result.address?.municipality}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultado de cobertura */}
      {coverageResult && (
        <div className={`mb-4 p-4 rounded-lg ${
          coverageResult.covered 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {coverageResult.covered ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <h3 className="text-lg font-bold text-green-800">¡Entregamos en tu zona!</h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  Zona: <span className="text-green-700">{coverageResult.zone.name}</span>
                </p>
                {coverageResult.zone.description && (
                  <p className="text-gray-600">{coverageResult.zone.description}</p>
                )}
                <p>
                  <strong>Costo de envío:</strong> ${coverageResult.delivery.price}
                </p>
                <p>
                  <strong>Tiempo estimado:</strong> {coverageResult.delivery.estimatedTime.min}-{coverageResult.delivery.estimatedTime.max} minutos
                </p>
                {coverageResult.delivery.distance && (
                  <p>
                    <strong>Distancia aproximada:</strong> {coverageResult.delivery.distance} km
                  </p>
                )}
                {coverageResult.delivery.minimumOrder > 0 && (
                  <p className="text-orange-700">
                    <strong>Pedido mínimo:</strong> ${coverageResult.delivery.minimumOrder}
                  </p>
                )}
              </div>

              {/* Validación de pedido mínimo */}
              {!coverageResult.valid && coverageResult.error && (
                <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded">
                  <p className="text-orange-800 font-medium">⚠️ {coverageResult.error}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">❌</span>
                <h3 className="text-lg font-bold text-red-800">No entregamos en esta zona</h3>
              </div>
              <p className="text-red-700">
                {coverageResult.message || 'Lo sentimos, esta ubicación está fuera de nuestra área de cobertura.'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Mapa */}
      {showMap && selectedLocation && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Mapa de Cobertura</h3>
          <div style={{ height: '400px', width: '100%' }} className="rounded-lg overflow-hidden border">
            <MapContainer
              center={[selectedLocation.lat, selectedLocation.lon]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />

              {/* Mostrar zonas activas */}
              {zones.map((zone) => {
                if (zone.type === 'polygon' && zone.geometry?.coordinates) {
                  const positions = zone.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                  return (
                    <Polygon
                      key={zone.id}
                      positions={positions}
                      pathOptions={{ 
                        color: zone.color, 
                        fillColor: zone.color, 
                        fillOpacity: 0.2,
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{zone.name}</strong>
                          <br />
                          Precio: ${zone.pricing.basePrice}
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
                        fillOpacity: 0.2,
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{zone.name}</strong>
                          <br />
                          Precio: ${zone.pricing.basePrice}
                        </div>
                      </Popup>
                    </Circle>
                  );
                }
                return null;
              })}

              {/* Marcador de la ubicación seleccionada */}
              <Marker position={[selectedLocation.lat, selectedLocation.lon]}>
                <Popup>
                  <div className="text-sm">
                    <strong>Tu ubicación</strong>
                    <br />
                    {selectedLocation.displayName}
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="mt-4 text-sm text-gray-600">
        <p>💡 <strong>Tip:</strong> Asegúrate de ingresar una dirección completa para mejores resultados.</p>
      </div>
    </div>
  );
};

export default DeliveryCoverageChecker;

