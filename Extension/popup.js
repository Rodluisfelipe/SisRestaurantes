import { ir, leerSlug, guardarSlug, slugDeUrl } from './comun.js';

const $ = (id) => document.getElementById(id);

function mostrar(cual) {
  $('pantalla-destinos').classList.toggle('oculto', cual !== 'destinos');
  $('pantalla-config').classList.toggle('oculto', cual !== 'config');
}

async function arrancar() {
  let slug = await leerSlug();

  /* Si no hay negocio guardado pero estás parado en uno, se toma de ahí. No
     tiene sentido preguntar algo que la pestaña abierta ya dice. */
  if (!slug) {
    const [activa] = await chrome.tabs.query({ active: true, currentWindow: true });
    const detectado = slugDeUrl(activa?.url);
    if (detectado) {
      slug = detectado;
      await guardarSlug(slug);
    }
  }

  if (!slug) {
    mostrar('config');
    $('slug').focus();
    return;
  }

  $('negocio').textContent = slug;
  mostrar('destinos');
}

document.querySelectorAll('.destino').forEach((boton) => {
  boton.addEventListener('click', async () => {
    const slug = await leerSlug();
    if (!slug) return mostrar('config');
    await ir(boton.dataset.destino, slug);
    window.close();
  });
});

$('cambiar').addEventListener('click', async () => {
  $('slug').value = await leerSlug();
  mostrar('config');
  $('slug').focus();
  $('slug').select();
});

async function guardar() {
  /* Se acepta que peguen la dirección entera: es lo que hace cualquiera que
     no sepa qué es un "slug". */
  const escrito = $('slug').value.trim();
  const limpio = slugDeUrl(escrito) || escrito.replace(/^.*menuby\.tech\//i, '').split(/[/?#]/)[0];

  if (!limpio) {
    $('aviso').classList.remove('oculto');
    return;
  }
  await guardarSlug(limpio);
  await arrancar();
}

$('guardar').addEventListener('click', guardar);
$('slug').addEventListener('keydown', (e) => { if (e.key === 'Enter') guardar(); });

arrancar();
