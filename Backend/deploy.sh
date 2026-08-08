#!/usr/bin/env bash
#
# Despliegue solapado (blue/green) del backend.
#
# Antes, el deploy apagaba el contenedor y levantaba el nuevo en el mismo
# puerto: durante 30-60 segundos nginx no tenía a quién hablarle y los
# comensales recibían 502. Con un negocio haciendo más de 500 pedidos al mes,
# eso son pedidos perdidos en cada despliegue.
#
# Ahora el contenedor nuevo se levanta en el otro puerto, se comprueba que
# responde sano, y recién entonces se cambia nginx y se apaga el viejo. Si el
# nuevo no arranca bien NO se toca nginx: el viejo sigue atendiendo y el
# despliegue falla ruidosamente, que es mejor que quedarse sin servicio.
#
set -euo pipefail

REPO=/opt/sisrestaurantes
UPSTREAM=/etc/nginx/conf.d/menuby-upstream.conf
AZUL=5000
VERDE=5001
ESPERA_MAX=90          # segundos que se le dan al contenedor nuevo
PROYECTO_BASE=backend

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ── 1. Qué color está atendiendo ahora ──────────────────────────────────────
PUERTO_ACTUAL=$(grep -oE '127\.0\.0\.1:[0-9]+' "$UPSTREAM" | grep -oE '[0-9]+$' || echo "$AZUL")
if [ "$PUERTO_ACTUAL" = "$AZUL" ]; then
  PUERTO_NUEVO=$VERDE; COLOR_NUEVO=green; COLOR_VIEJO=blue
else
  PUERTO_NUEVO=$AZUL;  COLOR_NUEVO=blue;  COLOR_VIEJO=green
fi
PROY_NUEVO="${PROYECTO_BASE}-${COLOR_NUEVO}"
PROY_VIEJO="${PROYECTO_BASE}-${COLOR_VIEJO}"

log "Atendiendo en :$PUERTO_ACTUAL ($COLOR_VIEJO) → se levanta :$PUERTO_NUEVO ($COLOR_NUEVO)"

cd "$REPO/Backend"

# ── 2. Construir ────────────────────────────────────────────────────────────
log "Construyendo imagen..."
HOST_PORT=$PUERTO_NUEVO docker compose -p "$PROY_NUEVO" build

# ── 3. Levantar el nuevo, sin tocar el viejo ────────────────────────────────
log "Levantando $COLOR_NUEVO en :$PUERTO_NUEVO..."
HOST_PORT=$PUERTO_NUEVO docker compose -p "$PROY_NUEVO" up -d --force-recreate

# ── 4. Esperar a que responda sano ──────────────────────────────────────────
log "Esperando a que :$PUERTO_NUEVO responda..."
SANO=0
for i in $(seq 1 $ESPERA_MAX); do
  if curl -sf --max-time 3 "http://127.0.0.1:$PUERTO_NUEVO/api/health" >/dev/null 2>&1; then
    SANO=1
    log "Sano tras ${i}s"
    break
  fi
  sleep 1
done

if [ "$SANO" != "1" ]; then
  log "ERROR: el contenedor nuevo no respondió en ${ESPERA_MAX}s"
  log "Se apaga el nuevo. nginx NO se tocó: $COLOR_VIEJO sigue atendiendo en :$PUERTO_ACTUAL"
  HOST_PORT=$PUERTO_NUEVO docker compose -p "$PROY_NUEVO" logs --tail 30 || true
  HOST_PORT=$PUERTO_NUEVO docker compose -p "$PROY_NUEVO" down || true
  exit 1
fi

# ── 5. Cambiar nginx ────────────────────────────────────────────────────────
# La recarga es elegante: las peticiones en curso terminan contra el viejo y
# las nuevas entran al nuevo. Por eso el traspaso no se nota.
log "Cambiando nginx a :$PUERTO_NUEVO..."
sed -i "s|server 127\.0\.0\.1:[0-9]*;|server 127.0.0.1:$PUERTO_NUEVO;|" "$UPSTREAM"

