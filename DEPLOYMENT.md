# 🚀 Guía de Despliegue - Sistema de Restaurantes

## 📋 Arquitectura de Producción

- **Frontend**: Vercel (React + Vite)
- **Backend**: Digital Ocean (Node.js + Docker)
- **Base de Datos**: MongoDB (Atlas)
- **Socket.IO**: Tiempo real entre servicios

---

## 🌊 Digital Ocean - Backend

### 1. Crear Droplet
```bash
# Crear droplet con Docker pre-instalado
# Ubuntu 22.04 LTS
# Mínimo: 2GB RAM, 1 vCPU, 50GB SSD
```

### 2. Configurar Droplet
```bash
# Conectar por SSH
ssh root@your-droplet-ip

# Actualizar sistema
apt update && apt upgrade -y

# Crear directorio para la aplicación
mkdir -p /opt/sisrestaurantes
cd /opt/sisrestaurantes

# Crear archivo .env con tus variables
nano .env
```

### 3. Desplegar Backend
```bash
# En tu máquina local, desde la carpeta Backend:
chmod +x deploy-digitalocean.sh
./deploy-digitalocean.sh
```

### 4. Configurar Dominio (Opcional)
```bash
# Instalar Nginx para proxy reverso
apt install nginx -y

# Configurar SSL con Let's Encrypt
apt install certbot python3-certbot-nginx -y
certbot --nginx -d tu-dominio.com
```

---

## ⚡ Vercel - Frontend

### 1. Instalar Vercel CLI
```bash
npm install -g vercel
```

### 2. Configurar Proyecto
```bash
# Desde la carpeta Frontend:
vercel login
vercel init
```

### 3. Desplegar
```bash
# Automático con script:
chmod +x deploy-vercel.sh
./deploy-vercel.sh

# O manual:
vercel --prod
```

### 4. Variables de Entorno en Vercel
```bash
# Configurar en dashboard de Vercel o CLI:
vercel env add VITE_ENVIRONMENT production
vercel env add VITE_API_URL https://tu-backend-domain.com
vercel env add VITE_SOCKET_URL https://tu-backend-domain.com
```

---

## 🔧 Configuración de Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=tu_jwt_secret_super_seguro
ALLOWED_ORIGINS=https://tu-vercel-app.vercel.app
```

### Frontend (Vercel Dashboard)
```env
VITE_ENVIRONMENT=production
VITE_API_URL=https://tu-digitalocean-domain.com
VITE_SOCKET_URL=https://tu-digitalocean-domain.com
```

---

## 🔍 Verificación

### Backend
```bash
# Verificar que esté corriendo
curl https://tu-backend-domain.com/api/health

# Ver logs
docker logs sisrestaurantes-backend
```

### Frontend
```bash
# Verificar despliegue
curl https://tu-vercel-app.vercel.app
```

---

## 🚨 Solución de Problemas

### CORS Errors
- Verificar `ALLOWED_ORIGINS` en backend
- Incluir todos los dominios de Vercel

### Socket.IO No Conecta
- Verificar `VITE_SOCKET_URL` en Vercel
- Comprobar que backend esté corriendo

### 502 Bad Gateway
- Verificar que el contenedor esté corriendo
- Revisar logs: `docker logs sisrestaurantes-backend`

---

## 📊 Monitoreo

### Logs del Backend
```bash
# Ver logs en tiempo real
docker logs -f sisrestaurantes-backend

# Ver logs de Nginx (si usas)
tail -f /var/log/nginx/access.log
```

### Métricas de Vercel
- Dashboard de Vercel: Analytics y Performance
- Logs de build y runtime

---

## 🔄 Actualizaciones

### Backend
```bash
# Ejecutar script de despliegue
./deploy-digitalocean.sh
```

### Frontend
```bash
# Push a main/master trigger automático en Vercel
git push origin main

# O manual:
vercel --prod
```
