import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { aplicarMarca, identidad, type EstadoCliente } from './nativo';
import VistaCliente from './VistaCliente';

/**
 * La ventana del segundo monitor.
 *
 * Su único trabajo es escuchar lo que manda la caja y dibujarlo. Lo que se
 * dibuja vive en [`VistaCliente`], que es el mismo componente que usa la caja
 * cuando el local tiene una sola pantalla: lo que el cliente ve tiene que ser
 * idéntico en los dos casos, y dos copias derivarían.
 */
export default function PantallaCliente() {
  const [estado, setEstado] = useState<EstadoCliente>({ modo: 'espera', negocio: 'MenuBy' });

  useEffect(() => {
    const suelta = listen<EstadoCliente>('cliente:estado', (e) => setEstado(e.payload));
    return () => { suelta.then((f) => f()); };
  }, []);

  /* Esta es otra ventana del sistema operativo, con su propio documento: el
     color que aplicó la caja no llega hasta aquí y hay que pedirlo de nuevo.
     Importa más que en la caja, porque esta es la pantalla que mira el
     cliente todo el rato que espera. */
  useEffect(() => { identidad().then(aplicarMarca).catch(() => {}); }, []);

  return (
    <div className="h-screen">
      <VistaCliente estado={estado} />
    </div>
  );
}
