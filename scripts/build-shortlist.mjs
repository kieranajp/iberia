/**
 * Scores every region for one particular trip: good food without meat, wine on the
 * doorstep, no persistent drizzle, and as few British tourists as possible.
 *
 *   node scripts/build-shortlist.mjs
 *
 * Writes .cache/shortlist.json — the numbers behind the presentation, plus the
 * region outlines as SVG paths so the deck needs no map library and no network.
 *
 * Everything here is derived from the layers the map already ships. Nothing is
 * invented, and the weights are stated rather than buried: see WEIGHTS.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(`public/data/${name}.geojson`, root), 'utf8'));

/**
 * Stated up front so the ranking can be argued with.
 *
 * British presence is not one weight among four: as a weight it did nothing, because
 * most regions hold no resort at all and so tied on a perfect score. It is a multiplier
 * instead, which is what "most importantly" actually means — one saturated resort can
 * sink a region however good its wine is.
 */
const WEIGHTS = { food: 0.40, wine: 0.30, drizzle: 0.30 };
const BRIT_PENALTY = 0.18; // per point of the worst resort in the region, out of 5

/** Fish on the menu is fine, so a fish-forward region is not the problem pork is. */
const FISH = /bacalhau|pescaíto|sardinha|choco|anchoa|pulpo|marisco|lapas|cataplana|peixe|fish|cod|txakol|kokotxas|pil-pil/i;

const [food, wine, rain, resorts, provinces] = await Promise.all(
  ['food-culture', 'wine-regions', 'rainfall', 'resorts', 'tourism'].map(read),
);

/* --- geometry helpers: everything else is a point-in-region question --- */

const rings = (geometry) =>
  geometry.type === 'MultiPolygon' ? geometry.coordinates.map((p) => p[0]) : [geometry.coordinates[0]];

