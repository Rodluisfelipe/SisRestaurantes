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

describe('el paso que trae el primer pedido', () => {
  /* De 30 negocios: 30 se registran, 22 cargan su menú, 5 reciben un pedido.
     La caída no está en cargar el menú — está en que nadie lo ve. El paso 3
     del onboarding decía "cópialo desde la configuración" y mostraba un enlace
     de ejemplo: una instrucción para irse a otro sitio, justo en el punto que
     decide si el negocio se queda. */
  const wizard = front('Components', 'Admin', 'WelcomeWizard.jsx');

  it('el enlace que se muestra es el del negocio, no un ejemplo', () => {
    expect(wizard).not.toContain('menuby.tech/tu-negocio');
    expect(wizard).toMatch(/https:\/\/menuby\.tech\/\$\{slug\}/);
  });

  it('se puede compartir desde ahí mismo, sin ir a buscarlo', () => {
    expect(wizard).toContain('CompartirMenu');
    expect(wizard).toMatch(/wa\.me\/\?text=/);
    expect(wizard).toMatch(/clipboard/);
  });

  it('el mensaje va escrito, no en blanco', () => {
    // Un cuadro vacío es otra tarea; uno con el texto puesto es un envío.
    expect(wizard).toMatch(/const mensaje =/);
    expect(wizard).toMatch(/ya puedes ver el menú/i);
  });

  it('sin slug no se ofrece un enlace roto', () => {
    expect(wizard).toMatch(/if \(!slug\) return null/);
  });
});

describe('la landing carga rápido', () => {
  /* Las fuentes iban en DOS hojas separadas y ambas bloqueaban el pintado: el
     navegador no dibujaba nada hasta resolver dos peticiones a un dominio
     ajeno. Con datos móviles eso son dos viajes antes de ver la página. */
  const fs2 = require('fs');
  const html = fs2.readFileSync(
    path.join(raiz, 'Frontend', 'index.html'), 'utf8',
  );

  it('las fuentes no bloquean el pintado', () => {
    const hojas = [...html.matchAll(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/g)].map((m) => m[0]);
    const bloqueantes = hojas.filter((h) => !h.includes('media="print"') && !h.includes('rel="preconnect"'));
    // La única que puede quedar sin el truco es la de <noscript>.
    const fuera = bloqueantes.filter((h) => !html.slice(0, html.indexOf(h)).endsWith('<noscript>\n      '));
    expect(fuera.length).toBeLessThanOrEqual(1);
    expect(html).toContain('onload="this.media=\'all\'"');
  });

  it('hay quien las vea sin JavaScript', () => {
    // El truco de media="print" depende de JS; sin respaldo se quedan sin fuente.
    expect(html).toMatch(/<noscript>[\s\S]{0,400}fonts\.googleapis\.com/);
  });

  it('no se piden pesos de fuente que no se usan', () => {
    /* De Bricolage se pedían 500, 600, 700 y 800; los títulos van todos en
       extrabold, así que tres se descargaban para nada. */
    const bricolage = html.match(/family=Bricolage\+Grotesque:opsz,wght@([^&"]+)/)?.[1];
    expect(bricolage).toBeTruthy();
    expect(bricolage.split(';').length).toBe(1);
  });

  it('no se repite el preconnect al mismo dominio', () => {
    const n = (html.match(/preconnect[^>]*fonts\.googleapis\.com/g) || []).length;
    expect(n).toBe(1);
  });
});
