import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { QRCodeSVG } from 'qrcode.react';
import { FaDownload, FaEdit, FaPlus, FaTrash } from 'react-icons/fa';

const TableSettings = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showQRCode, setShowQRCode] = useState(null);
  const [currentTable, setCurrentTable] = useState(null);
  const [formData, setFormData] = useState({
    tableNumber: '',
    tableName: '',
    notes: ''
  });
  
  const { businessId, businessConfig } = useBusinessConfig();
  
  // Log para depuración
  useEffect(() => {
    console.log('TableSettings - businessId recibido:', businessId);
    console.log('TableSettings - businessConfig:', businessConfig);
  }, [businessId, businessConfig]);
  
  // Fetch tables data
  useEffect(() => {
    const fetchTables = async () => {
      try {
        console.log('TableSettings - Intentando cargar mesas con businessId:', businessId);
        setLoading(true);
        
        // Log adicional para verificar el tipo y valor del businessId
        console.log('TableSettings - Tipo de businessId:', typeof businessId);
        console.log('TableSettings - ¿Es valor falsy?', !businessId);
        
        const response = await api.get(`/tables?businessId=${businessId}`);
        console.log('TableSettings - Respuesta de API:', response.data);
        
        setTables(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching tables:', err);
        console.error('Error details:', err.response?.data || 'No response data');
        setError('Error al cargar las mesas. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };
    
    if (businessId) {
      console.log('TableSettings - Ejecutando fetchTables() con businessId:', businessId);
      fetchTables();
    } else {
      console.log('TableSettings - No se ejecuta fetchTables() porque businessId es:', businessId);
    }
  }, [businessId]);
  
  // Reset form data
  const resetForm = () => {
    setFormData({
      tableNumber: '',
      tableName: '',
      notes: ''
    });
  };
  
  // Open add form
  const handleAddClick = () => {
    resetForm();
    setShowAddForm(true);
  };
  
  // Open edit form
  const handleEditClick = (table) => {
    setCurrentTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      tableName: table.tableName || '',
      notes: table.notes || ''
    });
    setShowEditForm(true);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Create new table
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await api.post('/tables', {
        businessId,
        tableNumber: formData.tableNumber,
        tableName: formData.tableName,
        notes: formData.notes
      });
      
      setTables([...tables, response.data]);
      setShowAddForm(false);
      resetForm();
    } catch (err) {
      console.error('Error creating table:', err);
      setError('Error al crear la mesa. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Update table
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await api.put(`/tables/${currentTable._id}`, {
        businessId,
        tableNumber: formData.tableNumber,
        tableName: formData.tableName,
        notes: formData.notes
      });
      
      // Update tables array
      setTables(tables.map(table => 
        table._id === currentTable._id ? response.data : table
      ));
      
      setShowEditForm(false);
      resetForm();
      setCurrentTable(null);
    } catch (err) {
      console.error('Error updating table:', err);
      setError('Error al actualizar la mesa. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete table
  const handleDeleteClick = async (tableId) => {
    if (!window.confirm('¿Está seguro que desea eliminar esta mesa?')) {
      return;
    }
    
    try {
      setLoading(true);
      await api.delete(`/tables/${tableId}?businessId=${businessId}`);
      
      // Remove from tables array
      setTables(tables.filter(table => table._id !== tableId));
    } catch (err) {
      console.error('Error deleting table:', err);
      setError('Error al eliminar la mesa. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Generate QR code URL
  const getQRCodeUrl = (table) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${businessId}/mesa/${table.tableNumber}`;
  };
  
  // Show QR code modal
  const handleShowQRCode = (table) => {
    setShowQRCode(table);
  };
  
  // Download QR code as PNG
  const handleDownloadQR = () => {
    const svgElement = document.getElementById('table-qr-code');
    if (!svgElement) return;
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    canvas.width = 200;
    canvas.height = 200;
    
    // Create an image from the SVG
    const image = new Image();
    image.onload = function() {
      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the image
      ctx.drawImage(image, 0, 0);
      
      // Convert to PNG
      const pngUrl = canvas.toDataURL('image/png');
      
      // Download
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `mesa-${showQRCode.tableNumber}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    
    // Convert the SVG to a data URL
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    // Set the image source to the SVG URL
    image.src = svgUrl;
  };
  
  // Error display
  if (error) {
    return (
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
        <p>{error}</p>
        <button 
          onClick={() => setError(null)} 
          className="mt-2 bg-red-100 text-red-800 px-3 py-1 rounded-lg hover:bg-red-200"
        >
          Cerrar
        </button>
      </div>
    );
  }
  if (loading && tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></span>
        <span className="text-gray-600 text-lg font-semibold animate-pulse">Cargando mesas...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Administrar Mesas</h2>
        <button
          onClick={handleAddClick}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <FaPlus size={16} />
          <span>Agregar Mesa</span>
        </button>
      </div>
      
      {/* Table list */}
      {tables.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg text-gray-400 text-lg">
          No hay mesas registradas
          <button
            onClick={handleAddClick}
            className="mt-3 text-blue-600 hover:text-blue-800 hover:underline block"
          >
            Agregar una mesa
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notas
                </th>
                <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tables.map((table) => (
                <tr key={table._id} className="hover:bg-gray-50">
                  <td className="py-4 px-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {table.tableNumber}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">
                    {table.tableName || `Mesa ${table.tableNumber}`}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-500 max-w-xs truncate">
                    {table.notes || '-'}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleShowQRCode(table)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-full"
                        title="Ver código QR"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEditClick(table)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-full"
                        title="Editar mesa"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(table._id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-full"
                        title="Eliminar mesa"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Agregar Nueva Mesa</h3>
            <form onSubmit={handleAddSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Mesa *
                  </label>
                  <input
                    type="text"
                    name="tableNumber"
                    value={formData.tableNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de Mesa
                  </label>
                  <input
                    type="text"
                    name="tableName"
                    value={formData.tableName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Mesa VIP"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Notas adicionales sobre esta mesa"
                  ></textarea>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Form Modal */}
      {showEditForm && currentTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Editar Mesa #{currentTable.tableNumber}</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Mesa *
                  </label>
                  <input
                    type="text"
                    name="tableNumber"
                    value={formData.tableNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de Mesa
                  </label>
                  <input
                    type="text"
                    name="tableName"
                    value={formData.tableName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Mesa VIP"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Notas adicionales sobre esta mesa"
                  ></textarea>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                QR para Mesa #{showQRCode.tableNumber}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {showQRCode.tableName || `Mesa ${showQRCode.tableNumber}`}
              </p>
              
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-white border-2 border-gray-200 rounded-lg">
                  <QRCodeSVG
                    id="table-qr-code"
                    value={getQRCodeUrl(showQRCode)}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mb-4">
                URL: {getQRCodeUrl(showQRCode)}
              </p>
              
              <div className="flex justify-center space-x-3">
                <button
                  onClick={handleDownloadQR}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <FaDownload size={16} />
                  <span>Descargar</span>
                </button>
                <button
                  onClick={() => setShowQRCode(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableSettings;