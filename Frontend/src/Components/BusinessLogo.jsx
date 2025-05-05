import { useState, useEffect } from "react";
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

function BusinessLogo() {
  const [logo, setLogo] = useState("");
  const { businessId } = useBusinessConfig();

  useEffect(() => {
    api.get(`/business-config?businessId=${businessId}`)
      .then(res => setLogo(res.data.logo))
      .catch(err => console.error("Error al obtener el logo:", err));
  }, [businessId]);

  return logo ? (
    <div className="flex justify-center mb-8">
      <img 
        src={logo} 
        alt="Logo del negocio" 
        className="w-32 h-32 rounded-full object-cover shadow-md border-2 border-gray-200"
        onError={e => { e.target.src = 'https://placehold.co/150x150?text=Logo'; }}
      />
    </div>
  ) : null;
}

export default BusinessLogo; 