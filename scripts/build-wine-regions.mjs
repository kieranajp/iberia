/**
 * Builds public/data/wine-regions.geojson by joining our editorial region
 * records to simplified MAPA and IVV wine-region polygons.
 *
 *   node scripts/build-wine-regions.mjs
 *
 * Campo de Calatrava post-dates the source map and comes from the municipalities
 * named in its specification. Tiny Urbezo receives a deliberately approximate
 * footprint matching its documented 232-hectare scale. Portugal is represented
 * by IVV's 12 mainland wine regions rather than its overlapping individual DOPs.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const REGIONS = new URL('../data/wine-regions.json', import.meta.url);
const BOUNDARIES = new URL('../data/wine-boundaries.geojson', import.meta.url);
const OUT = new URL('../public/data/wine-regions.geojson', import.meta.url);
const CATEGORIES = ['DOCa', 'DO', 'Portuguese wine region'];

const SOURCE_NAMES = {
  Binissalem: 'Binissalem-Mallorca',
  León: 'Tierra de León',
  Empordà: 'Ampurdán-Costa Brava',
  Penedès: 'Penedés, Comunidad de Cataluña',
  Priorat: 'Priorato, Comunidad de Cataluña',
  'Arabako Txakolina': 'Arabako Txakolina-Txakolí de Álava',
  'Bizkaiko Txakolina': 'Chacolí de Bizkaia-Bizkaiko Txakolina',
  'Getariako Txakolina': 'Chacolí de Getaria-Getariako Txakolina',
};

const APPROXIMATE_RADIUS_KM = {
  Urbezo: 0.9,
};

const APPROXIMATE_CENTRES = {
  // Polígono 35, Cariñena: northwest of the town around the Virgen de Lagunas.
  Urbezo: [-1.24, 41.405],
};

const normalise = (name) =>
  name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function circle(lon, lat, radiusKm) {
  const coordinates = [];
  const latitudeRadius = radiusKm / 111.32;
  const longitudeRadius = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    coordinates.push([
      Number((lon + Math.cos(angle) * longitudeRadius).toFixed(5)),
      Number((lat + Math.sin(angle) * latitudeRadius).toFixed(5)),
    ]);
  }
  return { type: 'Polygon', coordinates: [coordinates] };
}

function combine(features) {
  const polygons = features.flatMap(({ geometry }) =>
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
  );
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
}

const regions = JSON.parse(await readFile(REGIONS, 'utf8'));
const boundaryData = JSON.parse(await readFile(BOUNDARIES, 'utf8'));
const boundaries = new Map();
for (const feature of boundaryData.features) {
  const key = normalise(feature.properties.source_name);
  boundaries.set(key, [...(boundaries.get(key) ?? []), feature]);
}

const problems = [];
const seen = new Set();
const features = [];

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
  }
  if (!region.note) problems.push(`${where}: needs a note, that is the point of it`);

  const sourceName = SOURCE_NAMES[region.name] ?? region.name;
  const matches = boundaries.get(normalise(sourceName));
  const radius = APPROXIMATE_RADIUS_KM[region.name];
  if (!matches && !radius) problems.push(`${where}: no boundary matches “${sourceName}”`);

  const { lon, lat, ...properties } = region;
  const [approximateLon = lon, approximateLat = lat] = APPROXIMATE_CENTRES[region.name] ?? [];
  features.push({
    type: 'Feature',
    properties: {
      ...properties,
      country: region.category === 'Portuguese wine region' ? 'Portugal' : 'Spain',
      boundary: matches ? matches[0].properties.boundary : 'Approximate',
    },
    geometry: matches ? combine(matches) : circle(approximateLon, approximateLat, radius),
  });
}

if (problems.length) {
  console.error(`${problems.length} problem(s) building wine regions:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: 'Iberian wine regions',
      source:
        '© Ministerio de Agricultura, Pesca y Alimentación (MAPA), March 2014; ' +
        'Instituto da Vinha e do Vinho (IVV), 2023; Eurostat GISCO LAU 2024',
      note:
        'Names, categories and editorial notes come from data/wine-regions.json. ' +
        'Boundaries are simplified MAPA polygons for 70 denominations; Campo de Calatrava ' +
        'uses its 16 Eurostat municipal polygons, Urbezo is an approximate footprint, and ' +
        'Portugal uses the 12 mainland regions in IVV\'s official 2023 shapefile.',
      source_detail: 'MAPA scale 1:25,000; IVV regional polygons; simplified for web display',
      scope:
        'Spain: DO and DOCa only — excludes Vino de Pago, Vino de Calidad and IGP/Vino de la Tierra. ' +
        'Portugal: mainland wine regions, not individual DOP or IGP boundaries.',
      caveat: 'Campo de Calatrava uses its 16 member municipalities; Urbezo is an approximate 232-hectare footprint.',
      generated: new Date().toISOString().slice(0, 10),
    },
    features,
  }),
);

const mapa = features.filter((feature) => feature.properties.boundary === 'MAPA 2014').length;
const ivv = features.filter((feature) => feature.properties.boundary === 'IVV 2023').length;
const eurostat = features.filter((feature) => feature.properties.boundary.startsWith('Eurostat')).length;
const approximate = features.length - mapa - ivv - eurostat;
console.log(
  `Wrote ${features.length} wine-region areas ` +
    `(${mapa} MAPA, ${ivv} IVV, ${eurostat} Eurostat, ${approximate} approximate)`,
);
