/**
 * Jest y los archivos .ts: los pasa a CommonJS con esbuild (el mismo motor
 * que usa `tsx` en producción), sin revisar tipos. Los tipos los revisa
 * `npm run typecheck`; las pruebas prueban comportamiento.
 */
const { transformSync } = require('esbuild');

module.exports = {
  process(codigo, archivo) {
    const r = transformSync(codigo, {
      loader: archivo.endsWith('x') ? 'tsx' : 'ts',
      format: 'cjs',
      target: 'node20',
      sourcemap: 'inline',
      sourcefile: archivo,
    });
    return { code: r.code };
  },
};
