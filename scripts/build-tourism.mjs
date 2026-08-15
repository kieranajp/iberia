/**
 * Builds public/data/tourism.geojson: tourist nights and nights per resident,
 * for every province-sized region of Spain and Portugal.
 *
 * Sources, all free and keyless:
 *   Eurostat tour_occ_nin3      nights spent at tourist accommodation, by NUTS 3 region
 *   Eurostat demo_r_pjanaggr3   population, by NUTS 3 region
 *   Eurostat GISCO              NUTS 3 boundaries
 *
 *   node scripts/build-tourism.mjs
 *
 * Eurostat rather than Spain's INE because INE stops at the border, and a blank
 * Portugal reads as "no tourists" rather than "no data". This also counts campsites
 * and holiday flats, which Spain's hotel survey leaves out.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CACHE = new URL('../.cache/tourism-eu/', import.meta.url);
const OUT = new URL('../public/data/tourism.geojson', import.meta.url);
const COUNTRIES = ['ES', 'PT'];
const YEAR = Number(process.argv[process.argv.indexOf('--year') + 1]) || 2024;

const api = (dataset, params) =>
  `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}` +
  `?format=JSON&lang=EN&${params}`;

const SOURCES = {
  nights: api('tour_occ_nin3', `freq=A&c_resid=TOTAL&unit=NR&nace_r2=I551-I553&time=${YEAR}`),
  population: api('demo_r_pjanaggr3', `freq=A&sex=T&age=TOTAL&unit=NR&time=${YEAR}`),
  boundaries:
    'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_10M_2024_4326_LEVL_3.geojson',
};

async function cached(name, url) {
  const file = new URL(`${name}-${YEAR}.json`, CACHE);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(file, JSON.stringify(json));
  return json;
}

/** Eurostat returns JSON-stat: values keyed by flat index, one entry per region here. */
const byRegion = (statistic) => {
  const { index } = statistic.dimension.geo.category;
  return new Map(
    Object.entries(index).map(([code, position]) => [code, statistic.value[position]]),
  );
};

await mkdir(CACHE, { recursive: true });
const [nightsStat, populationStat, boundaries] = await Promise.all([
  cached('nights', SOURCES.nights),
  cached('population', SOURCES.population),
  cached('boundaries', SOURCES.boundaries),
]);

const nights = byRegion(nightsStat);
const population = byRegion(populationStat);

const round = (n) => Math.round(n * 1000) / 1000; // ~110 m, ample at this scale
const simplify = (coords) =>
  Array.isArray(coords[0]) ? coords.map(simplify) : [round(coords[0]), round(coords[1])];

const features = [];
const missing = [];

for (const region of boundaries.features) {
  const { NUTS_ID: code, CNTR_CODE: country, NAME_LATN: name } = region.properties;
  if (!COUNTRIES.includes(country)) continue;

  const stays = nights.get(code);
  const people = population.get(code);
  if (!stays || !people) {
    missing.push(`${name} (${code}): ${!stays ? 'no nights' : 'no population'}`);
    continue;
  }

  features.push({
    type: 'Feature',
    properties: {
      name,
      code,
      country,
      nights: stays,
      population: people,
      per_resident: Math.round((stays / people) * 10) / 10,
    },
    geometry: { type: region.geometry.type, coordinates: simplify(region.geometry.coordinates) },
  });
}

await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: `Tourist nights by region, ${YEAR}`,
      source: 'Eurostat tour_occ_nin3 and demo_r_pjanaggr3, NUTS 3 regions',
      note: 'Hotels, holiday flats and campsites. Spain and Portugal.',
      generated: new Date().toISOString().slice(0, 10),
    },
    features,
  }),
);

const props = features.map((f) => f.properties);
const total = props.reduce((sum, p) => sum + p.nights, 0);
const residents = props.reduce((sum, p) => sum + p.population, 0);
const top = (key) => [...props].sort((a, b) => b[key] - a[key]).slice(0, 6);

console.log(`Wrote ${features.length} regions (${props.filter((p) => p.country === 'PT').length} Portuguese)`);
if (missing.length) console.warn(`No data: ${missing.join(', ')}`);
console.log(`Iberian average: ${(total / residents).toFixed(1)} nights per resident`);
console.log('By volume:', top('nights').map((p) => `${p.name} ${(p.nights / 1e6).toFixed(1)}M`).join(', '));
console.log('By pressure:', top('per_resident').map((p) => `${p.name} ${p.per_resident}`).join(', '));
