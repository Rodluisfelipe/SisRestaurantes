import { useMemo } from 'react';
import { pedidosVisibles, useApp } from './app';

/** Un pedido de la lista del domi (con sus avances locales aplicados). */
export function usePedido(id: string | undefined) {
  const servidor = useApp((s) => s.servidor);
  const locales = useApp((s) => s.locales);
  return useMemo(() => pedidosVisibles(servidor, locales).find((p) => p.id === id) ?? null, [servidor, locales, id]);
}
