import { useAuth } from "../Context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import BusinessSettings from "../Components/BusinessSettings";
import CategorySettings from "../Components/CategorySettings";
import ToppingGroupsManager from '../Components/ToppingGroupsManager';
import { API_ENDPOINTS } from "../config";
import api from "../services/api";

export default function Admin() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toppingGroups, setToppingGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: '',
    toppingGroups: []
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes, toppingGroupsRes] = await Promise.all([
          api.get("/products"),
          api.get("/categories"),
          api.get("/topping-groups")
        ]);
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
        setToppingGroups(toppingGroupsRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Error al obtener datos:", err);
        setLoading(false);
      }
    };

    fetchData();

    // Configurar SSE
    const eventSource = new EventSource(`${API_ENDPOINTS.EVENTS}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'products_update':
            setProducts(data.data);
            break;
          case 'categories_update':
            setCategories(data.data);
            break;
          case 'topping-groups_update':
            setToppingGroups(data.data);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error procesando evento:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Error en la conexión SSE:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, form);
        setEditingId(null);
      } else {
        await api.post("/products", form);
      }
      setForm({ name: "", description: "", price: "", category: "", image: "", toppingGroups: [] });
    } catch (error) {
      console.error("Error al guardar producto:", error);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEdit = (product) => {
    setForm(product);
    setEditingId(product._id);
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Eliminar este producto?")) {
      try {
        await api.delete(`/products/${id}`);
      } catch (error) {
        console.error("Error al eliminar producto:", error);
      }
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Panel de Administración
        </h1>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-300"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="flex space-x-4 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            activeTab === 'products'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Información del Negocio
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Categorías
        </button>
        <button
          onClick={() => setActiveTab('toppings')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            activeTab === 'toppings'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Toppings
        </button>
      </div>

      {activeTab === 'settings' && <BusinessSettings />}
      {activeTab === 'categories' && <CategorySettings categories={categories} />}
      {activeTab === 'toppings' && <ToppingGroupsManager />}
      {activeTab === 'products' && (
        <div>
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                name="name"
                placeholder="Nombre"
                value={form.name}
                onChange={handleChange}
                className="border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                name="description"
                placeholder="Descripción"
                value={form.description}
                onChange={handleChange}
                className="border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                name="price"
                type="number"
                placeholder="Precio"
                value={form.price}
                onChange={handleChange}
                className="border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar Categoría</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <input
                name="image"
                placeholder="URL de Imagen"
                value={form.image}
                onChange={handleChange}
                className="border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2"
              />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grupos de Toppings Disponibles
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {toppingGroups.map(group => (
                    <div 
                      key={group._id} 
                      className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                        form.toppingGroups.includes(group._id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => {
                        const newToppingGroups = form.toppingGroups.includes(group._id)
                          ? form.toppingGroups.filter(id => id !== group._id)
                          : [...form.toppingGroups, group._id];
                        setForm({ ...form, toppingGroups: newToppingGroups });
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{group.name}</h3>
                          <p className="text-sm text-gray-500">{group.description}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={form.toppingGroups.includes(group._id)}
                          onChange={() => {}} // El cambio se maneja en el onClick del div
                          className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">
                          {group.isMultipleChoice ? 'Selección múltiple' : 'Selección única'} •
                          {group.isRequired ? ' Obligatorio' : ' Opcional'}
                        </p>
                        <div className="mt-1 text-xs text-gray-400">
                          {group.options.length} opciones disponibles
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="md:col-span-2 mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300"
            >
              {editingId ? "Actualizar" : "Crear"} Producto
            </button>
          </form>

          <div className="space-y-4">
            {products.map(product => (
              <div key={product._id} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      {product.name}
                    </h2>
                    <p className="text-gray-600 mt-1">{product.description}</p>
                    <p className="mt-2">
                      <span className="font-bold text-blue-600">${product.price}</span>
                      <span className="text-gray-500 ml-2">
                        - {categories.find(c => c._id === product.category)?.name || 'Sin categoría'}
                      </span>
                    </p>
                    {product.toppingGroups && product.toppingGroups.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Toppings disponibles:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {product.toppingGroups.map(toppingId => {
                            const group = toppingGroups.find(g => g._id === toppingId);
                            return group ? (
                              <span key={toppingId} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {group.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {product.image && (
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(product._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-300"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
