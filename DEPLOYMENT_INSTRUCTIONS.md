# 🚀 Instrucciones de Despliegue a Producción

## 📋 Prerrequisitos

### 1. Digital Ocean Droplet
- Droplet con Ubuntu 20.04+ 
- Docker instalado
- SSH configurado
- Puerto 80 y 443 abiertos

### 2. Vercel Account
- Cuenta de Vercel
- Vercel CLI instalado: `npm i -g vercel`

### 3. Docker Hub
- Cuenta de Docker Hub
- Repositorio creado para la imagen

## 🔧 Configuración Inicial

### 1. Actualizar Variables de Entorno

#### Backend (.env.production)
```bash
# Editar Backend/.env.production con tus datos:
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/sisrestaurantes
JWT_SECRET=tu_jwt_secret_super_seguro
ALLOWED_ORIGINS=https://tu-dominio-vercel.vercel.app
FRONTEND_URL=https://tu-dominio-vercel.vercel.app
```

#### Frontend (vercel.json)
```bash
# Editar Frontend/vercel.json con tus datos:
"env": {
  "VITE_API_URL": "http://tu-droplet-ip"
}
```

### 2. Actualizar Scripts de Despliegue

#### deploy-production.sh
```bash
# Editar las variables al inicio del archivo:
DROPLET_IP="tu-ip-de-digital-ocean"
FRONTEND_URL="https://tu-dominio-vercel.vercel.app"
```

## 🚀 Proceso de Despliegue

### Opción 1: Despliegue Automático (Recomendado)
```bash
# Ejecutar desde la raíz del proyecto:
chmod +x deploy-production.sh
./deploy-production.sh
```

### Opción 2: Despliegue Manual

#### Backend (Digital Ocean)
```bash
cd Backend
chmod +x deploy-digitalocean.sh
./deploy-digitalocean.sh
```

#### Frontend (Vercel)
```bash
cd Frontend
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

## 🔍 Verificación Post-Despliegue

### 1. Verificar Backend
```bash
# Verificar que el contenedor esté corriendo:
ssh root@tu-droplet-ip 'docker ps | grep sisrestaurantes-backend'

# Ver logs:
ssh root@tu-droplet-ip 'docker logs sisrestaurantes-backend -f'

# Probar endpoint:
curl http://tu-droplet-ip/api/health
```

### 2. Verificar Frontend
```bash
# Ver logs de Vercel:
vercel logs

# Probar la aplicación:
# Abrir https://tu-dominio-vercel.vercel.app en el navegador
```

## 🛠️ Comandos Útiles

### Backend (Digital Ocean)
```bash
# Reiniciar contenedor:
ssh root@tu-droplet-ip 'docker restart sisrestaurantes-backend'

# Ver logs en tiempo real:
ssh root@tu-droplet-ip 'docker logs sisrestaurantes-backend -f'

# Acceder al contenedor:
ssh root@tu-droplet-ip 'docker exec -it sisrestaurantes-backend sh'

# Actualizar imagen:
ssh root@tu-droplet-ip 'docker pull sisrestaurantes/backend:latest && docker restart sisrestaurantes-backend'
```

### Frontend (Vercel)
```bash
# Ver variables de entorno:
vercel env ls

# Agregar variable de entorno:
vercel env add VITE_API_URL

# Ver logs:
vercel logs

# Reiniciar despliegue:
vercel --prod
```

## 🔒 Configuración de Seguridad

### 1. SSL/HTTPS (Recomendado)
- Configurar Let's Encrypt en Digital Ocean
- Usar Cloudflare para SSL gratuito
- Configurar dominio personalizado en Vercel

### 2. Variables de Entorno Seguras
- Usar JWT secrets fuertes
- Configurar CORS correctamente
- Usar contraseñas seguras para MongoDB

## 📊 Monitoreo

### 1. Logs
- Backend: `docker logs sisrestaurantes-backend -f`
- Frontend: `vercel logs`

### 2. Métricas
- Digital Ocean: Dashboard de recursos
- Vercel: Analytics en dashboard

## 🆘 Solución de Problemas

### Error de Conexión Backend
```bash
# Verificar que el contenedor esté corriendo:
docker ps | grep sisrestaurantes-backend

# Verificar logs:
docker logs sisrestaurantes-backend

# Verificar puertos:
netstat -tlnp | grep :5000
```

### Error de CORS
- Verificar `ALLOWED_ORIGINS` en `.env.production`
- Verificar `VITE_API_URL` en Vercel

### Error de Base de Datos
- Verificar `MONGODB_URI` en `.env.production`
- Verificar conexión a MongoDB Atlas

## 📞 Soporte

Si encuentras problemas:
1. Revisar logs de ambos servicios
2. Verificar variables de entorno
3. Verificar conectividad de red
4. Revisar configuración de CORS

---

**¡Despliegue exitoso! 🎉**
