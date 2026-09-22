const mongoose = require('mongoose');

/**
 * Varios negocios de un mismo dueño, en una sola página.
 *
 * No es un marketplace y no es una marca con sucursales. Son **negocios
 * distintos del mismo dueño** —una pizzería, un sushi, una heladería— que no
 * comparten carta, ni precios, ni nada, pero que él quiere mostrar juntos bajo
 * un nombre propio.
 *
 * Por qué no se reutilizó lo que ya había:
 *
 * - `Brand` significa **sucursales de la misma marca** en este sistema, y
 *   arrastra `useSharedMenu` y `mainBranchId`. Meter ahí una pizzería y un
 *   sushi los convertiría en sucursales el uno del otro: el panel los listaría
 *   bajo "Sucursales" y la lógica de menú compartido empezaría a aplicarles.
 * - `Admin.accessibleBusinessIds` ya dice a qué negocios entra un dueño, pero
 *   es un permiso, no una vitrina: no tiene nombre, ni logo, ni dirección web,
 *   y una página pública necesita las tres.
 *
 * Así que esto es lo mínimo que faltaba: la cara pública de un portafolio. Los
 * permisos siguen donde estaban.
 *
 * **No toca nada de los negocios.** Cada uno conserva su panel, su carta, sus
 * precios y su configuración. Esto solo los agrupa para mostrarlos.
 */
const portafolioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },

  /* La dirección: menuby.tech/p/tura. Minúsculas y sin espacios porque va en
     una URL que alguien va a dictar por teléfono. */
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'El slug solo admite letras, números y guiones']
  },

  descripcion: { type: String, default: '', trim: true, maxlength: 300 },
  logo: { type: String, default: '' },
  portada: { type: String, default: '' },

  /* Los colores de la vitrina. Suyos y no de ninguno de sus negocios: el
     portafolio tiene su propia identidad, que es justo la razón de existir. */
  colorPrincipal: { type: String, default: '#111827' },
  colorTexto: { type: String, default: '#ffffff' },

  /* Quién lo administra. Es el dueño, el mismo que ya tiene los negocios en su
     `accessibleBusinessIds`. Se guarda aquí también para poder resolver "el
     portafolio de este admin" sin recorrer todos. */
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
    index: true
  },

  /* Los negocios que se muestran, **en el orden en que se muestran**.
   *
   * Un arreglo y no una colección aparte porque aquí no hay nada que guardar
   * de la relación: ni comisión, ni estado, ni fechas. Son los negocios del
   * dueño y él decide cuáles salen y en qué orden. El día que haya que
   * guardarle algo a cada uno, esto se parte en su propia colección. */
  negocios: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig'
  }],

  /* Los banners de la página.
   *
   * Van **aquí dentro** y no en el modelo `Banner`, que es otra cosa: ese
   * pasa por aprobación del superadmin porque se muestra en el catálogo
   * general de MenuBy, donde compiten negocios distintos. Esta es la página
   * del dueño: hacerlo esperar una aprobación para poner una promoción en su
   * propia vitrina sería absurdo.
   *
   * Un arreglo embebido y no una colección aparte por lo mismo que los
   * negocios: no hay nada que guardar de cada banner más allá de lo que se
   * dibuja. El día que haya que contar clics por banner, esto se parte. */
  banners: [{
    imagen: { type: String, required: true },
    titulo: { type: String, default: '', trim: true, maxlength: 80 },
    /* A dónde lleva. Puede ser uno de sus negocios (`/doggitos`), una
       categoría, o algo de afuera. Vacío = el banner no es clicable. */
    enlace: { type: String, default: '', trim: true, maxlength: 300 },
    activo: { type: Boolean, default: true },
  }],

  /* La burbuja de ayuda: un WhatsApp flotante.
   *
   * Es de la vitrina, con su propio número, y no el de ninguno de los
   * negocios: quien escribe desde aquí todavía no eligió a cuál quiere ir, y
   * mandarlo al WhatsApp de uno de ellos es contestarle una pregunta que no
   * hizo. */
  ayuda: {
    activa: { type: Boolean, default: false },
    telefono: { type: String, default: '', trim: true, maxlength: 25 },
    mensaje: { type: String, default: '', trim: true, maxlength: 200 },
    etiqueta: { type: String, default: '', trim: true, maxlength: 40 },
  },

  /* Mostrar debajo de cada negocio una fila con lo más pedido de la semana.
     Se puede apagar: un negocio recién abierto, sin ventas, muestra una fila
     pobre que resta más de lo que suma. */
  mostrarTops: { type: Boolean, default: true },

  /* Apagado = la página responde 404. Sirve para montarlo con calma antes de
     darle la dirección a nadie. */
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports =
  mongoose.models.Portafolio || mongoose.model('Portafolio', portafolioSchema);
