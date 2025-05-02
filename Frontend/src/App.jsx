import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./Context/AuthContext";
import Menu from "./Pages/Menu";
import Admin from "./Pages/Admin";
import Login from "./Pages/Login";

// Componente protegido para rutas que requieren autenticación
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Menu />} />
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        } 
      />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}

export default App;
