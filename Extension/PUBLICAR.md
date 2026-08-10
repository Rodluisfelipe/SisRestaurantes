# Publicar en la Chrome Web Store

Todo lo que pide el formulario, listo para copiar y pegar.
Panel de control: https://chrome.google.com/webstore/devconsole

---

## 1. El archivo que se sube

**`Extension/menuby-extension-tienda.zip`**

Ese, no el otro. El de `Frontend/public/menuby-extension.zip` tiene los archivos
dentro de una carpeta —así el que instala a mano sabe cuál elegir— y la tienda
lo rechaza: exige `manifest.json` en la raíz del zip.

Se generan los dos con:

```bash
node scripts/empacar-extension.cjs
```

---

## 2. Nombre

```
MenuBy — Pedidos, WhatsApp y POS
```

*(Máximo 75 caracteres. Este usa 32.)*

---

## 3. Descripción breve

```
Te avisa de cada pedido nuevo aunque tengas MenuBy cerrado, y saltas entre el panel, los chats y el punto de venta.
```

*(Máximo 132 caracteres. Este usa 114.)*

---

## 4. Descripción detallada

```
Para restaurantes que usan MenuBy.

AVISA DE CADA PEDIDO, AUNQUE TENGAS MENUBY CERRADO

Una página web solo funciona mientras la tienes abierta. Si cierras el panel
para atender, nadie está mirando si entró un pedido. Esta extensión sí: revisa
cada minuto y te avisa apenas llega uno, con el número, el cliente y el valor.
El aviso se queda en pantalla hasta que lo mires, y al tocarlo abre tus pedidos.

En el ícono de Chrome llevas siempre el contador: pedidos pendientes en rojo,
mensajes de WhatsApp sin leer en verde.

SALTA ENTRE TUS TRES PANTALLAS

Panel, chats de WhatsApp y punto de venta, en un clic o con Alt+1, Alt+2 y
Alt+3. Los atajos funcionan desde cualquier pestaña de Chrome.

Y si la pantalla ya está abierta, la trae al frente sin recargarla: tu punto de
venta conserva el pedido a medio armar y tus chats el mensaje a medio escribir.

SIN CONFIGURAR NADA

Reconoce tu negocio de la sesión que ya tienes abierta en MenuBy. No pide
usuario ni contraseña aparte.

PRIVACIDAD

No recoge ni envía ningún dato. Todo lo que guarda se queda en tu navegador, y
las únicas consultas que hace son a la API de MenuBy con tu propia sesión — las
mismas que ya hace el panel. No toca ninguna otra página.

Necesitas una cuenta activa de MenuBy (menuby.tech).
```

---

## 5. Categoría e idioma

- **Categoría:** Flujo de trabajo y planificación *(Workflow & Planning)*
- **Idioma:** Español

---

## 6. Propósito único

Google exige que la extensión haga **una sola cosa**. Esta es la respuesta:

```
Notificar al restaurante de los pedidos nuevos que entran a su cuenta de MenuBy
y darle acceso directo a las tres pantallas de trabajo de la plataforma.
```

---

## 7. Justificación de cada permiso

Se piden una por una. Copia la que corresponda:

| Permiso | Justificación |
| --- | --- |
| `storage` | Guardar en el navegador el negocio seleccionado, la sesión y qué pedidos ya se notificaron, para no repetir el mismo aviso. |
| `alarms` | Revisar cada minuto si entraron pedidos nuevos. En Manifest V3 el service worker se suspende, y las alarmas son la única forma de reanudar la comprobación. |
| `notifications` | Mostrar al restaurante el aviso de que entró un pedido nuevo. |
| `host_permissions` (menuby.tech) | Leer la sesión que el usuario ya inició en MenuBy y detectar qué pestañas de la aplicación están abiertas, para enfocar la existente en vez de duplicarla. |
| `host_permissions` (api.menuby.tech) | Consultar los pedidos pendientes y los mensajes sin leer de la cuenta del usuario. |

**Código remoto:** responder **No**. Todo el código va dentro del paquete; no se
carga nada desde fuera.

---

## 8. Privacidad

- **URL de la política:** `https://www.menuby.tech/extension/privacidad`
- **¿Vende datos a terceros?** No
- **¿Los usa para algo ajeno a su propósito?** No
- **¿Los usa para evaluar solvencia o prestar dinero?** No

En la tabla de tipos de datos, marca únicamente **Información de autenticación**
y en el motivo: *para operar la función principal de la extensión*. No marques
las demás — el código no las toca, y una casilla de más obliga a justificarla.

---

## 9. Lo que tienes que hacer tú

- [ ] **Captura de 1280×800.** Al menos una; se aceptan hasta cinco. La mejor:
      el popup abierto con el contador en rojo sobre el panel de pedidos.
      Con la ventana de Chrome a 1280 de ancho, `Win + Shift + S` y recortas.
- [ ] **Verificar el correo y el teléfono** que se publicarán como comerciante.
- [ ] **Dirección de negocio, no la de tu casa** — se muestra pública en la ficha.

---

## 10. Después de publicar

La revisión tarda entre unas horas y dos semanas. Cuando esté aprobada:

1. Copia el enlace de la ficha.
2. En [`ExtensionChrome.jsx`](../Frontend/src/Components/Admin/ExtensionChrome.jsx),
   reemplaza el botón de descarga y los cinco pasos por un enlace a esa ficha.
3. Ahí se acaban las dos advertencias que hoy hay que dar: la extensión pasa a
   actualizarse sola y ya no depende de una carpeta que nadie debe borrar.

Para cada versión nueva: sube el número en `manifest.json`, regenera el zip y
sube el paquete. Chrome actualiza a todos los usuarios en unas horas.
