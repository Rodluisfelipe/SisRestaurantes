/**
 * La configuración que el panel le manda a una caja registradora.
 *
 * Todo lo que pasa por aquí termina dentro de una terminal que cobra dinero,
 * habla con una impresora térmica y calcula impuestos. Un número fuera de
 * rango no es un detalle estético: un auto-bloqueo de cero segundos deja la
 * caja pidiendo PIN cada instante, y un régimen fiscal inventado deja al
 * negocio declarando mal.
 *
 * El criterio de estas pruebas: **lo que no se entiende se reemplaza, no se
 * rechaza**. Que el dueño no pueda guardar nada porque se equivocó en un campo
 * sería peor que ignorar ese campo.
 */
const { conDefectos, validarConfig } = require('../utils/configPos');

describe('una caja sin configurar', () => {
  it('funciona con los valores por defecto', () => {
    /* Es el caso de toda terminal vinculada antes de que existiera este
       bloque: si los defectos no aplicaran, el panel mostraría undefined en
       cada campo y la caja no sabría cuánto esperar al datáfono. */
    const c = conDefectos(undefined);

    expect(c.autoBloqueoSegundos).toBe(90);
    expect(c.sonidoActivo).toBe(true);
    expect(c.fiscal.regimenPrincipal).toBe('INC_8');
    expect(c.hardware.datafono.tipo).toBe('MANUAL');
    expect(c.hardware.impresoraCaja.anchoMm).toBe(80);
  });

  it('un bloque a medias se completa sin perder lo que sí vino', () => {
    const c = conDefectos({ sonidoActivo: false, fiscal: { regimenPrincipal: 'IVA_19' } });

    expect(c.sonidoActivo).toBe(false);
    expect(c.fiscal.regimenPrincipal).toBe('IVA_19');
    expect(c.autoBloqueoSegundos).toBe(90, 'lo que no vino, por defecto');
  });
});

describe('los números se acotan a lo que tiene sentido en un mostrador', () => {
  it('el auto-bloqueo no baja de 30 segundos', () => {
    // Menos sería pedirle el PIN al cajero mientras cobra.
    expect(validarConfig({ autoBloqueoSegundos: 0 }).config.autoBloqueoSegundos).toBe(30);
    expect(validarConfig({ autoBloqueoSegundos: -5 }).config.autoBloqueoSegundos).toBe(30);
  });

  it('ni sube de 300', () => {
    // Más es dejar la caja abierta media hora con el usuario de quien se fue.
    expect(validarConfig({ autoBloqueoSegundos: 99999 }).config.autoBloqueoSegundos).toBe(300);
  });

  it('la espera del datáfono se queda entre 5 y 180 segundos', () => {
    const corta = validarConfig({ hardware: { datafono: { esperaSegundos: 1 } } });
    const larga = validarConfig({ hardware: { datafono: { esperaSegundos: 600 } } });

    expect(corta.config.hardware.datafono.esperaSegundos).toBe(5);
    expect(larga.config.hardware.datafono.esperaSegundos).toBe(180);
  });

  it('un puerto imposible cae al de siempre', () => {
    expect(validarConfig({ hardware: { datafono: { puerto: 0 } } }).config.hardware.datafono.puerto).toBe(1);
    expect(
      validarConfig({ hardware: { datafono: { puerto: 'no soy un puerto' } } }).config.hardware.datafono.puerto,
    ).toBe(9100);
  });

  it('el ancho del papel solo puede ser 58 u 80', () => {
    // Son los dos anchos de papel térmico que existen.
    expect(validarConfig({ hardware: { impresoraCaja: { anchoMm: 58 } } }).config.hardware.impresoraCaja.anchoMm).toBe(58);
    expect(validarConfig({ hardware: { impresoraCaja: { anchoMm: 72 } } }).config.hardware.impresoraCaja.anchoMm).toBe(80);
  });
});

describe('lo fiscal no admite inventos', () => {
  it('un régimen desconocido cae en impoconsumo', () => {
    /* La regla general de un negocio gastronómico, que es lo menos equivocado
       posible cuando no se sabe. */
    expect(validarConfig({ fiscal: { regimenPrincipal: 'IVA_5' } }).config.fiscal.regimenPrincipal).toBe('INC_8');
    expect(validarConfig({ fiscal: { regimenPrincipal: 123 } }).config.fiscal.regimenPrincipal).toBe('INC_8');
  });

  it('las categorías se normalizan y no se repiten', () => {
    /* Se comparan contra la categoría del producto en minúsculas: si aquí
       entrara "Licores" con mayúscula, no coincidiría con nada y esa cerveza
       se declararía al 8%. */
    const c = validarConfig({
      fiscal: { categoriasIva: ['  Licores ', 'LICORES', 'Cervezas', '', null] },
    }).config;

    expect(c.fiscal.categoriasIva).toEqual(['licores', 'cervezas']);
  });

  it('una lista que no es lista queda vacía', () => {
    expect(validarConfig({ fiscal: { categoriasIva: 'licores' } }).config.fiscal.categoriasIva).toEqual([]);
  });

  it('el pie de factura se recorta, no se rechaza', () => {
    const largo = 'x'.repeat(1000);
    expect(validarConfig({ fiscal: { textoPieFactura: largo } }).config.fiscal.textoPieFactura).toHaveLength(300);
  });
});

describe('lo que sí se rechaza', () => {
  it('una configuración que no es un objeto', () => {
    /* Aquí no hay nada que sanear: es una petición mal formada, no un campo
       mal puesto. */
    expect(validarConfig('todo bien').ok).toBe(false);
    expect(validarConfig(42).ok).toBe(false);
  });

  it('pero null y undefined sí pasan, con los defectos', () => {
    // Son "no me toques la configuración", no un error.
    expect(validarConfig(null).ok).toBe(true);
    expect(validarConfig(undefined).ok).toBe(true);
  });
});

describe('la plantilla del QR', () => {
  it('se guarda tal cual la escribió el negocio', () => {
    /* No se valida el formato a propósito: cada banco y cada pasarela usa el
       suyo, y adivinar cuál es correcto produciría códigos que el cliente
       escanea y no funcionan. El negocio pega el que ya usa. */
    const plantilla = 'https://banco.co/pagar?monto={monto}&ref={ref}';
    const c = validarConfig({ hardware: { pantallaCliente: { plantillaQr: plantilla } } }).config;

    expect(c.hardware.pantallaCliente.plantillaQr).toBe(plantilla);
  });

  it('viene apagada por defecto', () => {
    // Un negocio que no cobra por transferencia no tiene por qué verla.
    expect(conDefectos({}).hardware.pantallaCliente.mostrarQr).toBe(false);
  });
});
