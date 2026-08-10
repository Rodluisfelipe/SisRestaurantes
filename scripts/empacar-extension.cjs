/**
 * Arma los dos zips de la extension sin depender de herramientas externas.
 * Implementa ZIP "stored" (sin compresion) — son 50 KB de texto e iconos ya
 * comprimidos, asi que el ahorro no justifica una dependencia.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function archivos(dir, base = '') {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'README.md' || e.name.endsWith('.zip')) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...archivos(abs, rel));
    else salida.push({ rel, abs });
  }
  return salida;
}

function crc32(buf) {
  let c, tabla = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = tabla[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entradas, destino) {
  const locales = [];
  const central = [];
  let offset = 0;

  for (const { nombre, datos } of entradas) {
    const comprimido = zlib.deflateRawSync(datos, { level: 9 });
    const n = Buffer.from(nombre, 'utf8');
    const crc = crc32(datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);  local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26); local.writeUInt16LE(0, 28);
    locales.push(local, n, comprimido);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comprimido.length, 20);
    cd.writeUInt32LE(datos.length, 24);
    cd.writeUInt16LE(n.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, n);

    offset += local.length + n.length + comprimido.length;
  }

  const cuerpoCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(cuerpoCentral.length, 12);
  fin.writeUInt32LE(offset, 16);

  fs.writeFileSync(destino, Buffer.concat([...locales, cuerpoCentral, fin]));
}

const dir = 'Extension';
const lista = archivos(dir);

// Para la tienda: manifest.json en la raiz del zip.
zip(lista.map(f => ({ nombre: f.rel, datos: fs.readFileSync(f.abs) })),
    'Extension/menuby-extension-tienda.zip');

// Para instalar a mano: dentro de una carpeta con nombre.
zip(lista.map(f => ({ nombre: `menuby-extension/${f.rel}`, datos: fs.readFileSync(f.abs) })),
    'Frontend/public/menuby-extension.zip');

for (const z of ['Extension/menuby-extension-tienda.zip', 'Frontend/public/menuby-extension.zip']) {
  console.log(`${z}  —  ${(fs.statSync(z).size / 1024).toFixed(1)} KB`);
}
console.log('\narchivos incluidos:');
lista.forEach(f => console.log('  ' + f.rel));
