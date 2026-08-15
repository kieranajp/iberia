/**
 * Draws public/favicon.svg: the peninsula, from real coastline rather than by eye.
 *
 *   node scripts/build-favicon.mjs
 *
 * Spain and Portugal are drawn as two filled shapes in one colour, so the border
 * between them disappears and the silhouette closes up — no polygon union needed.
 * Islands are dropped: at sixteen pixels they read as dirt on the screen.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CACHE = new URL('../.cache/favicon/', import.meta.url);
const OUT = new URL('../public/favicon.svg', import.meta.url);
const SOURCE =
  'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2024_4326_LEVL_0.geojson';

const MAINLAND = { west: -9.8, east: 3.5, south: 35.9, north: 44.0 };
const SIZE = 64;
const PAD = 2;
const SEA = '#14161a';
const LAND = '#c9a227';

async function outlines() {
  const file = new URL('nuts0.json', CACHE);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`boundaries: HTTP ${res.status}`);
  const json = await res.json();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(json));
  return json;
}

const inside = ([lon, lat]) =>
  lon >= MAINLAND.west && lon <= MAINLAND.east && lat >= MAINLAND.south && lat <= MAINLAND.north;

/** Longitude degrees are shorter than latitude ones this far north. */
const SQUASH = Math.cos((((MAINLAND.north + MAINLAND.south) / 2) * Math.PI) / 180);
const width = (MAINLAND.east - MAINLAND.west) * SQUASH;
const height = MAINLAND.north - MAINLAND.south;
const scale = (SIZE - PAD * 2) / Math.max(width, height);
const left = PAD + ((SIZE - PAD * 2) - width * scale) / 2;
const top = PAD + ((SIZE - PAD * 2) - height * scale) / 2;

const project = ([lon, lat]) => [
  +(left + (lon - MAINLAND.west) * SQUASH * scale).toFixed(2),
  +(top + (MAINLAND.north - lat) * scale).toFixed(2),
];

/** Drop points that would land on top of their neighbour once scaled down. */
function thin(points, minimum = 0.6) {
  const kept = [points[0]];
  for (const point of points.slice(1)) {
    const [x, y] = point;
    const [px, py] = kept[kept.length - 1];
    if (Math.hypot(x - px, y - py) >= minimum) kept.push(point);
  }
  return kept;
}

const geo = await outlines();
const rings = [];

for (const country of geo.features) {
  if (!['ES', 'PT'].includes(country.properties.CNTR_CODE)) continue;
  const polygons =
    country.geometry.type === 'MultiPolygon' ? country.geometry.coordinates : [country.geometry.coordinates];

  for (const polygon of polygons) {
    const ring = polygon[0]; // outer ring only; nobody sees a lake at this size
    if (!ring.every(inside)) continue; // an island, or a fragment reaching off the map
    const drawn = thin(ring.map(project));
    if (drawn.length <= 8) continue;

    /* Anything small is an island, and an island is a smudge at sixteen pixels. */
    const xs = drawn.map(([x]) => x);
    const ys = drawn.map(([, y]) => y);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (extent >= SIZE / 5) rings.push(drawn);
  }
}

const path = rings
  .map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`)
  .join('');

await writeFile(
  OUT,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="10" fill="${SEA}"/>
  <!-- Spain and Portugal are separate outlines. Thinned apart, they leave hairline
       gaps along the shared border, so the stroke closes the seam and softens the coast. -->
  <path d="${path}" fill="${LAND}" stroke="${LAND}" stroke-width="0.9" stroke-linejoin="round"/>
</svg>
`,
);

const points = rings.reduce((sum, ring) => sum + ring.length, 0);
console.log(`Wrote ${rings.length} shape(s), ${points} points, ${(path.length / 1024).toFixed(1)} kB of path`);
