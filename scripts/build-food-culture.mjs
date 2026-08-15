/**
 * Builds public/data/food-culture.geojson from data/food-culture.json.
 *
 *   node scripts/build-food-culture.mjs
 *
 * The ratings and the writing are a judgement, not a survey — see the note in the
 * layer. Boundaries are Eurostat NUTS 2, which is the autonomous community in Spain
 * and the region in Portugal, because food culture follows those lines and not
 * provinces. Regions are joined by code, so nothing hangs on matching names.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CACHE = new URL('../.cache/food/', import.meta.url);
const SRC = new URL('../data/food-culture.json', import.meta.url);
const OUT = new URL('../public/data/food-culture.geojson', import.meta.url);
const BOUNDARIES =
  'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_10M_2024_4326_LEVL_2.geojson';

async function boundaries() {
  const file = new URL('nuts2.json', CACHE);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const res = await fetch(BOUNDARIES, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`boundaries: HTTP ${res.status}`);
  const json = await res.json();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(json));
  return json;
}

const written = JSON.parse(await readFile(SRC, 'utf8'));
const regions = new Map(written.map((r) => [r.code, r]));
const problems = [];

for (const region of written) {
  const where = region.code ?? 'a row with no code';
  if (!Number.isInteger(region.rating) || region.rating < 1 || region.rating > 5) {
    problems.push(`${where}: rating must be a whole number from 1 to 5, got ${region.rating}`);
  }
  for (const field of ['meat', 'veg', 'verdict', 'icons']) {
    if (!region[field]) problems.push(`${where}: needs a ${field}`);
  }
}

const shapes = await boundaries();
const round = (n) => Math.round(n * 1000) / 1000;
const simplify = (coords) =>
  Array.isArray(coords[0]) ? coords.map(simplify) : [round(coords[0]), round(coords[1])];

const features = [];
const seen = new Set();

for (const shape of shapes.features) {
  const { NUTS_ID: code, NAME_LATN: name, CNTR_CODE: country } = shape.properties;
  if (!['ES', 'PT'].includes(country)) continue;

  const region = regions.get(code);
  if (!region) {
    problems.push(`${name} (${code}) has a boundary but nothing written about it`);
    continue;
  }
  seen.add(code);

  features.push({
    type: 'Feature',
    properties: {
      name: name.trim(),
      code,
      rating: region.rating,
      icons: region.icons,
      meat: region.meat,
      veg: region.veg,
      verdict: region.verdict,
    },
    geometry: { type: shape.geometry.type, coordinates: simplify(shape.geometry.coordinates) },
  });
}

for (const code of regions.keys()) {
  if (!seen.has(code)) problems.push(`${code} is written about but has no boundary — wrong code?`);
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in data/food-culture.json:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: 'Eating without meat',
      source: 'Hand-compiled from data/food-culture.json. Boundaries: Eurostat NUTS 2.',
      rating: '1 bring sandwiches, 3 manageable, 5 you will eat better than the carnivores',
      generated: new Date().toISOString().slice(0, 10),
    },
    features,
  }),
);

const band = (n) => features.filter((f) => f.properties.rating === n).map((f) => f.properties.name);
console.log(`Wrote ${features.length} regions`);
console.log(`  bring sandwiches: ${band(1).join(', ')}`);
console.log(`  easy going: ${band(4).concat(band(5)).join(', ')}`);
