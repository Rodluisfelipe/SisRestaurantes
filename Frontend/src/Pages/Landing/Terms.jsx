/**
 * Términos y condiciones.
 *
 * El registro obligaba a aceptarlos y la ruta mostraba la página de inicio.
 * El contenido describe el servicio tal como funciona hoy: suscripción mensual,
 * complementos que se contratan aparte, y la relación real entre MenuBy, el
 * negocio y el comensal.
 */
import React from 'react';
import LegalLayout, { Seccion, EMPRESA } from './LegalLayout';

export default function Terms() {
  return (
    <LegalLayout
      titulo="Términos y condiciones"
      descripcion="Condiciones de uso de MenuBy: qué incluye el servicio, cómo funcionan la suscripción y los complementos, y las responsabilidades de cada parte."
      ruta="/terminos"
    >
      <Seccion titulo="Qué es este acuerdo">
        <p>
          Estas condiciones regulan el uso de {EMPRESA.nombre} por parte de los negocios
          que contratan el servicio. Al crear una cuenta, el negocio las acepta.
        </p>
        <p>
          Quien contrata declara estar autorizado para representar al negocio y ser mayor
          de edad.
        </p>
      </Seccion>

      <Seccion titulo="Qué ofrecemos">
        <p>
          MenuBy es una herramienta para que un negocio publique su menú, reciba pedidos
          y atienda a sus clientes. <strong>No vendemos comida ni intervenimos en la
          relación entre el negocio y su cliente.</strong>
        </p>
        <p>
          Eso significa que el negocio es el único responsable de sus precios, de la
          disponibilidad de sus productos, de la calidad de lo que prepara, de los tiempos
          de entrega, de sus domicilios, de la facturación al cliente y del cumplimiento
          de las normas sanitarias y comerciales que le apliquen.
        </p>
      </Seccion>

      <Seccion titulo="Suscripción y complementos">
        <p>
          El servicio se cobra por suscripción mensual o anual, según el plan elegido.
          Algunas funciones se contratan aparte como complementos, con su propio precio y,
          cuando aplique, con un cupo de uso incluido que se indica al contratarlo.
        </p>
        <p>
          Los precios se publican en el sitio y pueden cambiar. Un cambio de precio no
          afecta un periodo ya pagado, y se avisa antes de la siguiente renovación.
        </p>
        <p>
          Si un pago no se completa, el servicio entra en un periodo de gracia y después
          se suspende. Los datos no se borran de inmediato: el negocio puede ponerse al
          día y recuperar su cuenta.
        </p>
        <p>
          El negocio puede cancelar cuando quiera; el servicio sigue disponible hasta el
          final del periodo pagado. No hay devoluciones por periodos ya iniciados, salvo
          que la ley lo exija.
        </p>
      </Seccion>

      <Seccion titulo="WhatsApp">
        <p>
          Si el negocio conecta su número, lo hace bajo su propia cuenta de WhatsApp
          Business y acepta también las políticas de Meta. El negocio es responsable del
          contenido que se envíe desde su número y de contar con el consentimiento de las
          personas a las que escriba.
        </p>
        <p>
          Si el negocio activa el asistente automático, entiende que es una herramienta de
          apoyo: puede equivocarse, y el negocio debe revisar los pedidos antes de
          prepararlos. MenuBy no responde por un pedido mal tomado que el negocio no
          verificó.
        </p>
        <p>
          Meta puede restringir o suspender un número por incumplir sus políticas. Eso
          está fuera de nuestro control.
        </p>
      </Seccion>

      <Seccion titulo="Uso aceptable">
        <p>El negocio se compromete a no usar MenuBy para:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Vender productos cuya comercialización esté prohibida.</li>
          <li>Enviar mensajes masivos no solicitados.</li>
          <li>Publicar información falsa sobre precios o productos.</li>
          <li>Intentar acceder a datos de otros negocios o alterar el funcionamiento del servicio.</li>
          <li>Suplantar a otra persona o negocio.</li>
        </ul>
        <p>
          Podemos suspender una cuenta que incumpla lo anterior, avisando cuando sea
          posible.
        </p>
      </Seccion>

      <Seccion titulo="Datos">
        <p>
          Los datos de los clientes del negocio son del negocio. Nosotros los tratamos
          por encargo suyo para prestar el servicio, según lo descrito en nuestra{' '}
          <a href="/privacidad" className="text-emerald-600 hover:underline">política de privacidad</a>.
        </p>
        <p>
          El negocio es responsable de informar a sus clientes sobre el tratamiento de sus
          datos y de obtener su autorización cuando la ley lo exija.
        </p>
      </Seccion>

      <Seccion titulo="Disponibilidad y responsabilidad">
        <p>
          Trabajamos para que el servicio esté disponible de forma continua, pero puede
          haber interrupciones por mantenimiento, fallos de proveedores o causas fuera de
          nuestro alcance. No garantizamos disponibilidad ininterrumpida.
        </p>
        <p>
          Nuestra responsabilidad frente al negocio se limita al valor que haya pagado por
          el servicio en los tres meses anteriores al hecho que la origine. No respondemos
          por lucro cesante ni por pérdidas indirectas.
        </p>
        <p className="text-slate-500">
          Nada de esto limita los derechos que la ley colombiana reconozca de forma
          irrenunciable.
        </p>
      </Seccion>

      <Seccion titulo="Cambios y ley aplicable">
        <p>
          Podemos actualizar estas condiciones. Si el cambio es relevante, avisaremos por
          correo o desde el panel antes de que aplique. Seguir usando el servicio después
          de un cambio implica aceptarlo.
        </p>
        <p>
          Este acuerdo se rige por las leyes de {EMPRESA.pais}. Cualquier controversia se
          resolverá ante los jueces competentes de {EMPRESA.pais}.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
