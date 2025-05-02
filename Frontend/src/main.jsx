import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./Context/AuthContext";
import ErrorBoundary from "./Components/ErrorBoundary";

// Creamos un componente Root que contendrá el AuthProvider
const Root = () => {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

// Configuración del router con las nuevas flags y manejo de errores
const router = createBrowserRouter([
  {
    path: '/*',
    element: <Root />,
    errorElement: <ErrorBoundary />
  }
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
