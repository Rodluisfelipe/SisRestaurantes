import React, { useState } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { QRCodeSVG } from 'qrcode.react';
import { FaDownload } from 'react-icons/fa';

const TableSettings = () => {
  const [showQRCode, setShowQRCode] = useState(false);
  
  const { businessId } = useBusinessConfig();
  
  
  // Generate QR code URL for business menu
  const getMenuQRCodeUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${businessId}`;
  };
  
  // Show QR code modal for menu
  const handleShowMenuQRCode = () => {
    setShowQRCode(true);
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
      downloadLink.download = `menu-qr-${businessId}.png`;
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Código QR del Menú</h2>
        <p className="text-gray-600 mb-8">
          Los clientes pueden escanear este código para acceder al menú de tu negocio
        </p>
        
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-white border-2 border-gray-200 rounded-lg shadow-lg">
            <QRCodeSVG
              id="menu-qr-code"
              value={getMenuQRCodeUrl()}
              size={300}
              level="H"
              includeMargin={true}
                  />
                </div>
                </div>
                
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-600 mb-2">URL del menú:</p>
          <p className="text-xs text-gray-500 break-all font-mono">
            {getMenuQRCodeUrl()}
          </p>
                </div>
                
        <div className="flex justify-center space-x-4">
                  <button
            onClick={handleShowMenuQRCode}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center space-x-2 text-lg font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span>Ver QR Completo</span>
                  </button>
                </div>
              </div>
      
      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                QR del Menú del Negocio
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Los clientes pueden escanear este código para acceder al menú
              </p>
              
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-white border-2 border-gray-200 rounded-lg">
                  <QRCodeSVG
                    id="table-qr-code"
                    value={getMenuQRCodeUrl()}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mb-4 break-all">
                URL: {getMenuQRCodeUrl()}
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
                  onClick={() => setShowQRCode(false)}
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