const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Crear la aplicación Express PRIMERO
const app = express();

// Luego configurar CORS
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = ['https://goburger.wuaze.com', 'http://localhost:5173'];
    // Si no hay origen (como en solicitudes curl o desde Postman) o el origen está en la lista, permite
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Almacenar las conexiones SSE
const clients = new Set();

// Middleware para SSE
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Enviar un evento inicial para mantener la conexión
  res.write('data: {"type":"connected"}\n\n');

  // Agregar cliente a la lista
  clients.add(res);

  // Eliminar cliente cuando se cierra la conexión
  req.on('close', () => {
    clients.delete(res);
  });
});

// Función para emitir eventos a todos los clientes
const emitEvent = (eventType, data) => {
  const eventData = JSON.stringify({ type: eventType, data });
  clients.forEach(client => {
    client.write(`data: ${eventData}\n\n`);
  });
};

// Agregar emitEvent al objeto req para uso en las rutas
app.use((req, res, next) => {
  req.emitEvent = emitEvent;
  console.log(`${req.method} ${req.path}`);
  next();
});

const productRoutes = require("./Routes/products");
const businessConfigRoutes = require("./Routes/businessConfig");
const categoryRoutes = require("./Routes/categories");
const toppingGroupRoutes = require("./Routes/toppingGroups");

app.use("/api/products", productRoutes);
app.use("/api/business-config", businessConfigRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/topping-groups", toppingGroupRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: "¡Algo salió mal!", error: err.message });
});

// MongoDB connection string
const MONGO_URI = "mongodb+srv://pipe95141007:Pipe9514.@cluster0.hp7leo2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    const port = process.env.PORT || 5000;
    app.listen(port, () =>
      console.log(`Server running on port ${port}`)
    );
  })
  .catch((err) => console.error("Error de conexión a MongoDB:", err));
