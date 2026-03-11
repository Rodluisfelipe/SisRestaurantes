# SisRestaurantes — Contexto Completo para LLMs

## Resumen del Proyecto
Sistema de gestión y pedidos para restaurantes (SaaS multi-tenant). Cada negocio tiene su menú digital, sistema POS, pedidos en tiempo real, y panel de administración.

- **Nombre comercial del frontend:** MenuBy (menuby.tech)
- **Repositorio:** https://github.com/Rodluisfelipe/SisRestaurantes
- **Rama principal de desarrollo:** `desarrollo`
- **Ramas legacy (no usar):** `main`, `dev`, `developer`

---

## Arquitectura General

```
┌─────────────────────┐      ┌──────────────────────────────────────┐
│  FRONTEND (React)   │      │  SERVIDOR DigitalOcean 157.245.125.216│
│  Cloudflare Pages   │◄────►│                                      │
│  menuby.tech        │ HTTPS│  ┌─ Nginx (reverse proxy) ──────┐   │
└─────────────────────┘      │  │  :80 → redirect :443         │   │
                             │  │  :443 → proxy_pass :5000     │   │
                             │  │  /api/*  → backend            │   │
                             │  │  /socket.io/* → backend (ws)  │   │
                             │  │  /uploads/* → backend          │   │
                             │  └──────────────────────────────┘   │
                             │                                      │
                             │  ┌─ Docker Container ────────────┐   │
                             │  │  sisrestaurantes-backend-1    │   │
                             │  │  Node.js 18 Alpine            │   │
                             │  │  Express + Socket.IO          │   │
                             │  │  Puerto interno: 5000         │   │
                             │  │  Bind: 127.0.0.1:5000         │   │
                             │  └──────────────────────────────┘   │
                             │                                      │
                             │  ┌─ PostgreSQL 17 (localhost) ───┐   │
                             │  │  DB: sisrestaurantes (legacy) │   │
                             │  │  Solo escucha en 127.0.0.1    │   │
                             │  └──────────────────────────────┘   │
                             │                                      │
                             │  MongoDB Atlas (remoto, cloud)       │
                             └──────────────────────────────────────┘
```

---

## Frontend

### Stack
- **Framework:** React + Vite
- **Estilos:** Tailwind CSS + Framer Motion
- **Hosting:** Cloudflare Pages (conectado a GitHub)
- **Dominio:** https://www.menuby.tech
- **API URL:** https://157-245-125-216.nip.io

### Deploy del Frontend
1. Se hace commit + push a la rama `desarrollo` en GitHub
2. Cloudflare Pages detecta el push automáticamente
3. Cloudflare ejecuta `npm run build` (Vite) en el directorio `Frontend/`
4. Genera los archivos estáticos en `Frontend/dist/`
5. Los sirve en menuby.tech

**Comando local:**
```bash
cd Frontend
git add .
git commit -m "mensaje"
git push origin desarrollo
# Cloudflare hace el build automáticamente
```

### Variables de Entorno (Frontend - .env.production)
```
VITE_API_URL=https://157-245-125-216.nip.io
VITE_SOCKET_URL=https://157-245-125-216.nip.io
VITE_VAPID_PUBLIC=BK9RDRn4p7Dwmp-t2weM7RHG_F9OsTBpb9qKdgfM-bUZKk09yHb-kzKjXBJe7drtvNk723omtJq9ZaVPbR3WDvw
VITE_SENTRY_DSN=<configurado>
VITE_GOOGLE_CLIENT_ID=<configurado>
```

### Estructura Frontend (clave)
```
Frontend/
├── src/
│   ├── Components/         # Componentes React
│   ├── Context/            # BusinessContext, etc.
│   ├── hooks/              # Custom hooks
│   ├── services/           # API calls, posOfflineStore
│   └── pages/              # Páginas principales
├── vite.config.js
├── tailwind.config.js
├── package.json
└── .env.production
```

---

## Backend

### Stack
- **Runtime:** Node.js 18 (Alpine Docker)
- **Framework:** Express.js
- **WebSockets:** Socket.IO
- **Base de datos:** MongoDB Atlas (cloud)
- **Contenedor:** Docker con docker-compose
- **Monitoreo:** Sentry

