/**
 * Builds a city-level guide to international-cuisine availability from
 * OpenStreetMap restaurant and takeaway cuisine tags.
 *
 *   node scripts/build-international-cuisine.mjs [--refresh]
 *
 * Raw Overpass responses are cached in .cache/. The bands are deliberately
 * qualitative: mapped counts are a floor, so an empty tag is never presented
 * as proof that a cuisine does not exist in a city.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SRC = new URL('../data/international-cuisine-cities.json', import.meta.url);
const CACHE = new URL('../.cache/international-cuisine/', import.meta.url);
const OUT = new URL('../public/data/international-cuisine.geojson', import.meta.url);
const REFRESH = process.argv.includes('--refresh');

let endpoints = [
  process.env.OVERPASS_URL,
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
].filter(Boolean);

const REQUEST_HEADERS = {
  accept: 'application/json',
  'user-agent': 'iberia-map-data-builder/0.3 (OpenStreetMap cuisine snapshot)',
};
let ohsomeTime;

const CUISINES = [
  { label: 'Italian', icon: '🇮🇹', aliases: ['italian', 'pizza', 'pasta'] },
  { label: 'Chinese', icon: '🇨🇳', aliases: ['chinese'] },
  {
    label: 'Japanese',
    icon: '🇯🇵',
    aliases: ['japanese', 'sushi', 'ramen', 'udon', 'yakitori', 'yakiniku', 'teppanyaki'],
  },
  { label: 'Korean', icon: '🇰🇷', aliases: ['korean'] },
  { label: 'Thai', icon: '🇹🇭', aliases: ['thai'] },
  { label: 'Vietnamese', icon: '🇻🇳', aliases: ['vietnamese'] },
  {
    label: 'Indian & South Asian',
    icon: '🇮🇳',
    aliases: ['indian', 'pakistani', 'bangladeshi', 'nepalese', 'sri_lankan'],
  },
  { label: 'Mexican', icon: '🇲🇽', aliases: ['mexican', 'tex-mex', 'tex_mex', 'taco', 'burrito'] },
  { label: 'Turkish & kebab', icon: '🇹🇷', aliases: ['turkish', 'kebab', 'doner'] },
  { label: 'Greek', icon: '🇬🇷', aliases: ['greek'] },
  {
    label: 'Lebanese & Levantine',
    icon: '🇱🇧',
    aliases: ['lebanese', 'levantine', 'syrian', 'palestinian'],
  },
  {
    label: 'Moroccan & North African',
    icon: '🇲🇦',
    aliases: ['moroccan', 'north_african', 'maghreb'],
  },
  { label: 'Argentine', icon: '🇦🇷', aliases: ['argentinian'] },
  { label: 'Brazilian', icon: '🇧🇷', aliases: ['brazilian'] },
  { label: 'Peruvian', icon: '🇵🇪', aliases: ['peruvian'] },
  { label: 'Venezuelan', icon: '🇻🇪', aliases: ['venezuelan'] },
  { label: 'Ethiopian & Eritrean', icon: '🇪🇹🇪🇷', aliases: ['ethiopian', 'eritrean'] },
].map((group) => ({ ...group, aliases: new Set(group.aliases) }));

const COUNTRY_FLAGS = { Spain: '🇪🇸', Portugal: '🇵🇹' };

const authored = JSON.parse(await readFile(SRC, 'utf8'));
const problems = [];
const ids = new Set();

for (const [index, city] of authored.cities.entries()) {
  const where = city.name ?? `row ${index + 1}`;
  if (!city.id || !city.name || !city.country) problems.push(`${where}: needs id, name and country`);
  if (ids.has(city.id)) problems.push(`${where}: duplicate id ${city.id}`);
  ids.add(city.id);
  if (!Number.isFinite(city.lon) || !Number.isFinite(city.lat)) {
    problems.push(`${where}: needs numeric lon and lat`);
  }
  if (!Number.isFinite(city.radius_km) || city.radius_km < 2 || city.radius_km > 12) {
    problems.push(`${where}: radius_km must be between 2 and 12`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in data/international-cuisine-cities.json:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (number) => Number(number.toFixed(5));

async function discoverEndpoint() {
  try {
    const res = await fetch('https://overpass-api.de/api/status', {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    const status = await res.text();
    const host = status.match(/Announced endpoint:\s*([^/\s]+)\/?/)?.[1];
    if (!host) throw new Error('no announced endpoint');
    endpoints = [`https://${host}/api/interpreter`, ...endpoints];
    return true;
  } catch {
    // If the cluster status itself is unavailable, avoid waiting on each alias
    // for every city and use the stable monthly OSM snapshot below.
    endpoints = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : [];
    return endpoints.length > 0;
  }
}

async function discoverOhsomeTime() {
  const res = await fetch('https://api.ohsome.org/v1/metadata', {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`ohsome metadata: HTTP ${res.status}`);
  const metadata = await res.json();
  ohsomeTime = metadata.extractRegion?.temporalExtent?.toTimestamp;
  if (!ohsomeTime) throw new Error('ohsome metadata: missing latest timestamp');
}

function bbox(city) {
  const latDelta = city.radius_km / 111.32;
  const lonDelta = city.radius_km / (111.32 * Math.cos((city.lat * Math.PI) / 180));
  return [city.lat - latDelta, city.lon - lonDelta, city.lat + latDelta, city.lon + lonDelta].map(round);
}

function query(city) {
  const box = bbox(city).join(',');
  return `[out:json][timeout:45];(
    node["amenity"~"^(restaurant|fast_food)$"]["cuisine"](${box});
    way["amenity"~"^(restaurant|fast_food)$"]["cuisine"](${box});
  );out tags;`;
}

function cacheFile(city) {
  return new URL(`${city.id}-${city.radius_km}.json`, CACHE);
}

async function fetchCity(city) {
  const file = cacheFile(city);
  if (!REFRESH && existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));

  const failures = [];
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            ...REQUEST_HEADERS,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ data: query(city) }),
          signal: AbortSignal.timeout(90_000),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120).replaceAll('\n', ' ')}`);
        if (!text.trimStart().startsWith('{')) throw new Error('non-JSON response');
        const json = JSON.parse(text);
        if (!Array.isArray(json.elements) || json.remark) {
          throw new Error(json.remark ?? 'missing elements');
        }
        json._provider = 'overpass';
        await writeFile(file, JSON.stringify(json));
        await sleep(2_500);
        return json;
      } catch (error) {
        const detail = error.name === 'TimeoutError' ? 'timeout' : error.message;
        const retryable = /HTTP (429|502|503|504)|fetch failed/.test(detail);
        if (retryable && attempt < 3) {
          const wait = attempt * 30_000;
          console.warn(`    ${city.name}: ${new URL(endpoint).host} ${detail.split(':')[0]}; waiting ${wait / 1000}s`);
          await sleep(wait);
          continue;
        }
        failures.push(`${new URL(endpoint).host}: ${detail}`);
        break;
      }
    }
  }
  if (failures.length) console.warn(`    ${city.name}: Overpass unavailable; using ohsome snapshot`);
  return fetchOhsomeCity(city, file);
}

async function fetchOhsomeCity(city, file) {
  const [south, west, north, east] = bbox(city);
  const res = await fetch('https://api.ohsome.org/v1/elements/count/groupBy/tag', {
    method: 'POST',
    headers: {
      ...REQUEST_HEADERS,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      bboxes: `${west},${south},${east},${north}`,
      time: ohsomeTime,
      filter: '(amenity=restaurant or amenity=fast_food) and cuisine=* and opening_hours!=closed',
      groupByKey: 'cuisine',
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`${city.name}: ohsome HTTP ${res.status}`);
  const grouped = await res.json();
  if (!Array.isArray(grouped.groupByResult)) throw new Error(`${city.name}: malformed ohsome response`);

  const elements = [];
  for (const group of grouped.groupByResult) {
    const cuisine = String(group.groupByObject).replace(/^cuisine=/, '');
    const count = Math.round(group.result?.at(-1)?.value ?? 0);
    for (let index = 0; index < count; index++) elements.push({ tags: { cuisine } });
  }
  const json = {
    _provider: 'ohsome',
    _source_timestamp: ohsomeTime,
    elements,
  };
  await writeFile(file, JSON.stringify(json));
  return json;
}

function tagsFor(element) {
  return new Set(
    String(element.tags?.cuisine ?? '')
      .toLowerCase()
      .split(/[;,]/)
      .map((value) => value.trim().replaceAll(' ', '_'))
      .filter(Boolean),
  );
}

function classify(elements) {
  const open = elements.filter((element) => element.tags?.opening_hours !== 'closed');
  const counts = CUISINES.map((group) => ({
    label: group.label,
    icon: group.icon,
    count: open.filter((element) => [...tagsFor(element)].some((tag) => group.aliases.has(tag)))
      .length,
  }));
  const descending = (a, b) => b.count - a.count || a.label.localeCompare(b.label);
  const easy = counts.filter(({ count }) => count >= 4).sort(descending);
  const some = counts.filter(({ count }) => count >= 2 && count <= 3).sort(descending);
  const thin = counts.filter(({ count }) => count <= 1).sort(descending);
  const thinShown = thin.slice(0, 8);
  const thinExtra = thin.length - thinShown.length;
  const icons = (items) => items.map(({ icon }) => icon).join(' ');

  return {
    tagged: open.length,
    easy: `🟢 ${icons(easy) || '—'}`,
    some: `🟡 ${icons(some) || '—'}`,
    thin:
      open.length < 25
        ? '🔎 sample too small'
        : thin.length === 0
          ? '🔎 —'
          : `🔎 ${icons(thinShown)}${thinExtra ? ` +${thinExtra}` : ''}`,
    breadth: `${easy.length + some.length}/${CUISINES.length} found twice+`,
  };
}

await mkdir(CACHE, { recursive: true });
await mkdir(new URL('./', OUT), { recursive: true });
const hasCompleteCache = !REFRESH && authored.cities.every((city) => existsSync(cacheFile(city)));
const [overpassReady] = hasCompleteCache
  ? [false]
  : await Promise.all([discoverEndpoint(), discoverOhsomeTime()]);

const snapshots = new Array(authored.cities.length);
let nextCity = 0;
async function worker() {
  while (nextCity < authored.cities.length) {
    const index = nextCity++;
    const city = authored.cities[index];
    const json = await fetchCity(city);
    snapshots[index] = json;
    console.log(`  ${index + 1}/${authored.cities.length} ${city.name}: ${classify(json.elements).tagged} tagged places`);
  }
}
await Promise.all(Array.from({ length: overpassReady ? 1 : 3 }, worker));

const features = [];
const timestamps = [];
const providers = new Set();
for (const [index, city] of authored.cities.entries()) {
  const json = snapshots[index];
  const result = classify(json.elements);
  const timestamp = json.osm3s?.timestamp_osm_base ?? json._source_timestamp;
  if (timestamp) timestamps.push(timestamp);
  providers.add(json._provider ?? 'overpass');
  features.push({
    type: 'Feature',
    properties: {
      city: city.name,
      title: `${COUNTRY_FLAGS[city.country]} ${city.name}`,
      country: city.country,
      easy: result.easy,
      some: result.some,
      thin: result.thin,
      breadth: result.breadth,
      key: '🟢 4+ · 🟡 2–3 · 🔎 0–1 mapped',
      sample: `${result.tagged} tagged · ~${city.radius_km} km`,
    },
    geometry: { type: 'Point', coordinates: [city.lon, city.lat] },
  });
}

await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: 'International cuisine availability in selected Iberian cities',
      source: 'OpenStreetMap contributors via the Overpass and ohsome APIs',
      licence: 'Open Database Licence (ODbL)',
      providers: [...providers],
      source_timestamp: timestamps.sort().at(0),
      generated: new Date().toISOString().slice(0, 10),
      scope: authored.metadata.scope,
      method:
        'Restaurant and fast-food places with cuisine tags in a city-centre bounding box. Four or more mapped places is easy; two or three is some choice; zero or one is a harder bet.',
      caveat:
        'OpenStreetMap coverage varies. These counts are evidence of presence, not proof of absence, live opening status or quality.',
      cuisines: CUISINES.map(({ label, icon, aliases }) => ({ label, icon, aliases: [...aliases] })),
    },
    features,
  }),
);

console.log(`Wrote ${features.length} city cuisine guides`);
