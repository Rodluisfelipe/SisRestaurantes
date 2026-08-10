# Extensión MenuBy

Salta entre **Panel**, **WhatsApp** y **POS** desde cualquier pestaña de Chrome.

## Qué hace que valga la pena

Todo esto es cosa que una página web **no puede hacer**, por diseño del
navegador. Ese es el único motivo de que exista la extensión.

### Avisa de un pedido nuevo con MenuBy cerrado

Una página solo corre mientras su pestaña existe. Si cierran el panel —o Chrome
entero— nadie mira si entró un pedido. `vigilante.js` vive en el service worker,
despierta cada minuto y lanza un aviso del sistema que **se queda en pantalla
hasta que alguien lo mire** (`requireInteraction`). Tocarlo abre los pedidos.

Dos reglas que parecen detalles y no lo son:

- **Avisa por identificador, no por cantidad.** Si en el mismo minuto entra un
  pedido y se despacha otro, un contador va de 2 a 2 y el nuevo pasa en
  silencio. Comparando identificadores, no.
- **La primera revisión no avisa.** Quien instala con cinco pedidos en cola no
  recibe cinco avisos de golpe por pedidos que ya conocía.

### El contador en el ícono de Chrome

Pedidos pendientes en rojo; si no hay, chats sin leer en verde. Los pedidos
mandan: un pedido sin atender se enfría, un mensaje espera.

### No recarga lo que ya está abierto

Trae la pestaña al frente **sin tocarla**: el POS conserva el pedido a medio
armar y los chats el mensaje a medio escribir. Las tres pantallas tienen
dirección propia (`/admin`, `/whatsapp`, `/pos`), así que las tres pueden estar
abiertas a la vez sin pisarse.

### Atajos en todo Chrome

`Alt+1`, `Alt+2`, `Alt+3` funcionan aunque MenuBy no esté al frente. Una página
web solo escucha el teclado mientras está activa.

## De dónde saca la sesión

`contenido.js` corre dentro de las páginas de MenuBy y lee el token que el panel
ya guarda, junto con el negocio. Así no hay que pedir usuario y contraseña
aparte —otra credencial que cuidar y que se desincroniza al cambiarla.

El token dura **24 horas**. Un restaurante abre su panel a diario, así que en la
práctica está siempre vigilando; si pasan más de 24 horas sin abrir MenuBy, la
extensión se queda callada hasta que lo abran y lo dice en el popup en vez de
mostrar un cero engañoso.

La sesión no sale de la extensión: se usa contra la misma API que usa el panel.

## Al cambiar algo acá, regenera los zips

```bash
node scripts/empacar-extension.cjs
```

Genera **dos**, y no son intercambiables:

| Archivo | Para qué | Estructura |
| --- | --- | --- |
| `Frontend/public/menuby-extension.zip` | El botón de descarga del panel | Dentro de una carpeta `menuby-extension/`, para que quien instala a mano sepa cuál elegir |
| `Extension/menuby-extension-tienda.zip` | Subir a la Chrome Web Store | `manifest.json` en la raíz — la tienda rechaza el otro |

**No se generan solos.** Si tocas algo de esta carpeta y no los regeneras, los
restaurantes se siguen bajando la versión vieja sin que nada lo avise.

Para publicar, todo lo que pide el formulario está en [PUBLICAR.md](PUBLICAR.md).

## Instalar

No está en la Chrome Web Store, así que se carga a mano. Toma un minuto y no
hay que repetirlo: queda instalada.

1. Abre `chrome://extensions` en Chrome (o Edge, o Brave).
2. Enciende **Modo de desarrollador**, arriba a la derecha.
3. Clic en **Cargar descomprimida**.
4. Elige esta carpeta (`Extension`).
5. Clic en el ícono de piezas de la barra de Chrome y ancla MenuBy para tenerlo
   siempre a la vista.

La primera vez te pregunta cuál es tu negocio. Si ya tienes MenuBy abierto en
esa pestaña, lo detecta solo y no pregunta nada.

## Cambiar los atajos

`chrome://extensions/shortcuts`. Ahí se puede poner cualquier combinación, o
dejarlos en blanco si estorban.

## Cambiar de negocio

Clic en el ícono → **Cambiar**. Acepta el nombre solo (`doggitos`) o la
dirección entera pegada.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `manifest.json` | Permisos, atajos e íconos |
| `comun.js` | Las tres direcciones y cómo llegar sin romper lo abierto |
| `contenido.js` | Lee la sesión desde las páginas de MenuBy |
| `vigilante.js` | Revisa pedidos y chats cada minuto; contador y avisos |
| `background.js` | Atajos de teclado, el reloj y los mensajes |
| `popup.html` / `popup.js` | La ventanita del ícono |

## Permisos, y por qué son esos

- `storage` — guardar el negocio, la sesión y qué pedidos ya se avisaron.
- `alarms` — el reloj de un minuto. En Manifest V3 Chrome apaga el service
  worker a los segundos, así que un `setInterval` no sobreviviría.
- `notifications` — los avisos de pedido nuevo.
- `menuby.tech/*` — leer la sesión y ver qué pestañas hay abiertas.
- `api.menuby.tech/*` — preguntar por pedidos y mensajes.

No toca ninguna otra página, no manda nada a servidores de terceros y no
rastrea nada.

## Lo que esta versión todavía no hace

- **No suena.** El aviso es visual. Reproducir sonido en Manifest V3 obliga a
  un documento *offscreen*, que es otra pieza y otra revisión.
- **No avisa con Chrome cerrado del todo.** El service worker necesita que el
  navegador esté corriendo, aunque sea sin pestañas de MenuBy.
- **Un solo negocio a la vez.** Quien administre varios tiene que cambiarlo a
  mano desde el popup.

## Si algún día se publica en la Chrome Web Store

Hacen falta: cuenta de desarrollador (25 USD, pago único), un ícono de 128×128,
capturas de pantalla y una política de privacidad. La revisión tarda entre días
y un par de semanas. Cargándola a mano funciona igual — solo hay que repetir la
instalación en cada computador.
