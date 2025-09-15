# 🚀 Instrucciones de Despliegue - PIPE95141007

## 📋 Tus Datos de Configuración

### ✅ Ya Configurado:
- **MongoDB:** `mongodb+srv://pipe95141007:Pipe9514.@cluster0.hp7leo2.mongodb.net/`
- **Email:** `pipe95141007@gmail.com`
- **JWT Secret:** Configurado para producción

### ⚠️ Necesitas Configurar:
1. **IP de Digital Ocean Droplet**
2. **Dominio de Vercel** (ej: `sisrestaurantes.vercel.app`)

## 🔧 Pasos para Desplegar

### 1. Configurar Variables

#### ✅ Todo configurado:
```bash
# ✅ IP ya configurada:
DROPLET_IP="157.245.125.216"  # ✅ IP de Digital Ocean configurada
FRONTEND_URL="https://www.menuby.tech"  # ✅ Dominio personalizado configurado
```

#### ✅ No necesitas cambiar nada más

### 2. Ejecutar Despliegue

#### Opción 1: Solo Backend (Recomendado)
```bash
# Ejecutar desde la raíz del proyecto:
./deploy-backend-only.sh
```

#### Opción 2: Backend + Frontend
```bash
# Ejecutar desde la raíz del proyecto:
./deploy-pipe.sh
```

## 📦 Lo que se Desplegará

### Backend (Digital Ocean):
- ✅ **API completa** con todas las funcionalidades
- ✅ **Gestión de banners** (crear, aprobar, eliminar)
- ✅ **Sistema de autenticación** JWT
- ✅ **Base de datos** MongoDB Atlas
- ✅ **Email** configurado con Gmail

### Frontend (Vercel):
- ✅ **Panel Admin** para restaurantes
- ✅ **Panel SuperAdmin** para gestión
- ✅ **Catálogo MenuBy** con banners
- ✅ **Sistema completo** de gestión

## 🔍 Verificación Post-Despliegue

### Backend:
```bash
# Verificar contenedor:
ssh root@157.245.125.216 'docker ps | grep sisrestaurantes-backend'

# Ver logs:
ssh root@157.245.125.216 'docker logs sisrestaurantes-backend -f'

# Probar API:
curl http://157.245.125.216/api/health
```

### Frontend:
```bash
# El frontend se despliega automáticamente desde Git
# Probar aplicación:
# Abrir https://www.menuby.tech en el navegador
```

## 🛠️ Comandos Útiles

### Backend:
```bash
# Reiniciar:
ssh root@157.245.125.216 'docker restart sisrestaurantes-backend'

# Ver logs en tiempo real:
ssh root@157.245.125.216 'docker logs sisrestaurantes-backend -f'

# Actualizar:
ssh root@157.245.125.216 'docker pull sisrestaurantes/backend:latest && docker restart sisrestaurantes-backend'
```

### Frontend:
```bash
# El frontend se despliega automáticamente desde Git
# Para actualizar: hacer commit y push al repositorio
git add .
git commit -m "Actualización del frontend"
git push origin main
```

## 🆘 Solución de Problemas

### Error de Conexión:
1. Verificar que la IP de Digital Ocean sea correcta
2. Verificar que el puerto 80 esté abierto
3. Verificar que Docker esté corriendo

### Error de CORS:
1. Verificar que el dominio de Vercel sea correcto
2. Verificar `ALLOWED_ORIGINS` en `.env.production`

### Error de Base de Datos:
1. Verificar que MongoDB Atlas esté accesible
2. Verificar que la IP de Digital Ocean esté en la whitelist de MongoDB

## 📞 Soporte

Si encuentras problemas:
1. Revisar logs: `docker logs sisrestaurantes-backend -f`
2. Verificar variables de entorno
3. Verificar conectividad de red
4. Revisar configuración de CORS

---

**¡Tu sistema está listo para producción! 🎉**

### Funcionalidades Incluidas:
- ✅ **Gestión completa de banners**
- ✅ **Catálogo MenuBy** con promociones
- ✅ **Panel SuperAdmin** para gestión
- ✅ **Panel Admin** para restaurantes
- ✅ **Sistema de autenticación** completo
- ✅ **Base de datos** MongoDB Atlas
- ✅ **Email** configurado
