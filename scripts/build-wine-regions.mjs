/**
 * Builds public/data/wine-regions.geojson from data/wine-regions.json.
 *
 *   node scripts/build-wine-regions.mjs
 *
 * The list of DO/DOCa names, categories and comunidades is transcribed from MAPA's
 * official register (source below); the town used for each point, and the note, are
 * hand-compiled, same deal as resorts.json. There is no free, keyless source for the
 * actual DO boundary polygons: MAPA publishes a shapefile, but the download is behind
 * a captcha, so this plots one representative town per denomination instead of tracing
 * its real (often disjointed) boundary.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SRC = new URL('../data/wine-regions.json', import.meta.url);
const OUT = new URL('../public/data/wine-regions.geojson', import.meta.url);
const CATEGORIES = ['DOCa', 'DO'];

const regions = JSON.parse(await readFile(SRC, 'utf8'));
const problems = [];
const seen = new Set();

for (const [i, region] of regions.entries()) {
  const where = `${region.name ?? `row ${i}`}`;
  if (!region.name || !region.comunidad) problems.push(`${where}: needs a name and a comunidad`);
  if (seen.has(region.name)) problems.push(`${where}: duplicate name`);
  seen.add(region.name);
  if (!CATEGORIES.includes(region.category)) {
    problems.push(`${where}: category must be one of ${CATEGORIES.join(', ')}, got ${region.category}`);
  }
  if (typeof region.lon !== 'number' || typeof region.lat !== 'number') {
    problems.push(`${where}: needs numeric lon and lat`);
  } else if (region.lon < -19 || region.lon > 5 || region.lat < 27 || region.lat > 44.5) {
    problems.push(`${where}: ${region.lon}, ${region.lat} is outside Spain (incl. Canaries) — lon and lat swapped?`);
  }
  if (!region.note) problems.push(`${where}: needs a note, that is the point of it`);
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in data/wine-regions.json:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: 'Spanish wine regions (DO / DOCa)',
      source:
        'MAPA, Listado de Denominaciones de Origen Protegidas e Indicaciones Geográficas ' +
        'Protegidas de vinos registradas en la Unión Europea (accessed 2026). Town and note ' +
        'per region are hand-compiled, not the official boundary.',
      scope: 'DO and DOCa only — excludes Vino de Pago, Vino de Calidad and IGP/Vino de la Tierra.',
      generated: new Date().toISOString().slice(0, 10),
    },
    features: regions.map(({ lon, lat, ...properties }) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [lon, lat] },
    })),
  }),
);

const byCategory = (cat) => regions.filter((r) => r.category === cat).length;
console.log(`Wrote ${regions.length} wine regions`);
console.log(`  DOCa: ${byCategory('DOCa')}, DO: ${byCategory('DO')}`);
