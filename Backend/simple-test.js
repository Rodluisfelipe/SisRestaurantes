const express = require('express');
const app = express();
const cors = require('cors');

// Habilitar CORS
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());

// Ruta de prueba
app.get('/test', (req, res) => {
    console.log('Test route hit');
    res.json({ message: 'Test successful' });
});

// Ruta de business config
app.get('/api/business-config', (req, res) => {
    console.log('Business config route hit');
    res.json({
        logo: 'https://example.com/logo.png',
        coverImage: 'https://example.com/cover.jpg'
    });
});

// Iniciar servidor
const port = 5000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Available routes:');
    console.log(`- GET http://localhost:${port}/test`);
    console.log(`- GET http://localhost:${port}/api/business-config`);
}); 