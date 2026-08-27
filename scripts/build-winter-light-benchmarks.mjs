/**
 * Refreshes data/winter-light-benchmarks.json from the same NASA POWER monthly
 * solar-radiation series used by the winter-light map.
 *
 *   node scripts/build-winter-light-benchmarks.mjs
 */
import { writeFile } from 'node:fs/promises';

const FROM = 2015;
const TO = 2024;
const OUT = new URL('../data/winter-light-benchmarks.json', import.meta.url);
const LOCATIONS = [
  { label: 'Derry', latitude: 54.998, longitude: -7.309 },
  { label: 'Berlin', latitude: 52.52, longitude: 13.405 },
];

function powerUrl({ latitude, longitude }) {
  const url = new URL('https://power.larc.nasa.gov/api/temporal/monthly/point');
  url.searchParams.set('parameters', 'ALLSKY_SFC_SW_DWN');
  url.searchParams.set('community', 'RE');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start', String(FROM));
  url.searchParams.set('end', String(TO));
  url.searchParams.set('format', 'JSON');
  return url;
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

const results = await Promise.all(
  LOCATIONS.map(async (location) => {
    const response = await fetch(powerUrl(location), { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) {
      throw new Error(`${location.label}: NASA POWER returned HTTP ${response.status}`);
    }
    return response.json();
  }),
);

const locations = results.map((result, index) => {
  const values = result.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  if (!values) throw new Error(`${LOCATIONS[index].label}: response has no radiation series`);
  return {
    ...LOCATIONS[index],
    source_elevation_m: result.geometry.coordinates[2],
    light_mj: Number((meanWinterRadiation(values) * 3.6).toFixed(2)),
    daylight_h: Number(meanWinterDaylight(LOCATIONS[index].latitude).toFixed(2)),
  };
});

const data = {
  metadata: {
    title: 'Winter-light legend benchmarks',
    source: 'NASA POWER Monthly and Annual API, SYN1DEG',
    source_url: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',
    endpoint: 'https://power.larc.nasa.gov/api/temporal/monthly/point',
    period: `${FROM}-01-01 to ${TO}-12-31`,
    months: ['December', 'January', 'February'],
    parameter: 'ALLSKY_SFC_SW_DWN',
    method:
      'Query the stated town-centre coordinates and weight the NASA POWER monthly mean all-sky surface irradiance by the days in each December, January and February. Convert kWh/m²/day to MJ/m²/day and round to two decimals. Calculate astronomical daylight duration from latitude.',
    generated: new Date().toISOString().slice(0, 10),
  },
  locations,
};

await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
for (const location of locations) {
  console.log(
    `${location.label}: ${location.light_mj} MJ/m²/day, ${location.daylight_h} h daylight/day`,
  );
}
