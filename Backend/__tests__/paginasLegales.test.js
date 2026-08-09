/**
 * Las páginas legales tienen que existir de verdad.
 *
 * El registro obliga a aceptar términos y política de privacidad, pero /terms
 * mostraba la página de inicio y /privacy no tenía ni ruta. Y Meta exige una URL
 * de política de privacidad real para aprobar la conexión de números de WhatsApp
 * de terceros: un revisor que abre la landing rechaza la solicitud.
 */
const fs = require('fs');
const path = require('path');

const front = (...p) => fs.readFileSync(
  path.join(__dirname, '..', '..', 'Frontend', 'src', ...p), 'utf8',
);
const app = front('App.jsx');
const privacidad = front('Pages', 'Landing', 'Privacy.jsx');
const terminos = front('Pages', 'Landing', 'Terms.jsx');
const registro = front('Pages', 'Landing', 'Register.jsx');

describe('las páginas legales existen', () => {
  it('las rutas apuntan a las páginas, no a la landing', () => {
    for (const ruta of ['/privacidad', '/privacy']) {
      expect(app).toMatch(new RegExp(`path="${ruta}" element=\\{<LegalPrivacy`));
    }
    for (const ruta of ['/terminos', '/terms']) {
      expect(app).toMatch(new RegExp(`path="${ruta}" element=\\{<LegalTerms`));
    }
    // Lo que había antes: /terms renderizaba la portada.
    expect(app).not.toMatch(/path="\/terms" element=\{<LandingHome/);
  });

  it('el registro enlaza a rutas que existen', () => {
    // Obliga a aceptarlos, así que tienen que poder leerse.
    const enlaces = [...registro.matchAll(/<Link to="(\/(?:terms|terminos|privacy|privacidad))"/g)]
      .map((m) => m[1]);
    expect(enlaces.length).toBeGreaterThan(0);
    for (const enlace of enlaces) {
      expect(app).toContain(`path="${enlace}"`);
    }
  });

  it('Cloudflare no confunde las rutas legales con un negocio', () => {
    // Sin reservarlas, la función buscaría un restaurante llamado "privacidad".
    const funcion = fs.readFileSync(
      path.join(__dirname, '..', '..', 'Frontend', 'functions', '[[slug]].js'), 'utf8',
    );
    for (const ruta of ['terms', 'privacy', 'terminos', 'privacidad']) {
      expect(funcion).toContain(`'${ruta}'`);
    }
  });
});

describe('la política dice lo que el sistema hace de verdad', () => {
  /* Meta contrasta el documento con lo que la app pide. Un texto genérico que
     no mencione WhatsApp o el tratamiento por IA se rechaza. */
  it('menciona WhatsApp y el asistente automático', () => {
    expect(privacidad).toMatch(/WhatsApp Business/);
    expect(privacidad).toMatch(/inteligencia artificial/i);
    expect(privacidad).toMatch(/no usamos esas conversaciones para entrenar/i);
  });

  it('nombra a los terceros que realmente reciben datos', () => {
    // Los que el código llama de verdad.
    for (const proveedor of ['MongoDB', 'DigitalOcean', 'Cloudflare', 'Meta', 'Groq', 'Wompi', 'Brevo']) {
      expect(privacidad).toContain(proveedor);
    }
  });

  it('distingue los datos del negocio de los del comensal', () => {
    // Son responsabilidades distintas y confundirlas es el error de fondo.
    expect(privacidad).toMatch(/responsables del tratamiento/);
    expect(privacidad).toMatch(/por encargo/);
  });

  it('cita la ley colombiana de datos y cómo ejercer los derechos', () => {
    expect(privacidad).toContain('Ley 1581 de 2012');
    expect(privacidad).toContain('Superintendencia de Industria y Comercio');
    // El correo de contacto sale de la constante compartida, no repetido a mano.
    expect(privacidad).toMatch(/EMPRESA\.correo/);
  });

  it('hay un correo de contacto real donde ejercer los derechos', () => {
    const marco = front('Pages', 'Landing', 'LegalLayout.jsx');
    expect(marco).toMatch(/correo: '[^']+@[^']+\.[a-z]+'/);
  });

  it('aclara que no se guardan datos de tarjetas', () => {
    expect(privacidad).toMatch(/No pedimos ni almacenamos números de tarjeta/);
  });
});

describe('los términos describen el servicio real', () => {
  it('dejan claro que MenuBy no vende comida', () => {
    // Es lo que separa nuestra responsabilidad de la del restaurante.
    expect(terminos).toMatch(/No vendemos comida/);
  });

  it('explican suscripción, complementos y cupos', () => {
    expect(terminos).toMatch(/suscripción mensual o anual/);
    expect(terminos).toMatch(/complementos/);
    expect(terminos).toMatch(/cupo de uso incluido/);
  });

  it('advierten que el asistente puede equivocarse', () => {
    // Se prometió lo contrario en ningún lado, y conviene que quede escrito.
    expect(terminos).toMatch(/puede equivocarse/);
    expect(terminos).toMatch(/revisar los pedidos/);
  });

  it('no limitan derechos irrenunciables', () => {
    expect(terminos).toMatch(/irrenunciable/);
  });
});
