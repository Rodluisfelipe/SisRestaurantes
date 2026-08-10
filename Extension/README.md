# Extensión MenuBy

Salta entre **Panel**, **WhatsApp** y **POS** desde cualquier pestaña de Chrome.

## Qué hace que valga la pena

Un enlace normal recarga la página. Esta extensión, en cambio:

- **Trae al frente la pestaña que ya está abierta** en vez de cargarla otra vez.
  Y no la toca: el POS conserva el pedido a medio armar y los chats el mensaje
  a medio escribir.
- **Una pestaña por pantalla.** Las tres tienen su propia dirección
  (`/admin`, `/whatsapp`, `/pos`), así que las tres pueden quedarse abiertas
  toda la jornada sin pisarse.
- **Atajos de teclado en todo Chrome** — `Alt+1`, `Alt+2`, `Alt+3` — funcionan
  aunque MenuBy no esté al frente. Una página web solo escucha el teclado
  mientras está activa; una extensión, siempre.

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
| `background.js` | Escucha los atajos de teclado |
| `popup.html` / `popup.js` | La ventanita del ícono |

## Permisos, y por qué son esos

- `storage` — guardar el nombre del negocio. Nada más.
- `menuby.tech/*` — mirar qué pestañas de MenuBy hay abiertas para traer la
  correcta al frente.

No lee ninguna otra página, no manda nada a ningún servidor y no rastrea nada.

## Si algún día se publica en la Chrome Web Store

Hacen falta: cuenta de desarrollador (25 USD, pago único), un ícono de 128×128,
capturas de pantalla y una política de privacidad. La revisión tarda entre días
y un par de semanas. Cargándola a mano funciona igual — solo hay que repetir la
instalación en cada computador.
