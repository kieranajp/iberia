/**
 * Builds public/data/winter-light.geojson: mean winter solar energy and
 * astronomical day length over Iberia.
 *
 * NASA POWER's all-sky surface shortwave irradiance is direct and diffuse
 * sunlight reaching the ground. It is a useful proxy for how much natural light
 * a winter supplies, but it is not visible-light exposure or a SAD risk score.
 *
 * Monthly means for December, January and February 2015-2024 are weighted by
 * days in the month. NASA's native 1° solar grid is masked to Spain and Portugal
 * with Eurostat GISCO boundaries. Two regional requests are required because
 * POWER limits a request to ten degrees of longitude.
 *
 *   node scripts/build-winter-light.mjs [--from 2015] [--to 2024]
 *
 * Raw API responses are cached in .cache/, so re-runs cost nothing.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const FROM = Number(arg('from', 2015));
const TO = Number(arg('to', 2024));
const STEP = 1;
const CACHE = new URL('../.cache/winter-light/', import.meta.url);
const OUT = new URL('../public/data/winter-light.geojson', import.meta.url);
const BOUNDARIES_URL =
  'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/' +
  'NUTS_RG_10M_2024_4326_LEVL_0.geojson';
const REGIONS = [
  { id: 'west', west: -9.75, east: -3 },
  { id: 'east', west: -3, east: 3.75 },
];

async function cachedJson(name, url) {
  const file = new URL(name, CACHE);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} — ${await res.text()}`);
  const json = await res.json();
  await writeFile(file, JSON.stringify(json));
  return json;
}

function powerUrl({ west, east }) {
  const url = new URL('https://power.larc.nasa.gov/api/temporal/monthly/regional');
  url.searchParams.set('latitude-min', '36');
  url.searchParams.set('latitude-max', '44');
  url.searchParams.set('longitude-min', String(west));
  url.searchParams.set('longitude-max', String(east));
  url.searchParams.set('parameters', 'ALLSKY_SFC_SW_DWN');
  url.searchParams.set('community', 'RE');
  url.searchParams.set('start', String(FROM));
  url.searchParams.set('end', String(TO));
  url.searchParams.set('format', 'JSON');
  return url;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (
      (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const pointInPolygon = (point, polygon) =>
  pointInRing(point, polygon[0]) &&
  !polygon.slice(1).some((hole) => pointInRing(point, hole));

function pointInGeometry(point, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function meanWinterRadiation(values) {
  let weighted = 0;
  let days = 0;
  for (const [period, value] of Object.entries(values)) {
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(4));
    if (![1, 2, 12].includes(month) || !Number.isFinite(value) || value === -999) continue;
    const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    weighted += value * monthDays;
    days += monthDays;
  }
  if (!days) throw new Error('NASA POWER response has no winter radiation values');
  return weighted / days;
}

function meanWinterDaylight(latitude) {
  const phi = (latitude * Math.PI) / 180;
  const sunriseAltitude = (-0.833 * Math.PI) / 180;
  let total = 0;
  let days = 0;

  for (let year = FROM; year <= TO; year++) {
    const yearStart = Date.UTC(year, 0, 1);
    const yearDays = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
    for (let time = yearStart; time < Date.UTC(year + 1, 0, 1); time += 86_400_000) {
      const date = new Date(time);
      if (![0, 1, 11].includes(date.getUTCMonth())) continue;
      const day = Math.floor((time - yearStart) / 86_400_000) + 1;
      const gamma = (2 * Math.PI * (day - 1)) / yearDays;
      const declination =
        0.006918 -
        0.399912 * Math.cos(gamma) +
        0.070257 * Math.sin(gamma) -
        0.006758 * Math.cos(2 * gamma) +
        0.000907 * Math.sin(2 * gamma) -
        0.002697 * Math.cos(3 * gamma) +
        0.00148 * Math.sin(3 * gamma);
      const cosine =
        (Math.sin(sunriseAltitude) - Math.sin(phi) * Math.sin(declination)) /
        (Math.cos(phi) * Math.cos(declination));
      total += (24 * Math.acos(Math.max(-1, Math.min(1, cosine)))) / Math.PI;
      days++;
    }
  }
  return total / days;
}

const round = (value) => Number(value.toFixed(4));

function cell(lon, lat, radiation) {
  const h = STEP / 2;
  return {
    type: 'Feature',
    properties: {
      light_mj: Number((radiation * 3.6).toFixed(2)),
      daylight_h: Number(meanWinterDaylight(lat).toFixed(2)),
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

await mkdir(CACHE, { recursive: true });
const [boundaryData, ...regionData] = await Promise.all([
  cachedJson('nuts-0-2024.json', BOUNDARIES_URL),
  ...REGIONS.map((region) =>
    cachedJson(`nasa-power-${region.id}-${FROM}-${TO}.json`, powerUrl(region)),
  ),
]);
const boundaries = boundaryData.features.filter(({ properties }) =>
  ['ES', 'PT'].includes(properties.CNTR_CODE),
);

const points = new Map();
for (const region of regionData) {
  for (const feature of region.features) {
    const [lon, lat] = feature.geometry.coordinates;
    if (!boundaries.some(({ geometry }) => pointInGeometry([lon, lat], geometry))) continue;
    const values = feature.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    if (!values) throw new Error(`NASA POWER point ${lon},${lat} has no radiation series`);
    points.set(`${lon},${lat}`, { lon, lat, radiation: meanWinterRadiation(values) });
  }
}

const features = [...points.values()].map(({ lon, lat, radiation }) => cell(lon, lat, radiation));
const light = features.map((feature) => feature.properties.light_mj).sort((a, b) => a - b);
const daylight = features
  .map((feature) => feature.properties.daylight_h)
  .sort((a, b) => a - b);

await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: `Mean winter light over Iberia, ${FROM}-${TO}`,
      source: 'NASA POWER Monthly and Annual API, SYN1DEG; Eurostat GISCO NUTS 0 boundaries',
      source_url: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',
      land_mask_url: BOUNDARIES_URL,
      resolution: '1 degree (native NASA POWER solar grid)',
      period: `${FROM}-01-01 to ${TO}-12-31`,
      months: ['December', 'January', 'February'],
      metric:
        'Day-weighted mean of monthly all-sky surface shortwave downward irradiance, converted from kWh/m²/day to MJ/m²/day',
      method:
        'NASA POWER monthly means are weighted by days in each December, January and February. Astronomical daylight duration is calculated at each grid latitude. Solar energy is used as a proxy for outdoor natural light, not as a clinical SAD risk score.',
      relevance_source:
        'Sarran et al. (2017), Meteorological analysis of symptom data for people with seasonal affective disorder',
      relevance_doi: '10.1016/j.psychres.2017.08.019',
      generated: new Date().toISOString().slice(0, 10),
    },
    features,
  }),
);

console.log(
  `Wrote ${features.length} land cells\n` +
    `Winter light ${light[0]}-${light[light.length - 1]} MJ/m²/day, ` +
    `median ${light[Math.floor(light.length / 2)]}\n` +
    `Daylight ${daylight[0]}-${daylight[daylight.length - 1]} h/day`,
);
