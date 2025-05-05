import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config';

const DebugSSE = () => {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('Desconectado');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let eventSource = null;
    
    const connect = () => {
      setStatus('Conectando...');
      eventSource = new EventSource(API_ENDPOINTS.EVENTS);
      
      eventSource.onopen = () => {
        setStatus('Conectado');
        setConnected(true);
        addEvent('info', 'Conexión establecida');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addEvent('event', `${data.type}`, data);
        } catch (error) {
          addEvent('error', 'Error al parsear mensaje', error);
        }
      };
      
      eventSource.onerror = (error) => {
        setStatus('Error de conexión');
        addEvent('error', 'Error en la conexión', error);
        setConnected(false);
        
        // Intentar reconectar después de 5 segundos
        setTimeout(() => {
          if (eventSource) {
            eventSource.close();
            connect();
          }
        }, 5000);
      };
    };
    
    connect();
    
    return () => {
      if (eventSource) {
        eventSource.close();
        setStatus('Desconectado');
        setConnected(false);
      }
    };
  }, []);
  
  const addEvent = (type, message, data = null) => {
    const now = new Date();
    const time = now.toLocaleTimeString();
    setEvents(prev => [
      { type, message, data, time },
      ...prev
    ].slice(0, 50)); // Limitar a 50 eventos
  };
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Depuración de SSE</h1>
      
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <div className={`w-4 h-4 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>Estado: {status}</span>
        </div>
        
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Reconectar
        </button>
      </div>
      
      <div className="border rounded-lg p-4 bg-gray-50 max-h-[80vh] overflow-auto">
        <h2 className="text-lg font-semibold mb-2">Eventos ({events.length})</h2>
        
        {events.map((event, index) => (
          <div 
            key={index} 
            className={`mb-2 p-2 rounded ${
              event.type === 'error' 
                ? 'bg-red-100' 
                : event.type === 'info' 
                  ? 'bg-blue-100' 
                  : 'bg-gray-100'
            }`}
          >
            <div className="flex justify-between">
              <span className="font-medium">{event.message}</span>
              <span className="text-gray-500 text-sm">{event.time}</span>
            </div>
            
            {event.data && (
              <pre className="mt-1 text-xs bg-black text-green-400 p-2 rounded overflow-x-auto">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
        
        {events.length === 0 && (
          <p className="text-gray-500">Ningún evento recibido</p>
        )}
      </div>
    </div>
  );
};

export default DebugSSE; 