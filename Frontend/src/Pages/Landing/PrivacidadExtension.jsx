/**
 * Política de privacidad de la extensión de Chrome.
 *
 * Google la exige como URL pública para publicar, y la contrasta con lo que el
 * manifiesto pide: si el documento no menciona un permiso declarado, o menciona
 * recolección que el código no hace, la revisión se rechaza. Por eso acá se
 * enumeran exactamente los cinco permisos del `manifest.json` y nada más.
 */
import React from 'react';
import LegalLayout, { Seccion, Tabla, EMPRESA } from './LegalLayout';

export default function PrivacidadExtension() {
  return (
    <LegalLayout
      titulo="Privacidad de la extensión de Chrome"
      descripcion="Qué hace la extensión de MenuBy con tus datos: qué guarda, dónde lo guarda y qué no hace."
      ruta="/extension/privacidad"
    >
      <Seccion titulo="En una frase">
        <p>
          La extensión de {EMPRESA.nombre} <strong>no recoge, no transmite y no vende
          ningún dato</strong>. Todo lo que guarda se queda en tu propio navegador, y las
          únicas consultas que hace son a la API de {EMPRESA.nombre} con tu propia
          sesión — las mismas que ya hace el panel cuando lo tienes abierto.
        </p>
      </Seccion>

      <Seccion titulo="Para qué sirve">
        <p>
          Avisa al restaurante cuando entra un pedido nuevo, aunque tenga MenuBy cerrado,
          y permite saltar entre el panel, los chats de WhatsApp y el punto de venta.
        </p>
      </Seccion>

      <Seccion titulo="Qué guarda, y dónde">
        <p>
          Todo se guarda con el almacenamiento local de Chrome, en el equipo del usuario.
          Nada de esto sale del navegador ni llega a nuestros servidores por medio de la
          extensión.
        </p>
        <Tabla
          cabeceras={['Dato', 'Para qué', 'Cuánto dura']}
          filas={[
            ['Identificador del negocio (el de la dirección del menú)', 'Saber a qué panel, chats y punto de venta llevar', 'Hasta que se cambie o se desinstale'],
            ['Token de sesión de MenuBy', 'Consultar los pedidos y mensajes del propio negocio', 'Caduca a las 24 horas'],
            ['Identificadores de los pedidos ya avisados', 'No repetir el mismo aviso dos veces', 'Se reemplaza en cada revisión'],
            ['Número de pedidos pendientes y mensajes sin leer', 'Pintar el contador del ícono', 'Se reemplaza en cada revisión'],
          ]}
        />
        <p>
          El token de sesión se lee de la propia página de MenuBy, que ya lo tiene
          guardado porque el usuario inició sesión ahí. La extensión no pide contraseñas
          ni crea una credencial aparte.
        </p>
      </Seccion>

      <Seccion titulo="Los permisos que pide, uno por uno">
        <Tabla
          cabeceras={['Permiso', 'Por qué']}
          filas={[
            ['storage', 'Guardar lo de la tabla anterior en el propio navegador.'],
            ['alarms', 'Revisar cada minuto si entró un pedido. Chrome apaga las extensiones cuando están inactivas, y esta es la única forma de volver a despertar.'],
            ['notifications', 'Mostrar el aviso de pedido nuevo.'],
            ['menuby.tech', 'Leer la sesión ya iniciada y ver qué pestañas de MenuBy están abiertas, para traer al frente la correcta en vez de abrir otra.'],
            ['api.menuby.tech', 'Consultar los pedidos pendientes y los mensajes sin leer del negocio.'],
          ]}
        />
      </Seccion>

      <Seccion titulo="Qué no hace">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>No lee, modifica ni observa ninguna página que no sea de MenuBy.</li>
          <li>No envía información a servidores de terceros, ni a nosotros más allá de la API de MenuBy.</li>
          <li>No usa analítica, ni rastreadores, ni publicidad.</li>
          <li>No accede al historial, ni a marcadores, ni a contraseñas, ni al portapapeles.</li>
          <li>No vende ni cede datos a nadie, bajo ninguna circunstancia.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Cómo borrar todo">
        <p>
          Desinstalar la extensión desde <code>chrome://extensions</code> elimina todo lo
          que haya guardado. No queda nada en ningún otro lado, porque nunca salió del
          navegador.
        </p>
      </Seccion>

      <Seccion titulo="Datos del panel y del menú">
        <p>
          Esta página cubre únicamente la extensión. El tratamiento de los datos de los
          restaurantes y de las personas que hacen pedidos está en nuestra{' '}
          <a href="/privacidad" className="text-emerald-600 font-semibold hover:underline">
            política de privacidad general
          </a>.
        </p>
      </Seccion>

      <Seccion titulo="Contacto">
        <p>
          Escríbenos a <a href={`mailto:${EMPRESA.correo}`} className="text-emerald-600 font-semibold hover:underline">{EMPRESA.correo}</a>
          {' '}o al {EMPRESA.telefono}.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
