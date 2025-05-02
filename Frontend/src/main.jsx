import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./Context/AuthContext";
import ErrorBoundary from "./Components/ErrorBoundary";

// Importar el servicio API para inicializar la configuración global
import "./services/api.js";

// Creamos un componente Root que contendrá el AuthProvider
const Root = () => {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);
