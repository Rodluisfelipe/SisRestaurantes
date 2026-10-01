/**
 * Lo que el domi va llenando en el registro, paso a paso. Vive solo en memoria:
 * si cierra la app a mitad de camino, vuelve a empezar (el pase de WhatsApp
 * dura 30 minutos de todas formas).
 */
import { create } from 'zustand';

export type TipoDocumento = 'cc' | 'ce' | 'ppt' | 'pasaporte';
export type Vehiculo = 'moto' | 'bicicleta' | 'carro' | 'a_pie';

type Registro = {
  telefono: string;
  email: string;
  pase: string;
  nombre: string;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string;
  vehiculo: Vehiculo | null;
  placa: string;
  frente: string | null;
  reverso: string | null;
  selfie: string | null;
  poner: (c: Partial<Omit<Registro, 'poner' | 'reiniciar'>>) => void;
  reiniciar: () => void;
};

const VACIO = {
  telefono: '', email: '', pase: '', nombre: '', tipoDocumento: null, numeroDocumento: '',
  vehiculo: null, placa: '', frente: null, reverso: null, selfie: null,
} as const;

export const useRegistro = create<Registro>((set) => ({
  ...VACIO,
  poner: (c) => set(c),
  reiniciar: () => set({ ...VACIO }),
}));

export const DOCUMENTOS: { id: TipoDocumento; texto: string }[] = [
  { id: 'cc', texto: 'Cédula' },
  { id: 'ce', texto: 'Cédula de extranjería' },
  { id: 'ppt', texto: 'PPT' },
  { id: 'pasaporte', texto: 'Pasaporte' },
];

export const VEHICULOS: { id: Vehiculo; texto: string; icono: 'moped' | 'bicycle' | 'car' | 'walk' }[] = [
  { id: 'moto', texto: 'Moto', icono: 'moped' },
  { id: 'bicicleta', texto: 'Bicicleta', icono: 'bicycle' },
  { id: 'carro', texto: 'Carro', icono: 'car' },
  { id: 'a_pie', texto: 'A pie', icono: 'walk' },
];
