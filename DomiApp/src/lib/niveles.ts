/**
 * Cómo se ve cada nivel de MenuBy Go (los nombres y las reglas vienen del
 * servidor; aquí solo los colores y el ícono de cada uno).
 *  - fondo / tinta: para insignias pequeñas sobre fondo claro (Yo, listas).
 *  - degradado / acento: para la tarjeta grande del nivel (tipo membresía).
 */
import type { NombreIcono } from '@/componentes/base';

export type AspectoNivel = {
  fondo: string;
  tinta: string;
  icono: NombreIcono;
  degradado: [string, string];
  acento: string;
};

const ASPECTO: AspectoNivel[] = [
  { fondo: '#ECECEA', tinta: '#3A3B40', icono: 'moped', degradado: ['#4A4B52', '#1C1C20'], acento: '#FFFFFF' },             // Go
  { fondo: '#E6F0FF', tinta: '#1F6FEB', icono: 'lightning-bolt', degradado: ['#2F7BF5', '#1A3C8F'], acento: '#CFE0FF' },    // Go+
  { fondo: '#E3F5EB', tinta: '#0F7A45', icono: 'shield-star', degradado: ['#12A35F', '#0A5434'], acento: '#C9F2DC' },       // Pro
  { fondo: '#F1E8FF', tinta: '#6D28D9', icono: 'crown', degradado: ['#8B4DF0', '#3F1A8A'], acento: '#E6D9FF' },             // Élite
  { fondo: '#141417', tinta: '#F5C04A', icono: 'diamond-stone', degradado: ['#2E2E35', '#050506'], acento: '#F5C04A' },     // MenuBy Black
];

export function aspectoNivel(id: number | null | undefined): AspectoNivel {
  return ASPECTO[Math.max(0, Math.min(ASPECTO.length - 1, Number(id) || 0))];
}
