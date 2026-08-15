/**
 * Refreshes data/rainfall-benchmarks.json from the same Open-Meteo daily
 * precipitation series used by the rainfall map.
 *
 *   node scripts/build-rainfall-benchmarks.mjs
 */
import { writeFile } from 'node:fs/promises';

const FROM = 2015;
const TO = 2024;
const OUT = new URL('../data/rainfall-benchmarks.json', import.meta.url);
const LOCATIONS = [
  { label: 'Lanzarote', latitude: 28.963, longitude: -13.548 },
  { label: 'Berlin', latitude: 52.52, longitude: 13.405 },
  { label: 'Derry', latitude: 54.998, longitude: -7.309 },
  { label: 'Keswick', latitude: 54.601, longitude: -3.135 },
];

const url = new URL('https://archive-api.open-meteo.com/v1/archive');
url.searchParams.set('latitude', LOCATIONS.map(({ latitude }) => latitude).join(','));
url.searchParams.set('longitude', LOCATIONS.map(({ longitude }) => longitude).join(','));
url.searchParams.set('start_date', `${FROM}-01-01`);
url.searchParams.set('end_date', `${TO}-12-31`);
url.searchParams.set('daily', 'precipitation_sum');
url.searchParams.set('timezone', 'UTC');

const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
const payload = await response.json();
const results = Array.isArray(payload) ? payload : [payload];
if (results.length !== LOCATIONS.length) {
  throw new Error(`Expected ${LOCATIONS.length} locations, received ${results.length}`);
}

const years = TO - FROM + 1;
const locations = results.map((result, index) => {
  const precipitation = result.daily?.precipitation_sum;
  if (!Array.isArray(precipitation)) {
    throw new Error(`${LOCATIONS[index].label}: response has no daily precipitation_sum`);
  }

  const total = precipitation.reduce((sum, value) => sum + (value ?? 0), 0);
  const rainDays = precipitation.filter((value) => value >= 1).length;
  const veryHeavyDays = precipitation.filter((value) => value >= 20).length;

  return {
    ...LOCATIONS[index],
    model_latitude: result.latitude,
    model_longitude: result.longitude,
    model_elevation_m: result.elevation,
    rainfall_mm: Math.round(total / years),
    rain_days: Math.round(rainDays / years),
    very_heavy_days: Number((veryHeavyDays / years).toFixed(1)),
  };
});

const data = {
  metadata: {
    title: 'Rainfall legend benchmarks',
    source: 'Open-Meteo Historical Weather API, Best Match model',
    source_url: 'https://open-meteo.com/en/docs/historical-weather-api',
    endpoint: url.origin + url.pathname,
    period: `${FROM}-01-01 to ${TO}-12-31`,
    timezone: 'UTC',
    daily_variable: 'precipitation_sum',
    rain_day_threshold_mm: 1,
    very_heavy_rain_day_threshold_mm: 20,
    method:
      'Query the stated town-centre coordinates; total precipitation and qualifying days are divided by ten calendar years. Rainfall and rain-day values are rounded to whole units; very-heavy-rain days to one decimal place.',
    generated: new Date().toISOString().slice(0, 10),
  },
  locations,
};

await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
for (const location of locations) {
  console.log(
    `${location.label}: ${location.rainfall_mm} mm/yr, ` +
      `${location.rain_days} rain days/yr, ` +
      `${location.very_heavy_days} very heavy days/yr`,
  );
}
