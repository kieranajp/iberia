/**
 * Builds public/data/resorts.geojson from data/resorts.json.
 *
 *   node scripts/build-resorts.mjs
 *
 * The ratings are hand-compiled, so the source is a flat list in `data/` where one
 * place is one line and a diff reads like an argument about Benidorm. This script
 * only wraps it in GeoJSON, so that `public/data` holds nothing but build output.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SRC = new URL('../data/resorts.json', import.meta.url);
const OUT = new URL('../public/data/resorts.geojson', import.meta.url);
const NATIONS = ['british', 'german', 'french', 'spanish'];

const places = JSON.parse(await readFile(SRC, 'utf8'));
const problems = [];

for (const [i, place] of places.entries()) {
  const where = `${place.name ?? `row ${i}`}`;
  if (!place.name || !place.region) problems.push(`${where}: needs a name and a region`);
  if (typeof place.lon !== 'number' || typeof place.lat !== 'number') {
    problems.push(`${where}: needs numeric lon and lat`);
  } else if (place.lon < -10 || place.lon > 5 || place.lat < 35 || place.lat > 44.5) {
    problems.push(`${where}: ${place.lon}, ${place.lat} is outside Iberia — lon and lat swapped?`);
  }
  for (const nation of NATIONS) {
    const rating = place[nation];
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      problems.push(`${where}: ${nation} must be a whole number from 0 to 5, got ${rating}`);
    }
  }
  if (!place.note) problems.push(`${where}: needs a note, that is the point of it`);
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in data/resorts.json:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: 'Who holidays where',
      source: 'Hand-compiled from data/resorts.json. Ratings are a judgement call, not a statistic.',
      rating: '0 not notable, 1 light, 3 heavy, 5 the defining crowd of the place',
      scope: 'Spain and Portugal: resorts, plus the cities tourists actually go to.',
      generated: new Date().toISOString().slice(0, 10),
    },
    features: places.map(({ lon, lat, ...properties }) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [lon, lat] },
    })),
  }),
);

const busiest = (nation) =>
  places.filter((p) => p[nation] === 5).map((p) => p.name).join(', ') || 'nowhere';

console.log(`Wrote ${places.length} places`);
for (const nation of NATIONS) console.log(`  ${nation} 5/5: ${busiest(nation)}`);
