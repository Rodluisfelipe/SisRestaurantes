import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { tieneCuenta, negocioDeLaCuenta } from '../utils/cuentaCliente';

/**
 * El corazón de la ficha de producto.
 *
 * Con cuenta, cada favorito vive en el servidor (se ve en cualquier momento en
 * "Mi cuenta"). Sin cuenta todavía —el cliente aún no ha pedido desde este
 * celular—, el corazón igual funciona: se guarda en el celular y se sube solo
 * en cuanto llega la llave con el primer pedido. Nadie tiene que saber nada
 * de llaves para usarlo.
 *
 * Un solo estado para todo el menú: marcar en una ficha se ve en la otra.
 */

let marcados = new Set();
let cargadoPara = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(new Set(marcados)));

const clavePendientes = (b) => `mb_favoritos_pendientes:${b}`;
function pendientes(b) {
  try { return JSON.parse(localStorage.getItem(clavePendientes(b)) || '[]'); } catch { return []; }
}
function guardarPendientes(b, lista) {
  try { localStorage.setItem(clavePendientes(b), JSON.stringify([...new Set(lista)])); } catch { /* nada */ }
}

async function cargar(b) {
  if (!b) return;
  cargadoPara = b;
  if (!tieneCuenta(b)) {
    marcados = new Set(pendientes(b));
    avisar();
    return;
  }
  // Primero se suben los que se marcaron antes de tener cuenta.
  const porSubir = pendientes(b);
  if (porSubir.length) {
    await Promise.all(porSubir.map((productId) => api.post('/cuenta/favoritos', { productId }).catch(() => null)));
    guardarPendientes(b, []);
  }
  try {
    const { data } = await api.get('/cuenta/favoritos');
    marcados = new Set(
      (data?.favoritos || [])
        .filter((f) => !f.selectedToppings?.length)
        .map((f) => String(f.productId?._id || f.productId)),
    );
  } catch {
    marcados = new Set();
  }
  avisar();
}

if (typeof window !== 'undefined') {
  // Llegó (o se fue) la llave: se vuelve a cargar, subiendo lo pendiente.
  window.addEventListener('mb:cuenta', (e) => cargar(e.detail?.businessId));
}

export default function useFavoritos() {
  const [estado, setEstado] = useState(() => new Set(marcados));
  const negocio = negocioDeLaCuenta();

  useEffect(() => {
    oyentes.add(setEstado);
    if (negocio && cargadoPara !== negocio) cargar(negocio);
    return () => { oyentes.delete(setEstado); };
  }, [negocio]);

  const esFavorito = useCallback((productId) => estado.has(String(productId)), [estado]);

  /** Marca o desmarca. Devuelve true si quedó marcado. */
  const alternar = useCallback(async (productId) => {
    const id = String(productId);
    const b = negocioDeLaCuenta();
    const marcar = !marcados.has(id);
    // Se ve al instante; si el servidor falla, se devuelve.
    if (marcar) marcados.add(id); else marcados.delete(id);
    avisar();
    if (!b || !tieneCuenta(b)) {
      const lista = pendientes(b).filter((x) => x !== id);
      guardarPendientes(b, marcar ? [...lista, id] : lista);
      return marcar;
    }
    try {
      if (marcar) await api.post('/cuenta/favoritos', { productId: id });
      else await api.delete(`/cuenta/favoritos/${id}?por=producto`);
    } catch (err) {
      // Quitar uno que ya no estaba es lo mismo que quitarlo.
      if (!marcar && err?.response?.status === 404) return false;
      if (marcar) marcados.delete(id); else marcados.add(id);
      avisar();
      return !marcar;
    }
    return marcar;
  }, []);

  return { esFavorito, alternar, recargar: () => cargar(negocioDeLaCuenta()) };
}
