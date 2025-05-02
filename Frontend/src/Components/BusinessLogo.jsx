import { useState, useEffect } from "react";
import api from '../services/api';

function BusinessLogo() {
  const [logo, setLogo] = useState("");

  useEffect(() => {
    api.get("/business-config")
      .then(res => setLogo(res.data.logo))
      .catch(err => console.error("Error al obtener el logo:", err));
  }, []);

  return logo ? (
    <div className="flex justify-center mb-8">
      <img 
        src={logo} 
        alt="Logo del negocio" 
        className="w-32 h-32 rounded-full object-cover shadow-md border-2 border-gray-200"
      />
    </div>
  ) : null;
}

export default BusinessLogo; 