/**
 * Los atajos de teclado — Alt+1, Alt+2, Alt+3.
 *
 * Funcionan en cualquier pestaña de Chrome, esté o no MenuBy abierto. Es lo
 * otro que la web sola no puede: una página solo escucha el teclado mientras
 * está al frente.
 */
import { ir, leerSlug, slugDeUrl, guardarSlug } from './comun.js';

const POR_COMANDO = {
  'abrir-panel': 'panel',
  'abrir-whatsapp': 'whatsapp',
  'abrir-pos': 'pos',
};

chrome.commands.onCommand.addListener(async (comando) => {
  const destino = POR_COMANDO[comando];
  if (!destino) return;

  let slug = await leerSlug();

  /* Si todavía no hay negocio guardado, se intenta sacar de la pestaña que
     esté abierta: así el atajo sirve desde el primer día, sin configurar. */
  if (!slug) {
    const [activa] = await chrome.tabs.query({ active: true, currentWindow: true });
    slug = slugDeUrl(activa?.url) || '';
    if (slug) await guardarSlug(slug);
  }

  if (!slug) {
    // Sin negocio no hay a dónde ir: se abre el popup para que lo escriba.
    await chrome.action.openPopup().catch(() => {});
    return;
  }

  await ir(destino, slug);
});
