/**
 * La verificación del dominio ante Meta tiene que verla el rastreador de Meta.
 *
 * La etiqueta se puso en index.html y en el navegador se veía perfecta, pero
 * `facebookexternalhit` —justo el rastreador que Meta usa para verificar— no la
 * recibía: la función de Cloudflare intercepta a los bots y les genera el HTML
 * desde cero, así que la etiqueta del index nunca les llegaba.
 *
 * El fallo era mudo por los dos lados: la página se veía bien y Meta solo decía
 * "no se pudo verificar, inténtalo en 72 horas".
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const indexHtml = fs.readFileSync(path.join(raiz, 'Frontend', 'index.html'), 'utf8');
const funcion = fs.readFileSync(path.join(raiz, 'Frontend', 'functions', '[[slug]].js'), 'utf8');

describe('verificación del dominio ante Meta', () => {
  it('la etiqueta está en el HTML estático', () => {
    // En el <head> y no inyectada por React: Meta no ejecuta JavaScript.
    const head = indexHtml.slice(indexHtml.indexOf('<head>'), indexHtml.indexOf('</head>'));
    expect(head).toMatch(/<meta name="facebook-domain-verification" content="[a-z0-9]+"/);
  });

  it('el rastreador de Meta está entre los que reciben HTML generado', () => {
    // Si no lo estuviera, bastaría con el index.html.
    expect(funcion).toContain('facebookexternalhit');
  });

  it('TODAS las plantillas generadas llevan la etiqueta', () => {
    /* Cuatro sitios generan HTML. Con que uno se olvide, Meta puede caer
       justo en ese y la verificación falla sin explicación. */
    const plantillas = (funcion.match(/<head>\s*\n\s*<meta charset="UTF-8" \/>/g) || []).length;
    const conEtiqueta = (funcion.match(/\$\{META_DOMAIN_VERIFICATION\}/g) || []).length;

    expect(plantillas).toBeGreaterThan(0);
    expect(conEtiqueta).toBe(plantillas);
  });

  it('el valor se declara una sola vez', () => {
    // Repetido en cuatro sitios, uno se queda viejo el día que cambie.
    const declaraciones = (funcion.match(/const META_DOMAIN_VERIFICATION =/g) || []).length;
    expect(declaraciones).toBe(1);
  });

  it('el código de verificación coincide en los dos lados', () => {
    const delIndex = indexHtml.match(/facebook-domain-verification" content="([a-z0-9]+)"/)?.[1];
    const deLaFuncion = funcion.match(/facebook-domain-verification" content="([a-z0-9]+)"/)?.[1];
    expect(delIndex).toBeTruthy();
    expect(deLaFuncion).toBe(delIndex);
  });
});