if ! nginx -t >/dev/null 2>&1; then
  log "ERROR: la configuración de nginx quedó inválida. Se revierte."
  sed -i "s|server 127\.0\.0\.1:[0-9]*;|server 127.0.0.1:$PUERTO_ACTUAL;|" "$UPSTREAM"
  HOST_PORT=$PUERTO_NUEVO docker compose -p "$PROY_NUEVO" down || true
  exit 1
fi

systemctl reload nginx
log "nginx apunta a :$PUERTO_NUEVO"

# ── 6. Comprobar por la puerta de entrada real ──────────────────────────────
sleep 2
if ! curl -sf --max-time 10 "https://api.menuby.tech/api/health" >/dev/null 2>&1; then
  log "ERROR: el dominio público no responde. Se vuelve a :$PUERTO_ACTUAL"
  sed -i "s|server 127\.0\.0\.1:[0-9]*;|server 127.0.0.1:$PUERTO_ACTUAL;|" "$UPSTREAM"
  systemctl reload nginx
  HOST_PORT=$PUERTO_NUEVO docker compose -p "$PROY_NUEVO" down || true
  exit 1
fi

# ── 7. Recién ahora se apaga el viejo ───────────────────────────────────────
# Se le dan unos segundos para que terminen las peticiones que ya estaban en
# curso contra él.
log "Apagando $COLOR_VIEJO..."
sleep 5
HOST_PORT=$PUERTO_ACTUAL docker compose -p "$PROY_VIEJO" down 2>/dev/null || true

# Antes de esto el contenedor vivía en el proyecto "backend", sin color. En el
# primer despliegue solapado hay que apagarlo también o se queda corriendo para
# siempre, ocupando memoria y con los crons registrados.
if docker ps --format '{{.Names}}' | grep -qx 'backend-backend-1'; then
  log "Apagando el contenedor anterior sin color (backend-backend-1)..."
  HOST_PORT=$PUERTO_ACTUAL docker compose -p backend down 2>/dev/null || true
fi

# Solo capas huérfanas. Antes era `prune -af`, que borra toda imagen sin un
# contenedor asociado: ahorra unos megas y, si algo dejó al contenedor nuevo
# fuera de juego un instante, se lleva por delante la única imagen con la que
# se podía volver atrás. El disco está al 25%; no vale la pena.
docker image prune -f >/dev/null 2>&1 || true

# ── 8. Comprobar de verdad que quedó sirviendo ──────────────────────────────
# El script llegó a decir "sin corte de servicio" mientras el sitio devolvía
# 502: daba por bueno el chequeo hecho ANTES de apagar el viejo y de limpiar,
# sin volver a mirar al final. Ahora se pregunta por el puerto que nginx tiene
# configurado, que es el camino real de un comensal.
PUERTO_FINAL=$(grep -oE '127\.0\.0\.1:[0-9]+' "$UPSTREAM" | grep -oE '[0-9]+$')
for intento in $(seq 1 10); do
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PUERTO_FINAL}/api/health" || echo 000)
  [ "$CODIGO" = "200" ] && break
  sleep 3
done

if [ "$CODIGO" != "200" ]; then
  log "ALERTA: el despliegue terminó pero :$PUERTO_FINAL no responde (HTTP $CODIGO)."
  log "Levantando de nuevo $COLOR_NUEVO para no dejar el sitio caído..."
  HOST_PORT=$PUERTO_NUEVO docker compose -p "$PROY_NUEVO" up -d
  sleep 10
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PUERTO_FINAL}/api/health" || echo 000)
  if [ "$CODIGO" != "200" ]; then
    log "SIGUE CAÍDO (HTTP $CODIGO). Hay que revisar a mano: docker ps -a && docker logs"
    exit 1
  fi
  log "Recuperado."
fi

log "Listo. Atendiendo en :$PUERTO_NUEVO ($COLOR_NUEVO), comprobado con HTTP $CODIGO."
