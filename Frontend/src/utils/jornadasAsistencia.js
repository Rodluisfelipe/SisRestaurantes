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

/** Descarga el Excel: una hoja de resumen y una por empleado. */
export async function descargarExcel({ marcas, desde, hasta, negocio }) {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Menuby';
  const personas = Object.values(armarJornadas(marcas)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const usados = new Set();
  const negrita = { bold: true };
  const encabezado = (fila) => {
    fila.font = negrita;
    fila.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
  };

  // Resumen
  const resumen = libro.addWorksheet(nombreHoja('Resumen', usados));
  resumen.addRow([`Asistencia · ${negocio || ''}`]).font = { bold: true, size: 14 };
  resumen.addRow([`Del ${desde} al ${hasta}`]);
  resumen.addRow([]);
  encabezado(resumen.addRow(['Empleado', 'Jornadas completas', 'Horas trabajadas', 'Marcas incompletas']));
  for (const p of personas) {
    const completas = p.jornadas.filter((j) => j.horas !== null);
    const horas = completas.reduce((s, j) => s + j.horas, 0);
    resumen.addRow([p.nombre, completas.length, Math.round(horas * 100) / 100, p.jornadas.length - completas.length]);
  }
  resumen.columns = [{ width: 30 }, { width: 20 }, { width: 18 }, { width: 20 }];

  // Una hoja por empleado
  for (const p of personas) {
    const h = libro.addWorksheet(nombreHoja(p.nombre, usados));
    h.addRow([p.nombre]).font = { bold: true, size: 14 };
    h.addRow([`Del ${desde} al ${hasta}`]);
    h.addRow([]);
    encabezado(h.addRow(['Fecha', 'Entrada', 'Sede entrada', 'Salida', 'Sede salida', 'Horas', 'Observación', 'Ubicación entrada', 'Ubicación salida']));
    let total = 0;
    for (const j of p.jornadas) {
      const ref = j.entrada || j.salida;
      if (j.horas !== null) total += j.horas;
      h.addRow([
        fecha(ref.fecha),
        j.entrada ? hora(j.entrada.fecha) : '',
        j.entrada?.sedeNombre || '',
        j.salida ? hora(j.salida.fecha) : '',
        j.salida?.sedeNombre || '',
        j.horas ?? '',
        j.nota,
        mapa(j.entrada?.ubicacion),
        mapa(j.salida?.ubicacion),
      ]);
    }
    const fila = h.addRow(['Total', '', '', '', '', Math.round(total * 100) / 100]);
    fila.font = negrita;
    h.columns = [{ width: 18 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 10 }, { width: 34 }, { width: 18 }, { width: 18 }];
  }

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const quien = personas.length === 1 ? `-${personas[0].nombre.replace(/\s+/g, '-')}` : '';
  a.download = `asistencia${quien}-${desde}-a-${hasta}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