### Estructura del Backend en el Servidor
```
/opt/sisrestaurantes/              # Directorio raíz en el servidor
├── .env                           # Variables de entorno ACTIVAS
├── server.js                      # Entry point
├── package.json
├── Dockerfile
├── docker-compose.yml
├── Routes/                        # Rutas Express
├── Models/                        # Modelos Mongoose
├── Controllers/                   # Controladores
├── middleware/                     # Auth middleware, tenant auth
├── services/                      # socketService, etc.
├── utils/                         # Helpers, validators, constants
├── scripts/                       # Scripts de mantenimiento
├── uploads/                       # Archivos subidos (montado como volumen)
│   ├── order-proofs/
│   ├── announcements/
│   └── banners/
├── config/                        # JWT config
├── Backend/                       # Copia alternativa (docker-compose aquí)
└── Backend-backup/                # Backup viejo
```

**IMPORTANTE:** El contenedor Docker mapea `/opt/sisrestaurantes/` como `/app/` internamente. Cuando haces `docker cp`, la ruta interna es `/app/Routes/archivo.js`.

### Deploy del Backend

**NO es un git repo en el servidor.** Los archivos se suben manualmente vía SCP + docker cp.

#### Método de deploy (archivo individual):
```powershell
# 1. Subir archivo al servidor vía SCP
scp -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean Backend/Routes/archivo.js root@157.245.125.216:/tmp/archivo.js

# 2. Copiar dentro del contenedor Docker
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "docker cp /tmp/archivo.js sisrestaurantes-backend-1:/app/Routes/archivo.js && docker restart sisrestaurantes-backend-1"

# 3. Verificar que arrancó bien
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "docker logs sisrestaurantes-backend-1 --tail 5"
```

#### Método de deploy (rebuild completo):
```powershell
# 1. Subir todos los archivos del Backend
scp -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean -r Backend/* root@157.245.125.216:/opt/sisrestaurantes/Backend/

# 2. Rebuild de la imagen Docker
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "cd /opt/sisrestaurantes/Backend && docker build -t sisrestaurantes-backend . && docker compose up -d"
```

#### Método rápido (hot-patch sin rebuild):
```powershell
# Para cambios en un solo archivo JS que no requieran npm install:
scp -i ... archivo.js root@157.245.125.216:/tmp/archivo.js
ssh -i ... root@157.245.125.216 "docker cp /tmp/archivo.js sisrestaurantes-backend-1:/app/ruta/archivo.js && docker restart sisrestaurantes-backend-1"
```

### Verificación post-deploy
```powershell
# Ver logs
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "docker logs sisrestaurantes-backend-1 --tail 20"

# Verificar health
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "curl -s http://localhost:5000/api/health"

# Verificar que el archivo cambió
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "docker exec sisrestaurantes-backend-1 head -5 Routes/archivo.js"
```

---

## Conexión SSH

```
Host: 157.245.125.216
User: root
Key: C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean
```

**Comando SSH base:**
```powershell
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "COMANDO"
```

**NOTA PowerShell:** Las comillas dobles y caracteres especiales ($, comillas anidadas) causan problemas de escape en PowerShell. Para comandos complejos, crear un script .sh local, subirlo con SCP, y ejecutarlo con `bash /tmp/script.sh`.

---

## Base de Datos (MongoDB)

- **Motor:** MongoDB Atlas (cloud, no local)
- **Conexión:** Via MONGODB_URI en .env del contenedor
- **ODM:** Mongoose

### Colecciones principales
| Colección | Descripción | Docs aprox |
|-----------|-------------|------------|
| businessconfigs | Configuración de cada negocio/restaurante | 8 |
| products | Productos del menú | 90 |
| categories | Categorías de productos | 30 |
| orders | Pedidos activos | ~138 |
| completedorders | Pedidos completados (archivados) | ~430 |
| customers | Clientes registrados | ~330 |
| toppinggroups | Grupos de toppings/extras | 12 |
| admins | Usuarios administradores | 8 |
| subscriptions | Suscripciones de negocios | 7 |
| deliveryzones | Zonas de entrega | 9 |
| customerloyalties | Puntos de fidelidad | 23 |
| loyaltyprograms | Programas de lealtad | 3 |
| reviews | Reseñas | 18 |
| cashregisters | Cajas registradoras | 5 |

### Ejecutar queries en producción
```powershell
# 1. Crear script .js local
# 2. Subir y ejecutar:
scp -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean script.js root@157.245.125.216:/tmp/script.js
ssh -i C:\Users\TECNOPHONE\.ssh\id_rsa_digitalocean root@157.245.125.216 "docker cp /tmp/script.js sisrestaurantes-backend-1:/app/script.js && docker exec sisrestaurantes-backend-1 node script.js"
```

