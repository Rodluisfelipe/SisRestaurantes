import { useState } from 'react';

/**
 * El color de un producto sin foto.
 *
 * Sale del nombre, así que el mismo producto tiene siempre el mismo color y el
 * cajero termina reconociéndolo por la mancha de color igual que reconocería
 * una foto. Un color al azar por render no serviría de nada.
 *
 * Los tonos están fijados en el rango oscuro (luminosidad baja, saturación
 * media) para que el texto blanco encima siempre se lea, venga el nombre que
 * venga.
 */
function tinte(nombre: string): string {
  let suma = 0;
  for (let i = 0; i < nombre.length; i++) {
    suma = (suma * 31 + nombre.charCodeAt(i)) % 360;
  }
  return `hsl(${suma}, 45%, 38%)`;
}

/** Las dos letras que más identifican al producto. */
function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return '··';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

/**
 * La foto de un producto en la rejilla.
 *
 * La imagen sale del disco de la caja, no de internet: si apuntara al CDN, la
 * rejilla se llenaría de iconos rotos el día que se cae la conexión, que es
 * justo el día en que la caja tiene que seguir vendiendo.
 *
 * Mientras no haya foto —porque el producto no tiene, porque todavía no se ha
 * descargado, o porque el archivo se borró— se dibujan las iniciales sobre su
 * color. Nunca hay un hueco: un hueco en una rejilla táctil se ve como un
 * error, y esto no lo es.
 */
export default function FotoProducto({
  nombre,
  archivo,
  carpeta,
}: {
  nombre: string;
  /** Nombre del archivo en disco. Vacío = todavía no bajó o no tiene. */
  archivo: string;
  /** Dónde vive la carpeta de fotos, resuelta por Rust al arrancar. */
  carpeta: string;
}) {
  const [fallo, setFallo] = useState(false);

  const marcador = (
    <div
      className="w-full h-full flex items-center justify-center text-white font-black text-lg select-none"
      style={{ backgroundColor: tinte(nombre) }}
      aria-hidden
    >
      {iniciales(nombre)}
    </div>
  );

  if (!archivo || !carpeta || fallo) return marcador;

  return (
    <img
      src={rutaDeFoto(carpeta, archivo)}
      alt=""
      loading="lazy"
      draggable={false}
      /* Si el archivo desapareció del disco, se cae al marcador en vez de
         dejar el icono de imagen rota del navegador. */
      onError={() => setFallo(true)}
      className="w-full h-full object-cover"
    />
  );
}

/**
 * La dirección que entiende el webview para un archivo local.
 *
 * Tauri sirve el disco por su protocolo de recursos, acotado en la
 * configuración a esta única carpeta. Se arma aquí y no en cada tarjeta para
 * que haya un solo sitio que sepa de este detalle.
 */
export function rutaDeFoto(carpeta: string, archivo: string): string {
  const completa = `${carpeta.replace(/[\\/]+$/, '')}/${archivo}`;
  /* En Windows la ruta lleva dos puntos y barras invertidas, así que se
     codifica entera: sin esto, "C:\Users\..." rompe la dirección. */
  return `http://asset.localhost/${encodeURIComponent(completa)}`;
}
