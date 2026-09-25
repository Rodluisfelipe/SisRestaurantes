/**
 * Convierte las marcas de asistencia (entradas y salidas sueltas) en jornadas
 * por persona, y arma el Excel del reporte.
 */

const ZONA = 'America/Bogota';
const MAX_JORNADA_MS = 20 * 60 * 60 * 1000; // igual que en el servidor

const fmtFecha = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA });
const fmtHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: ZONA });

export const fecha = (d) => fmtFecha.format(new Date(d));
export const hora = (d) => fmtHora.format(new Date(d));

/**
 * marcas (ordenadas por fecha) → { [personaId]: { nombre, jornadas: [...] } }
 * Cada jornada: { entrada, salida, horas, nota }. Una entrada sin salida o una
 * salida sin entrada quedan como jornada con nota, sin horas.
 */
export function armarJornadas(marcas) {
  const porPersona = {};
  const ordenadas = [...marcas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  for (const m of ordenadas) {
    const id = String(m.personaId);
    const p = porPersona[id] || (porPersona[id] = { nombre: m.nombre, jornadas: [], abierta: null });
    p.nombre = m.nombre;
    if (m.tipo === 'entrada') {
      if (p.abierta) p.jornadas.push({ entrada: p.abierta, salida: null, horas: null, nota: 'Sin salida marcada' });
      p.abierta = m;
    } else if (p.abierta && new Date(m.fecha) - new Date(p.abierta.fecha) < MAX_JORNADA_MS) {
      const horas = (new Date(m.fecha) - new Date(p.abierta.fecha)) / 3600000;
      p.jornadas.push({ entrada: p.abierta, salida: m, horas: Math.round(horas * 100) / 100, nota: '' });
      p.abierta = null;
    } else {
      if (p.abierta) p.jornadas.push({ entrada: p.abierta, salida: null, horas: null, nota: 'Sin salida marcada' });
      p.abierta = null;
      p.jornadas.push({ entrada: null, salida: m, horas: null, nota: 'Salida sin entrada' });
    }
  }
  for (const p of Object.values(porPersona)) {
    if (p.abierta) p.jornadas.push({ entrada: p.abierta, salida: null, horas: null, nota: 'Sin salida marcada (o sigue trabajando)' });
    delete p.abierta;
  }
  return porPersona;
}

function nombreHoja(nombre, usados) {
  const base = String(nombre || 'Sin nombre').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Hoja';
  let n = base;
  let i = 2;
  while (usados.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`;
  usados.add(n.toLowerCase());
  return n;
}

const mapa = (u) => (typeof u?.lat === 'number' ? { text: 'Ver mapa', hyperlink: `https://maps.google.com/?q=${u.lat},${u.lng}` } : '');

const metros = (m) => (typeof m?.distancia === 'number' ? m.distancia : '');

/**
 * Descarga el Excel: una hoja de resumen y una por empleado.
 * `personas` y `sedes` vienen del servidor para poner las sedes asignadas.
 */
export async function descargarExcel({ marcas, personas = [], sedes = [], desde, hasta, negocio, sedeFiltro = '' }) {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Menuby';
  const nombreSede = new Map(sedes.map((s) => [String(s._id), s.nombre]));
  const asignadas = new Map(personas.map((p) => [String(p._id), (p.sedes || []).map((id) => nombreSede.get(String(id))).filter(Boolean).join(', ') || 'Todas']));
  const porPersona = armarJornadas(marcas);
  const lista = Object.entries(porPersona).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const usados = new Set();
  const periodo = `Del ${desde} al ${hasta}${sedeFiltro ? ` · Sede: ${sedeFiltro}` : ''}`;
  const encabezado = (fila) => {
    fila.font = { bold: true };
    fila.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
  };

  // Resumen
  const resumen = libro.addWorksheet(nombreHoja('Resumen', usados));
  resumen.addRow([`Asistencia · ${negocio || ''}`]).font = { bold: true, size: 14 };
  resumen.addRow([periodo]);
  resumen.addRow([]);
  encabezado(resumen.addRow(['Empleado', 'Sedes asignadas', 'Sedes donde marcó', 'Jornadas completas', 'Horas trabajadas', 'Marcas incompletas']));
  for (const p of lista) {
    const completas = p.jornadas.filter((j) => j.horas !== null);
    const horas = completas.reduce((s, j) => s + j.horas, 0);
    const donde = [...new Set(p.jornadas.flatMap((j) => [j.entrada?.sedeNombre, j.salida?.sedeNombre]).filter(Boolean))].join(', ');
    resumen.addRow([p.nombre, asignadas.get(p.id) || '', donde, completas.length, Math.round(horas * 100) / 100, p.jornadas.length - completas.length]);
  }
  resumen.columns = [{ width: 28 }, { width: 26 }, { width: 26 }, { width: 18 }, { width: 16 }, { width: 18 }];

  // Una hoja por empleado
  for (const p of lista) {
    const h = libro.addWorksheet(nombreHoja(p.nombre, usados));
    h.addRow([p.nombre]).font = { bold: true, size: 14 };
    h.addRow([`${periodo} · Sedes asignadas: ${asignadas.get(p.id) || ''}`]);
    h.addRow([]);
    encabezado(h.addRow(['Fecha', 'Entrada', 'Sede entrada', 'Distancia entrada (m)', 'Salida', 'Sede salida', 'Distancia salida (m)', 'Horas', 'Observación', 'Ubicación entrada', 'Ubicación salida']));
    let total = 0;
    for (const j of p.jornadas) {
      const ref = j.entrada || j.salida;
      if (j.horas !== null) total += j.horas;
      h.addRow([
        fecha(ref.fecha),
        j.entrada ? hora(j.entrada.fecha) : '',
        j.entrada?.sedeNombre || '',
        metros(j.entrada),
        j.salida ? hora(j.salida.fecha) : '',
        j.salida?.sedeNombre || '',
        metros(j.salida),
        j.horas ?? '',
        j.nota,
        mapa(j.entrada?.ubicacion),
        mapa(j.salida?.ubicacion),
      ]);
    }
    h.addRow(['Total', '', '', '', '', '', '', Math.round(total * 100) / 100]).font = { bold: true };
    h.columns = [{ width: 18 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 10 }, { width: 34 }, { width: 16 }, { width: 16 }];
  }

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const quien = lista.length === 1 ? `-${lista[0].nombre.replace(/\s+/g, '-')}` : '';
  const donde = sedeFiltro ? `-${sedeFiltro.replace(/\s+/g, '-')}` : '';
  a.download = `asistencia${quien}${donde}-${desde}-a-${hasta}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
