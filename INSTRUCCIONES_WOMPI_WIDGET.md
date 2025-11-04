# 📋 INSTRUCCIONES: Widget Wompi y Reactivación Automática

## ✅ Cambios Desplegados

1. ✅ Webhook `/api/webhooks/wompi` - Recibe confirmaciones de pago
2. ✅ Widget embebido en `SubscriptionPaymentCard` - Modal con iframe
3. ✅ Polling automático - Verifica estado del pago cada 3 segundos
4. ✅ Websocket - Actualización en tiempo real
5. ✅ Hook `useBusinessSocket` - Conecta al socket del negocio

---

## 🔧 PASOS PARA CONFIGURAR

### 1. Configurar Variables de Entorno en el Servidor

Conecta al servidor y edita el archivo `.env` dentro del contenedor:

```bash
# Conectarte al servidor
ssh -i ~/.ssh/sisrestaurantes_key root@157.245.125.216

# Editar el .env del contenedor
docker exec -it sisrestaurantes-backend sh -c "nano .env"
```

Agrega estas variables (o reemplaza si ya existen):

```env
# Wompi Configuration
WOMPI_API_URL=https://production.wompi.co/v1
# O para testing: https://sandbox.wompi.co/v1

WOMPI_PUBLIC_KEY=pub_prod_XXXXXXXXXXXXXXXX
WOMPI_PRIVATE_KEY=prv_prod_XXXXXXXXXXXXXXXX
WOMPI_INTEGRITY_KEY=int_XXXXXXXXXXXXXXXX

# Subscription Prices
SUBSCRIPTION_MONTHLY_PRICE=50000
SUBSCRIPTION_ANNUAL_PRICE=500000

# Frontend URL (para redirects después del pago)
FRONTEND_URL=https://www.menuby.tech
```

**Después de guardar, reinicia el contenedor:**

```bash
docker restart sisrestaurantes-backend
```

---

### 2. Configurar Webhook en el Dashboard de Wompi

1. **Inicia sesión en el Dashboard de Wompi:**
   - URL: https://comercios.wompi.co/
   - Accede con tus credenciales

2. **Navega a la sección de Webhooks:**
   - Busca "Webhooks" o "Notificaciones" en el menú

3. **Crea un nuevo webhook:**
   - **URL del webhook:** `https://157-245-125-216.nip.io/api/webhooks/wompi`
   - **Método:** `POST`
   - **Eventos a escuchar:**
     - ✅ `TRANSACTION_APPROVED` (Pago aprobado)
     - ✅ `TRANSACTION_DECLINED` (Pago rechazado)
     - ✅ `TRANSACTION_VOIDED` (Transacción cancelada)
   - **Headers:** Wompi automáticamente enviará `x-wompi-signature` para validación

4. **Guarda el webhook**

⚠️ **NOTA:** Si estás en producción, deberás cambiar la URL a tu dominio real (ej: `https://api.menuby.tech/api/webhooks/wompi`)

---

### 3. Verificar que el Frontend Esté Actualizado

Los cambios en el frontend están listos localmente. Si necesitas desplegarlos:

**Para Vercel:**
```bash
cd Frontend
git add .
git commit -m "feat: Widget Wompi embebido con reactivación automática"
git push origin main
```

**O manualmente desde Vercel dashboard:**
- Ve a tu proyecto en Vercel
- Deploy → "Redeploy" o push a GitHub

---

## 🧪 PRUEBAS

### Prueba 1: Crear Checkout

1. Accede al panel Admin: `https://www.menuby.tech/admin`
2. Ve a la sección "Mi Suscripción" (tab 💳)
3. Haz clic en "Pagar / Renovar ahora"
4. **Verifica que:**
   - Se abre un modal con el checkout de Wompi
   - El iframe carga correctamente
   - Se muestra "Verificando pago..." mientras procesa

### Prueba 2: Probar Pago (Sandbox)

**Si estás usando Wompi Sandbox:**

1. Usa estas tarjetas de prueba:
   - **Aprobada:** `4242424242424242`
   - **Rechazada:** `4000000000000002`
   - CVV: cualquier 3 dígitos
   - Fecha: cualquier fecha futura