Los modelos Mongoose están en `/app/Models/` dentro del contenedor. **No existe Business.js** — la config de negocio está en `BusinessConfig.js`.

---

## Nginx (Reverse Proxy)

### Archivos de configuración
- **Activo SSL:** `/etc/nginx/sites-enabled/sisrestaurantes-ssl-ip`
- **Activo backend:** `/etc/nginx/sites-enabled/sisrestaurantes-backend` (symlink)
- **Dominio SSL:** `157-245-125-216.nip.io`
- **Certificado:** Let's Encrypt (`/etc/letsencrypt/live/157-245-125-216.nip.io/`)

### Rutas que proxea
| Path | Destino | Notas |
|------|---------|-------|
| `/api/*` | http://127.0.0.1:5000 | API REST |
| `/socket.io/*` | http://127.0.0.1:5000 | WebSocket (upgrade) |
| `/uploads/*` | http://127.0.0.1:5000 | Archivos estáticos |
| `/health` | http://127.0.0.1:5000 | Health check |
| `/events/*` | http://127.0.0.1:5000 | SSE events |

---

## Docker

### Contenedor activo
- **Nombre:** `sisrestaurantes-backend-1`
- **Imagen:** `sisrestaurantes-backend:latest`
- **Puerto:** `127.0.0.1:5000 → 5000`
- **Volumen:** `./uploads:/app/uploads`
- **Health check:** `curl http://localhost:5000/api/health` cada 30s
- **Restart policy:** `unless-stopped`

### Comandos Docker útiles
```bash
# Ver logs
docker logs sisrestaurantes-backend-1 --tail 50

# Restart
docker restart sisrestaurantes-backend-1

# Entrar al contenedor
docker exec -it sisrestaurantes-backend-1 sh

# Copiar archivo al contenedor
docker cp /tmp/archivo.js sisrestaurantes-backend-1:/app/ruta/archivo.js

# Rebuild completo
cd /opt/sisrestaurantes/Backend && docker build -t sisrestaurantes-backend . && docker compose up -d

# Limpiar imágenes viejas
docker image prune -f && docker builder prune -af
```

---

## Servidor DigitalOcean

### Specs
- **IP:** 157.245.125.216
- **OS:** Ubuntu (kernel 6.14)
- **CPU:** 1 vCPU
- **RAM:** 960 MB + 1 GB swap
- **Disco:** 24 GB
- **Servicios activos:** Nginx, Docker, PostgreSQL 17 (legacy)

### Servicios y puertos
| Puerto | Servicio | Binding |
|--------|----------|---------|
| 22 | SSH | 0.0.0.0 |
| 80 | Nginx (redirect → 443) | 0.0.0.0 |
| 443 | Nginx (SSL termination) | 0.0.0.0 |
| 5000 | Docker/Backend | 127.0.0.1 (solo local) |
| 5432 | PostgreSQL (legacy) | 127.0.0.1 (solo local) |

---

## Bugs Conocidos y Fixes Aplicados

1. **orderNumber duplicado:** `generateOrderNumber()` en `Routes/orders.js` ahora consulta AMBAS colecciones (`Order` + `CompletedOrder`) para evitar resetear el contador cuando `Order` queda vacía.

2. **WebSocket 400 Bad Request:** Nginx requiere `Connection "upgrade"` como string literal, no como variable `$connection_upgrade`. Fix aplicado en el config SSL.

3. **Toppings vacíos:** Los productos con `subGroups` dentro de `selectedToppings` necesitan `.flatMap()` para extraer los items anidados. Afecta: `ModernOrdersDashboard.jsx`, `POSActiveOrders.jsx`, `ModernKitchen.jsx`, `CompletedOrdersSummary.jsx`, `EnhancedCompletedOrders.jsx`.

---

## Flujo de Trabajo Típico

### Cambio en Frontend:
```
1. Editar archivos en Frontend/src/
2. git add . && git commit -m "..." && git push origin desarrollo
3. Cloudflare Pages auto-deploya
```

### Cambio en Backend (archivo individual):
```
1. Editar archivo en Backend/
2. scp -i KEY archivo root@157.245.125.216:/tmp/
3. ssh -i KEY root@IP "docker cp /tmp/archivo container:/app/ruta/ && docker restart container"
4. Verificar logs
```

### Cambio en Backend (con nuevas dependencias):
```
1. Editar archivos + package.json
2. Subir todo el Backend/ vía SCP
3. ssh -i KEY root@IP "cd /opt/sisrestaurantes/Backend && docker build -t sisrestaurantes-backend . && docker compose up -d"
```
