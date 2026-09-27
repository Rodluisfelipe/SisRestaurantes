/**
 * Registro integrado de WhatsApp (Embedded Signup) en la ventana emergente de
 * Meta, con registro de sesión.
 *
 * Es la forma que Meta exige para la Coexistencia: el negocio conecta el
 * número que ya usa en la app WhatsApp Business, sin crear otro ni borrar su
 * cuenta. El enlace a la página alojada de Meta no trae registro de sesión y
 * por eso nunca mostraba esa opción.
 *
 * Devuelve { code, wabaId, phoneNumberId, evento } para mandarlo al servidor.
 */

const VERSION_SDK = 'v21.0';
let cargaSdk = null;

function cargarSdk(appId) {
  if (window.FB) {
    window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: VERSION_SDK });
    return Promise.resolve(window.FB);
  }
  if (!cargaSdk) {
    cargaSdk = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => {
        window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: VERSION_SDK });
        resolve(window.FB);
      };
      const s = document.createElement('script');
      s.src = 'https://connect.facebook.net/es_LA/sdk.js';
      s.async = true;
      s.defer = true;
      s.crossOrigin = 'anonymous';
      s.onerror = () => { cargaSdk = null; reject(new Error('No se pudo cargar Facebook. Revisa tu conexión o desactiva el bloqueador de anuncios.')); };
      document.body.appendChild(s);
    });
  }
  return cargaSdk;
}

const deFacebook = (origen) => /^https:\/\/([a-z0-9-]+\.)*facebook\.com$/.test(origen);

export async function registrarWhatsapp({ appId, configId }) {
  const FB = await cargarSdk(appId);

  return new Promise((resolve, reject) => {
    const sesion = {};
    // Registro de sesión: Meta avisa por postMessage qué cuenta y número se eligieron.
    const alMensaje = (ev) => {
      if (!deFacebook(ev.origin)) return;
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        sesion.evento = data.event;
        if (data.data?.waba_id) sesion.wabaId = data.data.waba_id;
        if (data.data?.phone_number_id) sesion.phoneNumberId = data.data.phone_number_id;
        if (data.event === 'CANCEL') sesion.cancelado = data.data?.current_step || true;
        if (data.event === 'ERROR') sesion.error = data.data?.error_message || 'Meta reportó un error en el registro';
      } catch { /* mensajes de Facebook que no son del registro */ }
    };
    window.addEventListener('message', alMensaje);

    // El SDK exige una función normal (no async) como respuesta.
    FB.login((respuesta) => {
      window.removeEventListener('message', alMensaje);
      const code = respuesta?.authResponse?.code;
      if (code) return resolve({ code, ...sesion });
      if (sesion.error) return reject(new Error(sesion.error));
      const e = new Error('Cerraste la ventana de Meta antes de terminar.');
      e.cancelado = true;
      return reject(e);
    }, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: 'whatsapp_business_app_onboarding',
        sessionInfoVersion: '3',
      },
    });
  });
}
