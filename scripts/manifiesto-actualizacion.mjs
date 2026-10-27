// Genera latest.json para las actualizaciones en vivo (ver src/lib/actualizaciones.ts).
// Uso: node scripts/manifiesto-actualizacion.mjs <bundle.zip> <url-del-zip> <salida.json>
// Requiere BITACORA_BUILD (el mismo número con el que se compiló el bundle).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [zip, url, salida] = process.argv.slice(2);
const build = Number(process.env.BITACORA_BUILD);
if (!zip || !url || !salida || !Number.isInteger(build) || build <= 0) {
  console.error('Uso: BITACORA_BUILD=<n> node scripts/manifiesto-actualizacion.mjs <bundle.zip> <url> <salida.json>');
  process.exit(1);
}

const paquete = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const manifiesto = {
  build,
  version: paquete.version,
  url,
  checksum: createHash('sha256').update(readFileSync(zip)).digest('hex'),
  nativoMinimo: paquete.bitacora.nativoMinimo,
};

writeFileSync(salida, `${JSON.stringify(manifiesto, null, 2)}\n`);
console.log(manifiesto);
