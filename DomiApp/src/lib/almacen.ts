/**
 * Guardar en el celular sin que un fallo del almacenamiento tumbe la app.
 * Todo lo que se guarda aquí debe poder perderse sin romper nada grave,
 * salvo la cola, que por eso vive en su propia clave y se escribe entera.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function leer<T>(clave: string, porDefecto: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(clave);
    return v == null ? porDefecto : (JSON.parse(v) as T);
  } catch {
    return porDefecto;
  }
}

export async function guardar(clave: string, valor: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin espacio o almacenamiento bloqueado: se sigue en memoria */
  }
}

export async function borrar(clave: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(clave);
  } catch {
    /* nada */
  }
}

export const CLAVES = {
  sesion: 'domi.sesion.v1',
  estado: 'domi.estado.v1',
  cola: 'domi.cola.v1',
  ajustes: 'domi.ajustes.v1',
  permisosVistos: 'domi.permisos.v1',
} as const;
