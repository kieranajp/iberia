/** Builds the hand-compiled regional-drinks guide on Eurostat NUTS 2 boundaries. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CACHE = new URL('../.cache/food/', import.meta.url);
const SRC = new URL('../data/regional-drinks.json', import.meta.url);
const OUT = new URL('../public/data/regional-drinks.geojson', import.meta.url);
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

const authored = JSON.parse(await readFile(SRC, 'utf8'));
const regions = new Map(authored.regions.map((region) => [region.code, region]));
const problems = [];

for (const region of authored.regions) {
  for (const field of ['code', 'icon', 'family', 'drink', 'ritual', 'also', 'note']) {
    if (!region[field]) problems.push(`${region.code ?? 'unknown row'}: needs ${field}`);
  }
}

const shapes = await boundaries();
const round = (number) => Math.round(number * 1000) / 1000;
const simplify = (coordinates) =>
  Array.isArray(coordinates[0])
    ? coordinates.map(simplify)
    : [round(coordinates[0]), round(coordinates[1])];
const features = [];
const seen = new Set();

for (const shape of shapes.features) {
  const { NUTS_ID: code, NAME_LATN: name, CNTR_CODE: country } = shape.properties;
  if (!['ES', 'PT'].includes(country)) continue;
  const region = regions.get(code);
  if (!region) {
    problems.push(`${name} (${code}) has a boundary but no authored drink`);
    continue;
  }
  seen.add(code);
  features.push({
    type: 'Feature',
    properties: { name: name.trim(), ...region },
    geometry: { type: shape.geometry.type, coordinates: simplify(shape.geometry.coordinates) },
  });
}

for (const code of regions.keys()) {
  if (!seen.has(code)) problems.push(`${code} has a drink but no NUTS 2 boundary`);
}
if (problems.length) {
  console.error(`${problems.length} problem(s) in data/regional-drinks.json:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      ...authored.metadata,
      boundaries: 'Eurostat GISCO NUTS 2024',
      generated: new Date().toISOString().slice(0, 10),
    },
    features,
  }),
);
console.log(`Wrote ${features.length} regional drink guides`);