2. **Flujo esperado:**
   - Completas el pago en el iframe
   - Wompi envía webhook → Backend reactiva suscripción
   - Frontend detecta cambio (polling/socket)
   - Modal muestra "¡Pago Confirmado!"
   - Suscripción se actualiza automáticamente

### Prueba 3: Verificar Webhook

**Puedes probar el webhook manualmente:**

```bash
curl -X POST https://157-245-125-216.nip.io/api/webhooks/wompi \
  -H "Content-Type: application/json" \
  -d '{
    "event": "TRANSACTION_APPROVED",
    "data": {
      "transaction": {
        "id": "12345",
        "status": "APPROVED",
        "reference": "TEST_REF"
      }
    }
  }'
```

**O verifica los logs del servidor:**

```bash
ssh -i ~/.ssh/sisrestaurantes_key root@157.245.125.216
docker logs sisrestaurantes-backend --tail 50 | grep -i "webhook\|wompi\|subscription"
```

---

## 🔍 SOLUCIÓN DE PROBLEMAS

### Problema 1: "Servicio de pagos no configurado"

**Solución:**
- Verifica que las variables `WOMPI_PUBLIC_KEY` y `WOMPI_PRIVATE_KEY` estén en el `.env`
- Reinicia el contenedor: `docker restart sisrestaurantes-backend`

### Problema 2: Webhook no recibe notificaciones

**Solución:**
- Verifica que la URL del webhook sea accesible públicamente
- Prueba con `curl` o Postman enviando un POST a `/api/webhooks/wompi`
- Revisa los logs del servidor para errores
- Asegúrate de que Wompi tenga la URL correcta configurada

### Problema 3: El modal no se cierra después del pago

**Solución:**
- Verifica que el websocket esté conectado (revisa consola del navegador)
- Verifica que el polling esté funcionando (revisa Network tab)
- Revisa los logs del backend para confirmar que el webhook llegó

### Problema 4: "Invalid Wompi webhook signature"

**Solución:**
- Verifica que `WOMPI_INTEGRITY_KEY` esté configurado correctamente
- Wompi usa esta key para firmar los webhooks
- Si no tienes la key, puedes deshabilitar temporalmente la validación (solo para desarrollo)

---

## 📊 MONITOREO

### Ver logs en tiempo real:

```bash
ssh -i ~/.ssh/sisrestaurantes_key root@157.245.125.216
docker logs -f sisrestaurantes-backend | grep -i "wompi\|subscription\|webhook"
```

### Verificar estado del servidor:

```bash
docker exec sisrestaurantes-backend curl -f http://localhost:5000/api/health
```

---

## ✅ CHECKLIST FINAL

- [ ] Variables de entorno configuradas en `.env`
- [ ] Contenedor reiniciado
- [ ] Webhook configurado en Wompi dashboard
- [ ] URL del webhook accesible públicamente
- [ ] Frontend desplegado (si es necesario)
- [ ] Prueba de checkout realizada
- [ ] Prueba de pago con tarjeta de prueba
- [ ] Verificación de reactivación automática
- [ ] Logs verificados sin errores

---

## 📚 DOCUMENTACIÓN ADICIONAL

- **Wompi API Docs:** https://docs.wompi.co/
- **Webhook Events:** https://docs.wompi.co/colombia/eventos
- **Sandbox Testing:** https://docs.wompi.co/colombia/ambiente-de-pruebas

---

## 🎯 RESUMEN

**Lo que acabas de implementar:**

1. ✅ Widget embebido de Wompi en el panel admin
2. ✅ Reactivación automática cuando se confirma el pago
3. ✅ Actualización en tiempo real vía websocket
4. ✅ Polling como respaldo para verificar estado
5. ✅ Webhook seguro con validación de firma

**Flujo completo:**
```
Usuario hace clic "Pagar"
  ↓
Se crea checkout en Wompi
  ↓
Modal muestra iframe con checkout
  ↓
Usuario completa pago
  ↓
Wompi envía webhook → Backend reactiva suscripción
  ↓
Frontend detecta cambio → Muestra éxito → Cierra modal
```

¡Todo listo! 🚀

