/**
 * Builds public/data/rainfall.geojson: annual precipitation and rain-day
 * frequency/intensity measures over Iberia.
 *
 * Source: Open-Meteo Historical Weather API, using its Best Match model (free, no key).
 * Daily totals for 2015-2024 are summed per grid cell and divided by ten. Days
 * with at least 1, 10 and 20 mm are counted and divided by ten, matching the
 * standard rain-day, heavy-rain and very-heavy-rain thresholds. The wettest
 * single day in the period is retained for context.
 * Sea cells are dropped by their reported elevation of exactly 0 m.
 *
 *   node scripts/build-rainfall.mjs [--step 0.5] [--from 2015] [--to 2024]
 *
 * Raw API responses are cached in .cache/, so re-runs cost nothing.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const STEP = Number(arg('step', 0.5));
const FROM = Number(arg('from', 2015));
const TO = Number(arg('to', 2024));
const BOUNDS = { west: -9.75, east: 3.75, south: 36.0, north: 44.0 };
const BATCH = 25;
const CACHE = new URL('../.cache/rainfall/', import.meta.url);
const OUT = new URL('../public/data/rainfall.geojson', import.meta.url);

const round = (n) => Number(n.toFixed(4));

function msToNextHour() {
  const now = new Date();
  return (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 + 30_000;
}

function grid() {
  const points = [];
  for (let lat = BOUNDS.south; lat <= BOUNDS.north + 1e-9; lat += STEP) {
    for (let lon = BOUNDS.west; lon <= BOUNDS.east + 1e-9; lon += STEP) {
      points.push({ lat: round(lat), lon: round(lon) });
    }
  }
  return points;
}

/** Open-Meteo returns a bare object, not a list, when a batch holds a single point. */
const asList = (json) => (Array.isArray(json) ? json : [json]);

async function fetchBatch(points, index) {
  const file = new URL(`batch-${STEP}-${FROM}-${TO}-${index}.json`, CACHE);
  if (existsSync(file)) return asList(JSON.parse(await readFile(file, 'utf8')));

  const url =
    'https://archive-api.open-meteo.com/v1/archive' +
    `?latitude=${points.map((p) => p.lat).join(',')}` +
    `&longitude=${points.map((p) => p.lon).join(',')}` +
    `&start_date=${FROM}-01-01&end_date=${TO}-12-31` +
    '&daily=precipitation_sum&timezone=UTC';

  for (let attempt = 1; attempt <= 6; ) {
    let wait = attempt * 15_000;
    let queued = false; // waiting for the quota window is not a failed attempt
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (res.ok) {
        const json = await res.json();
        await writeFile(file, JSON.stringify(json));
        return asList(json);
      }
      if (res.status === 429) {
        const { reason = '' } = await res.json().catch(() => ({}));
        queued = /hourly/i.test(reason);
        wait = queued ? msToNextHour() : attempt * 60_000;
        console.warn(`  batch ${index}: ${reason || 'rate limited'} — waiting ${Math.round(wait / 60_000)} min`);
      } else {
        console.warn(`  batch ${index}: HTTP ${res.status}, retrying in ${wait / 1000}s`);
      }
    } catch (err) {
      // Open-Meteo drops connections when it throttles, so this is the common path.
      console.warn(`  batch ${index}: ${err.cause?.code ?? err.name}, retrying in ${wait / 1000}s`);
    }
    if (!queued) attempt++;
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`batch ${index} failed after 6 attempts — re-run to resume from the cache`);
}

function downpourBand(days) {
  if (days < 2) return 1;
  if (days < 5) return 2;
  if (days < 12) return 3;
  if (days < 20) return 4;
  return 5;
}

function cell(point, mm, rainDays, heavyDays, veryHeavyDays, wettestDay, elevation) {
  const h = STEP / 2;
  const { lat, lon } = point;
  return {
    type: 'Feature',
    properties: {
      mm: Math.round(mm),
      rain_days: Math.round(rainDays),
      heavy_days: Math.round(heavyDays),
      very_heavy_days: Math.round(veryHeavyDays),
      wettest_day: Math.round(wettestDay),
      downpour_band: downpourBand(veryHeavyDays),
      elevation: Math.round(elevation),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [round(lon - h), round(lat - h)],
          [round(lon + h), round(lat - h)],
          [round(lon + h), round(lat + h)],
          [round(lon - h), round(lat + h)],
          [round(lon - h), round(lat - h)],
        ],
      ],
    },
  };
}

const points = grid();
const years = TO - FROM + 1;
await mkdir(CACHE, { recursive: true });
console.log(`${points.length} grid points at ${STEP}°, ${years} years, ${Math.ceil(points.length / BATCH)} requests`);

const features = [];
let sea = 0;

for (let i = 0; i < points.length; i += BATCH) {
  const slice = points.slice(i, i + BATCH);
  const index = i / BATCH;
  const results = await fetchBatch(slice, index);

  results.forEach((result, n) => {
    if (result.elevation === 0) return void sea++; // open water
    const daily = result.daily.precipitation_sum;
    const total = daily.reduce((sum, v) => sum + (v ?? 0), 0);
    const rainDays = daily.filter((v) => v >= 1).length;
    const heavyDays = daily.filter((v) => v >= 10).length;
    const veryHeavyDays = daily.filter((v) => v >= 20).length;
    const wettestDay = Math.max(...daily.map((v) => v ?? 0));
    features.push(
      cell(
        slice[n],
        total / years,
        rainDays / years,
        heavyDays / years,
        veryHeavyDays / years,
        wettestDay,
        result.elevation,
      ),
    );
  });

  console.log(`  ${Math.min(i + BATCH, points.length)}/${points.length} points`);
}

const mm = features.map((f) => f.properties.mm).sort((a, b) => a - b);
const rainDays = features.map((f) => f.properties.rain_days).sort((a, b) => a - b);
const veryHeavyDays = features
  .map((f) => f.properties.very_heavy_days)
  .sort((a, b) => a - b);
await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: `Mean annual precipitation and rain days ${FROM}-${TO}`,
      source: 'Open-Meteo Historical Weather API, Best Match model',
      resolution: `${STEP} degrees`,
      rain_day_threshold_mm: 1,
      heavy_rain_day_threshold_mm: 10,
      very_heavy_rain_day_threshold_mm: 20,
      generated: new Date().toISOString().slice(0, 10),
    },
    features,
  }),
);

console.log(
  `\nWrote ${features.length} land cells (${sea} sea cells dropped)\n` +
    `Rainfall ${mm[0]}-${mm[mm.length - 1]} mm, median ${mm[Math.floor(mm.length / 2)]} mm\n` +
    `Rain days ${rainDays[0]}-${rainDays[rainDays.length - 1]}, ` +
    `median ${rainDays[Math.floor(rainDays.length / 2)]}\n` +
    `Very heavy rain days ${veryHeavyDays[0]}-${veryHeavyDays[veryHeavyDays.length - 1]}, ` +
    `median ${veryHeavyDays[Math.floor(veryHeavyDays.length / 2)]}`,
);
