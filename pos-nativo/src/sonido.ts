/**
 * El "bip" de la caja.
 *
 * Tonos sintetizados, sin un solo archivo de audio ni una dependencia: el
 * `AudioContext` del navegador genera una onda senoidal y eso es todo. Un .wav
 * de 10 KB haría lo mismo y habría que empaquetarlo, versionarlo y cargarlo.
 *
 * Existe porque marcar un producto no daba ninguna señal: el cajero tocaba y
 * tenía que **mirar el carrito** para saber si entró. En hora pico eso se
 * traduce en marcar dos veces. Un sonido corto se procesa sin mirar, que es
 * justo lo que hace falta cuando se tiene una mano en el dinero.
 */

const CLAVE = 'menuby.pos.sonido';
/* Lo que dice el panel. Aparte de la elección del cajero: el panel pone el
   valor de partida y quien está en la caja lo puede cambiar con el botón. */
const CLAVE_PANEL = 'menuby.pos.sonido.panel';

/** Lo que dice el panel, para cuando el cajero no ha elegido. */
export function sonidoDelPanel(si: boolean | null): void {
  try {
    if (si === null) localStorage.removeItem(CLAVE_PANEL);
    else localStorage.setItem(CLAVE_PANEL, si ? 'si' : 'no');
  } catch {
    // Sin almacenamiento se queda sonando, que es lo de fábrica.
  }
}

/* El contexto se crea una sola vez y tarde: los navegadores no dejan sonar
   nada hasta que el usuario toca algo, así que crearlo al cargar la página
   solo consigue que arranque suspendido. */
let contexto: AudioContext | null = null;

function abrir(): AudioContext | null {
  try {
    if (!contexto) {
      const Constructor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return null;
      contexto = new Constructor();
    }
    // Windows suspende el contexto al bloquear la sesión; se despierta solo.
    if (contexto.state === 'suspended') void contexto.resume();
    return contexto;
  } catch {
    /* Un equipo sin tarjeta de sonido no puede tumbar la caja. Vender importa;
       el bip no. */
    return null;
  }
}

/** ¿Está activado? Se recuerda por terminal, no por usuario. */
export function sonidoActivo(): boolean {
  try {
    const delCajero = localStorage.getItem(CLAVE);
    if (delCajero) return delCajero !== 'no';
    return localStorage.getItem(CLAVE_PANEL) !== 'no';
  } catch {
    // Sin almacenamiento, suena: es lo que espera quien no configuró nada.
    return true;
  }
}

export function activarSonido(si: boolean): void {
  try {
    localStorage.setItem(CLAVE, si ? 'si' : 'no');
  } catch {
    // Se queda sin recordar. No vale la pena molestar al cajero con esto.
  }
}

/**
 * Un tono.
 *
 * El ataque y el decaimiento no son adorno: una onda que empieza y termina de
 * golpe produce un chasquido audible en los parlantes baratos de un todo-en-uno
 * de mostrador, y ese chasquido es más molesto que el bip mismo.
 */
function tono(ctx: AudioContext, hz: number, desde: number, duracion: number, volumen = 0.12): void {
  const onda = ctx.createOscillator();
  const ganancia = ctx.createGain();

  onda.type = 'sine';
  onda.frequency.setValueAtTime(hz, desde);

  const RAMPA = 0.008;
  ganancia.gain.setValueAtTime(0, desde);
  ganancia.gain.linearRampToValueAtTime(volumen, desde + RAMPA);
  ganancia.gain.setValueAtTime(volumen, desde + duracion - RAMPA);
  ganancia.gain.linearRampToValueAtTime(0, desde + duracion);

  onda.connect(ganancia).connect(ctx.destination);
  onda.start(desde);
  onda.stop(desde + duracion);
}

/** Entró: producto marcado o código escaneado. Agudo y muy corto. */
export function bip(): void {
  if (!sonidoActivo()) return;
  const ctx = abrir();
  if (!ctx) return;
  tono(ctx, 1200, ctx.currentTime, 0.035);
}

/**
 * Algo se atascó: PIN equivocado, falta autorización, la venta no entró.
 *
 * Grave y doble descendente, porque tiene que distinguirse del bip de marcar
 * sin necesidad de mirar la pantalla — y porque un tono que baja se lee como
 * "no" en cualquier idioma.
 */
export function error(): void {
  if (!sonidoActivo()) return;
  const ctx = abrir();
  if (!ctx) return;
  const ahora = ctx.currentTime;
  tono(ctx, 350, ahora, 0.045, 0.16);
  tono(ctx, 200, ahora + 0.045, 0.045, 0.16);
}
