# Usar Node.js LTS (v20 - Active LTS until April 2026)
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Build tools for native modules (sharp, Baileys libsignal) + git for npm git-deps
RUN apk add --no-cache python3 make g++ git

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código fuente
COPY . .

# Crear directorios de uploads con permisos correctos
RUN mkdir -p /app/uploads/order-proofs /app/uploads/announcements /app/uploads/banners

# Crear usuario no root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Cambiar propiedad de archivos (incluye uploads)
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exponer puerto
EXPOSE 5000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=5000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]


