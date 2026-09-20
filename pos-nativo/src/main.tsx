import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PantallaCliente from './PantallaCliente';
import './estilos.css';

/* La misma app sirve las dos ventanas: la caja y la pantalla del cliente. Se
   distinguen por el hash de la URL, que es lo que pone Rust al crear la
   segunda ventana. Un solo bundle, un solo instalador, un solo despliegue. */
const esPantallaCliente = window.location.hash === '#cliente';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {esPantallaCliente ? <PantallaCliente /> : <App />}
  </React.StrictMode>,
);
