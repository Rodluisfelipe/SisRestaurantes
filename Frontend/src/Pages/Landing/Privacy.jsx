/**
 * Política de privacidad.
 *
 * Describe lo que el sistema hace DE VERDAD, no una plantilla: los datos que
 * aparecen acá salen de los modelos que existen (Customer, Order, WhatsAppMessage,
 * CustomerLoyalty, ViewerSession) y los terceros son los que el código llama.
 * Meta contrasta este documento con lo que la app pide, así que un texto
 * genérico se rechaza.
 */
import React from 'react';
import LegalLayout, { Seccion, Tabla, EMPRESA } from './LegalLayout';

export default function Privacy() {
  return (
    <LegalLayout
      titulo="Política de privacidad"
      descripcion="Cómo MenuBy trata los datos de los restaurantes y de las personas que hacen pedidos: qué recogemos, para qué, con quién lo compartimos y cómo ejercer tus derechos."
      ruta="/privacidad"
    >
      <Seccion titulo="Quiénes somos y qué hacemos">
        <p>
          {EMPRESA.nombre} es una plataforma que permite a restaurantes y negocios de
          {' '}{EMPRESA.pais} publicar su menú digital, recibir pedidos y atender a sus
          clientes por WhatsApp.
        </p>
        <p>
          Hay dos tipos de personas cuyos datos tratamos, y conviene distinguirlos porque
          nuestro papel es distinto en cada caso:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>El negocio</strong> que contrata MenuBy. Frente a sus datos, somos
            responsables del tratamiento.
          </li>
          <li>
            <strong>El comensal</strong> que hace un pedido en el menú de un negocio.
            Esos datos son del negocio; nosotros los tratamos por encargo suyo, para que
            el servicio funcione.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Qué datos recogemos">
        <p><strong>Del negocio:</strong></p>
        <Tabla
          cabeceras={['Dato', 'Para qué']}
          filas={[
            ['Nombre del negocio, dirección y ubicación', 'Mostrar el menú y calcular domicilios'],
            ['Correo y teléfono de contacto', 'Acceso a la cuenta, soporte y avisos del servicio'],
            ['Productos, precios, categorías y fotos', 'Publicar el menú'],
            ['Datos de la suscripción y pagos', 'Cobrar el servicio'],
          ]}
        />

        <p className="pt-2"><strong>Del comensal que hace un pedido:</strong></p>
        <Tabla
          cabeceras={['Dato', 'Para qué']}
          filas={[
            ['Nombre y teléfono', 'Identificar y entregar el pedido'],
            ['Dirección de entrega', 'Llevar el domicilio'],
            ['Detalle del pedido e historial', 'Preparar el pedido y que el negocio lo consulte'],
            ['Comprobante de pago, si lo envía', 'Que el negocio verifique el pago'],
            ['Puntos de fidelidad, si el negocio los usa', 'Aplicar sus beneficios'],
            ['Mensajes de WhatsApp con el negocio', 'Atender la conversación y tomar el pedido'],
          ]}
        />

        <p className="pt-2"><strong>De quien visita un menú, sin identificarlo:</strong></p>
        <p>
          Registramos visitas, productos vistos y de qué enlace llegó la persona, para
          que el negocio sepa qué funciona. No asociamos esa información a una identidad
          salvo que la persona haga un pedido.
        </p>
        <p className="text-slate-500">
          No pedimos ni almacenamos números de tarjeta. Los pagos con tarjeta los procesa
          la pasarela de pagos directamente.
        </p>
      </Seccion>

      <Seccion titulo="WhatsApp">
        <p>
          Si el negocio conecta su número de WhatsApp, los mensajes que intercambie con
          sus clientes pasan por la plataforma oficial de WhatsApp Business de Meta y se
          guardan en MenuBy para que el negocio pueda leerlos y responderlos desde su
          panel, igual que en cualquier bandeja de entrada.
        </p>
        <p>
          Si el negocio activa el asistente automático, el contenido del mensaje se envía
          a un proveedor de inteligencia artificial únicamente para interpretar lo que
          pide el cliente y armar el pedido. No usamos esas conversaciones para entrenar
          modelos.
        </p>
        <p>
          El uso de WhatsApp también está sujeto a las políticas de Meta. El número que
          escribe al negocio ve el nombre y el número de ese negocio, no los nuestros.
        </p>
      </Seccion>

      <Seccion titulo="Con quién compartimos datos">
        <p>
          Solo con proveedores necesarios para que el servicio funcione, y únicamente lo
          que cada uno necesita:
        </p>
        <Tabla
          cabeceras={['Proveedor', 'Para qué']}
          filas={[
            ['MongoDB Atlas', 'Base de datos'],
            ['DigitalOcean', 'Servidores y almacenamiento de imágenes'],
            ['Cloudflare', 'Entrega del sitio y seguridad'],
            ['Meta (WhatsApp Business Platform)', 'Envío y recepción de mensajes'],
            ['Groq', 'Interpretación de mensajes, si el asistente está activo'],
            ['Wompi', 'Procesamiento de pagos'],
            ['Brevo', 'Envío de correos del servicio'],
            ['Google Maps y Places', 'Ubicación y datos del negocio'],
          ]}
        />
        <p>
          No vendemos datos personales ni los cedemos a terceros con fines publicitarios.
          Algunos de estos proveedores están fuera de {EMPRESA.pais}, por lo que puede
          haber transferencia internacional de datos; al usar el servicio se entiende
          autorizada para las finalidades descritas acá.
        </p>
      </Seccion>

      <Seccion titulo="Cuánto tiempo los guardamos">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Los datos del negocio, mientras tenga cuenta activa.</li>
          <li>Los pedidos y su historial, mientras el negocio los necesite para su operación y contabilidad.</li>
          <li>Las conversaciones de WhatsApp, mientras el negocio mantenga el servicio conectado.</li>
          <li>Los datos de navegación anónimos, por periodos cortos.</li>
        </ul>
        <p>
          Si un negocio cierra su cuenta, eliminamos o anonimizamos sus datos y los de sus
          clientes, salvo lo que debamos conservar por obligación legal.
        </p>
      </Seccion>

      <Seccion titulo="Tus derechos">
        <p>
          De acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013 de {EMPRESA.pais},
          puedes conocer, actualizar y rectificar tus datos, pedir prueba de la
          autorización, ser informado del uso que les damos, presentar quejas ante la
          Superintendencia de Industria y Comercio, y revocar la autorización o pedir la
          supresión cuando no exista un deber legal de conservarlos.
        </p>
        <p>
          Para ejercerlos escribe a{' '}
          <a href={`mailto:${EMPRESA.correo}`} className="text-emerald-600 hover:underline">
            {EMPRESA.correo}
          </a>{' '}
          indicando tu solicitud. Respondemos en los plazos que fija la ley.
        </p>
        <p className="text-slate-500">
          Si eres cliente de un restaurante y quieres que borren tus datos, puedes
          escribirnos a nosotros o directamente al negocio: los datos son suyos y
          nosotros los tratamos por encargo.
        </p>
      </Seccion>

      <Seccion titulo="Seguridad">
        <p>
          Ciframos las conexiones, guardamos las contraseñas con funciones de un solo
          sentido y las credenciales de terceros cifradas. El acceso a los datos de un
          negocio está limitado a ese negocio. Hacemos copias de seguridad diarias.
        </p>
        <p className="text-slate-500">
          Ningún sistema es infalible. Si ocurriera un incidente que afecte datos
          personales, lo comunicaremos a los afectados y a la autoridad competente.
        </p>
      </Seccion>

      <Seccion titulo="Cambios">
        <p>
          Si cambiamos esta política, actualizaremos la fecha del encabezado. Cuando el
          cambio sea relevante, avisaremos a los negocios por correo o desde el panel.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
