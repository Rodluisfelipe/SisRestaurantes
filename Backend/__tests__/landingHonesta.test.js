/**
 * La landing no puede prometer cifras que no se sostienen.
 *
 * Decía "500+ restaurantes activos" con 28 registrados, "40% aumento en
 * ventas" sin nada detrás, y el resultado de Google ofrecía $30.000 cuando el
 * plan más barato cobra $39.900.
 *
 * El daño no es teórico: un dueño que pregunta en el grupo de su barrio y no
 * encuentra a nadie usándolo se va, y quien llega desde Google sintiendo que le
 * cambiaron el precio en diez segundos tampoco se queda.
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const front = (...p) => fs.readFileSync(path.join(raiz, 'Frontend', 'src', ...p), 'utf8');
const funcion = fs.readFileSync(path.join(raiz, 'Frontend', 'functions', '[[slug]].js'), 'utf8');
const planes = fs.readFileSync(path.join(raiz, 'Backend', 'utils', 'commercialPlans.js'), 'utf8');

const PAGINAS = ['Home.jsx', 'Features.jsx', 'Pricing.jsx', 'Contact.jsx', 'Demo.jsx', 'NichePage.jsx'];

/* Se quitan los comentarios antes de buscar: la explicación de por qué se
   retiró una cifra menciona la cifra, y sin esto la prueba se acusa a sí
   misma. Lo que importa es lo que el visitante lee. */
const sinComentarios = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const textoLanding = PAGINAS.map((p) => {
  try { return sinComentarios(front('Pages', 'Landing', p)); } catch { return ''; }
}).join('\n') + '\n' + sinComentarios(funcion);

describe('la landing dice la verdad', () => {
  it('no promete cientos de restaurantes', () => {
    // 28 registrados, 10 suscripciones activas, 4 vendiendo.
    expect(textoLanding).not.toMatch(/\+?\s?500\+?\s*(restaurantes|negocios)/i);
    expect(textoLanding).not.toMatch(/(restaurantes|negocios)\s*(activos)?\D{0,12}500/i);
  });

  it('no promete un aumento de ventas que nadie midió', () => {
    expect(textoLanding).not.toMatch(/\d{1,3}\s*%\s*(de\s*)?(aumento|más ventas|incremento)/i);
    expect(textoLanding).not.toMatch(/aumenta tus ventas un\s*\d/i);
  });

  it('el precio del resultado de Google es el que se cobra', () => {
    /* Se lee el plan pago más barato del código y se exige que lo que promete
       la función de SEO no esté por debajo. */
    const precios = [...planes.matchAll(/monthly:\s*(\d+)/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n > 0);
    const masBarato = Math.min(...precios);

    const prometidos = [...funcion.matchAll(/\$(\d{2})\.(\d{3})/g)]
      .map((m) => Number(m[1] + m[2]));

    expect(prometidos.length).toBeGreaterThan(0);
    for (const p of prometidos) {
      expect(p).toBeGreaterThanOrEqual(masBarato);
    }
  });

  it('las cifras de la plataforma se consultan, no se escriben a mano', () => {
    /* Una cifra fija envejece hasta volverse mentira sin que nadie lo note. */
    const features = front('Pages', 'Landing', 'Features.jsx');
    expect(features).toContain('useCifrasReales');
    expect(features).toMatch(/stats\/public/);
    expect(features).toMatch(/cifras\?\.ordersTotal/);
  });

  it('el endpoint entrega los totales que la landing muestra', () => {
    const ruta = fs.readFileSync(path.join(raiz, 'Backend', 'Routes', 'publicStats.js'), 'utf8');
    expect(ruta).toMatch(/ordersTotal/);
    expect(ruta).toMatch(/salesTotal/);
    // Y si falla, devuelve ceros en vez de romper la landing.
    expect(ruta).toMatch(/catch[\s\S]{0,400}ordersTotal: 0/);
  });

  it('las cifras se redondean hacia abajo', () => {
    // Prometer de menos y cumplir de más, nunca al revés.
    const features = front('Pages', 'Landing', 'Features.jsx');
    expect(features).toMatch(/Math\.floor\(n \/ paso\)/);
  });

  it('no vuelven los testimonios inventados', () => {
    // Se retiraron a proposito; solo vuelven con nombre, foto y link real.
    const home = front('Pages', 'Landing', 'Home.jsx');
    expect(home).toMatch(/los testimonios se retiraron a propósito/i);
  });
});