function contains(geometry, [x, y]) {
  let inside = false;
  for (const ring of rings(geometry)) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const centroid = (geometry) => {
  const points = rings(geometry).flat();
  const sum = points.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
};

/* --- gather the four signals per province --- */

/**
 * Provinces, not regions. Andalucía is the size of Portugal and contains both the
 * Costa del Sol and the Cádiz coast, so scoring it as one unit punished Jaén for
 * Torremolinos. Wine, rain and British presence are all counted per province.
 *
 * Food stays regional: Andalusian cooking is Andalusian whether you eat it in Cádiz
 * or Jaén, and there is no provincial rating to be had. NUTS 3 codes nest inside
 * NUTS 2, so a province inherits its region's food by dropping the last character.
 */
const regionFood = new Map(food.features.map((f) => [f.properties.code, f.properties]));

const regions = provinces.features.map((feature) => {
  const { name, code } = feature.properties;
  const parent = regionFood.get(code.slice(0, 4));
  if (!parent) return null;
  const { rating, meat, veg, verdict, icons } = parent;
  const region = parent.name;
  const geometry = feature.geometry;

  const wines = wine.features.filter((w) => contains(geometry, centroid(w.geometry)));
  let cells = rain.features.filter((c) => contains(geometry, centroid(c.geometry)));
  if (!cells.length) {
    /* A province smaller than one 55 km cell: take the closest cell rather than nothing. */
    const here = centroid(geometry);
    const nearest = rain.features.reduce((best, cell) => {
      const [x, y] = centroid(cell.geometry);
      const distance = Math.hypot(x - here[0], y - here[1]);
      return distance < best.distance ? { cell, distance } : best;
    }, { cell: null, distance: Infinity });
    cells = nearest.cell ? [nearest.cell] : [];
  }
  const places = resorts.features.filter((r) => contains(geometry, r.geometry.coordinates));

  const drizzle = cells.length
    ? Math.round(cells.reduce((sum, c) => sum + c.properties.rain_days, 0) / cells.length)
    : null;
  const downpours = cells.length
    ? +(cells.reduce((sum, c) => sum + c.properties.very_heavy_days, 0) / cells.length).toFixed(1)
    : null;

  /* The average, not the worst: one Salou should dock Catalonia, not disqualify a
     region the size of Wales. The worst offenders are named in `worst` regardless. */
  const brits = places.length
    ? +(places.reduce((sum, p) => sum + p.properties.british, 0) / places.length).toFixed(1)
    : 0;
  const worst = places.filter((p) => p.properties.british >= 4).map((p) => p.properties.name);

  return {
    name,
    code,
    region,
    rating,
    fishy: FISH.test(meat),
    meat,
    veg,
    verdict,
    icons,
    wines: wines.length,
    wineNames: wines.map((w) => w.properties.name).sort(),
    drizzle,
    downpours,
    brits,
    worst,
    places: places.length,
    rated: places.map((p) => p.properties.name),
  };
}).filter(Boolean);

/* --- score, on a stated 0-100 for each part --- */

/**
 * Iberia, both countries, now that the wine layer covers Portugal too.
 *
 * The Canaries are left out on purpose: we live there. Nobody plans a holiday to their
 * own island, and including them would rank the view from the kitchen window.
 */
const HOME = 'ES70'; // Canarias
const SCORED_COUNTRIES = ['ES', 'PT'];
const spanish = regions.filter(
  (r) => r.drizzle !== null && SCORED_COUNTRIES.includes(r.code.slice(0, 2)) && !r.code.startsWith(HOME),
);
console.log(`${spanish.length} provinces in play, ${spanish.filter((r) => !r.places).length} with no place rated`);

/* Somewhere you cannot eat is not a candidate, however good its wine is. Rating 1 is
   "bring sandwiches"; these are reported rather than ranked. */
const inedible = spanish.filter((r) => r.rating <= 1);
const usable = spanish.filter((r) => r.rating > 1);
const mostWine = Math.max(...spanish.map((r) => r.wines));
const wettest = Math.max(...spanish.map((r) => r.drizzle));
const driest = Math.min(...spanish.map((r) => r.drizzle));

/* Every province gets a mark on all four questions, including the ones ruled out for
   food. Castilla y León has nine denominations and real weather: on those questions it
   belongs on the map like anywhere else, and is only absent from the final score. */
for (const region of spanish) {
  // Vegetarian rating carries it, and a fish-forward region gets half a band back.
  const food100 = ((region.rating + (region.fishy ? 0.5 : 0) - 1) / 4) * 100;
  const wine100 = (region.wines / mostWine) * 100;
  const drizzle100 = ((wettest - region.drizzle) / (wettest - driest)) * 100;
  const brits100 = ((5 - region.brits) / 5) * 100;

  region.parts = {
    food: Math.round(Math.min(100, food100)),
    wine: Math.round(wine100),
    drizzle: Math.round(drizzle100),
    brits: Math.round(brits100),
  };
  region.britFactor = +(1 - BRIT_PENALTY * region.brits).toFixed(2);
  region.merit = Math.round(
    region.parts.food * WEIGHTS.food +
      region.parts.wine * WEIGHTS.wine +
      region.parts.drizzle * WEIGHTS.drizzle,
  );
  region.score = Math.round(region.merit * region.britFactor);
}

usable.sort((a, b) => b.score - a.score);

/* --- outlines as SVG paths, so the deck carries no map library --- */

const BOUNDS = { west: -9.8, east: 4.4, south: 35.8, north: 44.0 };
const SQUASH = Math.cos((((BOUNDS.north + BOUNDS.south) / 2) * Math.PI) / 180);
const WIDTH = 760;
const scale = WIDTH / ((BOUNDS.east - BOUNDS.west) * SQUASH);
const HEIGHT = Math.round((BOUNDS.north - BOUNDS.south) * scale);

const project = ([lon, lat]) => [
  +((lon - BOUNDS.west) * SQUASH * scale).toFixed(1),
  +((BOUNDS.north - lat) * scale).toFixed(1),
];

function thin(points, minimum = 1.4) {
  const kept = [points[0]];
  for (const point of points.slice(1)) {
    const [px, py] = kept[kept.length - 1];
    if (Math.hypot(point[0] - px, point[1] - py) >= minimum) kept.push(point);
  }
  return kept;
}

for (const region of regions) {
  const feature = provinces.features.find((f) => f.properties.code === region.code);
  region.path = rings(feature.geometry)
    .map((ring) => thin(ring.map(project)))
    .filter((ring) => ring.length > 6)
    .map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`)
    .join('');
}

/* Not in .release/: `npm run release` wipes that directory before packaging. */
const out = new URL('.cache/shortlist.json', root);
await mkdir(new URL('.cache/', root), { recursive: true });
await writeFile(
  out,
  JSON.stringify({
    weights: WEIGHTS,
    britPenalty: BRIT_PENALTY,
    /* Whatever is not ranked and not ruled out is drawn flat, so an exclusion reads as
       a decision rather than a hole in the map. Empties itself once everything scores. */
    context: regions
      .filter((r) => r.path && !usable.includes(r) && !inedible.includes(r))
      .map((r) => ({ name: r.name, path: r.path })),
    inedible: inedible.map((r) => ({
      name: r.name,
      region: r.region,
      verdict: r.verdict,
      icons: r.icons,
      meat: r.meat,
      path: r.path,
      drizzle: r.drizzle,
      downpours: r.downpours,
      wines: r.wines,
      brits: r.brits,
      rated: r.rated,
      parts: r.parts,
    })),
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    regions: usable.map(({ path, ...rest }) => ({ ...rest, path })),
  }),
);

console.log(`Scored ${usable.length} regions. Weights: ${JSON.stringify(WEIGHTS)}`);
console.log('\nTop 8:');
for (const [i, r] of usable.slice(0, 8).entries()) {
  console.log(
    `${String(i + 1).padStart(2)}. ${r.name.padEnd(28)} ${String(r.score).padStart(3)} ` +
      `| food ${String(r.parts.food).padStart(3)} wine ${String(r.parts.wine).padStart(3)} ` +
      `dry ${String(r.parts.drizzle).padStart(3)} | merit ${String(r.merit).padStart(3)} ` +
      `x${r.britFactor} | ${r.wines} DO, ${r.drizzle} wet days${r.rated.length ? ' — ' + r.rated.join(', ') : ' — nothing rated'}`,
  );
}
console.log('\nBottom 3:');
for (const r of usable.slice(-3)) console.log(`    ${r.name.padEnd(28)} ${r.score} (${r.worst.join(', ') || 'no resorts'})`);
console.log(`\nRuled out, cannot eat: ${inedible.map((r) => r.name).join(', ')}`);
