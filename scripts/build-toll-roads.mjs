/**
 * Builds public/data/toll-roads.geojson: the number of distinct toll roads in
 * each mainland province-sized region of Spain and Portugal.
 *
 * Sources, both free and keyless:
 *   OpenStreetMap / Overpass   highway ways tagged toll=yes
 *   Eurostat GISCO             2024 NUTS 3 boundaries
 *
 * A road is one distinct OSM `ref`. OSM splits roads into many ways, so counting
 * ways would badly overstate the result; names are too inconsistently applied to
 * use as a fallback. A road counts in every NUTS 3 region its geometry intersects.
 * Ferry routes, link ramps, closed/private ways and vehicle-class-only tolls are
 * excluded.
 *
 *   node scripts/build-toll-roads.mjs
 *
 * Raw responses are cached in .cache/toll-roads/. Delete that directory to
 * refresh the OSM snapshot or the boundary release.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CACHE = new URL('../.cache/toll-roads/', import.meta.url);
const OUT = new URL('../public/data/toll-roads.geojson', import.meta.url);
const COUNTRIES = ['ES', 'PT'];
const NOT_MAINLAND = ['ES53', 'ES63', 'ES64', 'ES70', 'PT20', 'PT30'];
const BOUNDS = { south: 35.8, west: -9.6, north: 43.9, east: 3.4 };

const BOUNDARIES_URL =
  'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/' +
  'NUTS_RG_10M_2024_4326_LEVL_3.geojson';
const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const ROAD_TYPES =
  'motorway|motorway_link|trunk|trunk_link|primary|primary_link|' +
  'secondary|secondary_link|tertiary|tertiary_link|unclassified|' +
  'residential|service|road';
const OVERPASS_QUERY = `[out:json][timeout:300];
way["highway"~"^(${ROAD_TYPES})$"]["toll"="yes"]` +
  `(${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});
out tags geom;`;

async function cached(name, load) {
  const file = new URL(name, CACHE);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const value = await load();
  await writeFile(file, JSON.stringify(value));
  return value;
}

async function fetchJson(url, label) {
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return res.json();
}

async function fetchRoads() {
  const errors = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Querying ${new URL(endpoint).host}`);
      const url = `${endpoint}?${new URLSearchParams({ data: OVERPASS_QUERY })}`;
      const res = await fetch(url, {
        headers: { 'user-agent': 'iberia-map-data-builder/0.2 (toll-roads)' },
        signal: AbortSignal.timeout(360_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      errors.push(`${new URL(endpoint).host}: ${err.message}`);
      console.warn(`  ${errors.at(-1)}`);
    }
  }

  throw new Error(`Every Overpass endpoint failed:\n${errors.join('\n')}`);
}

const round = (n) => Math.round(n * 1000) / 1000; // ~110 m, ample at this scale
const simplify = (coords) =>
  Array.isArray(coords[0]) ? coords.map(simplify) : [round(coords[0]), round(coords[1])];

const bboxOfPoints = (points) => {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  }
  return box;
};

const flattenPoints = (coords) =>
  Array.isArray(coords[0]?.[0]) ? coords.flatMap(flattenPoints) : coords;
const overlaps = (a, b) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function pointOnSegment(point, a, b) {
  const epsilon = 1e-10;
  return (
    Math.abs(cross(a, b, point)) < epsilon &&
    point[0] >= Math.min(a[0], b[0]) - epsilon &&
    point[0] <= Math.max(a[0], b[0]) + epsilon &&
    point[1] >= Math.min(a[1], b[1]) - epsilon &&
    point[1] <= Math.max(a[1], b[1]) + epsilon
  );
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if ((abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0)) return true;
  return (
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b) ||
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d)
  );
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (pointOnSegment(point, a, b)) return true;
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

function lineIntersectsPolygon(line, polygon) {
  if (line.some((point) => pointInPolygon(point, polygon))) return true;

  for (let i = 1; i < line.length; i++) {
    for (const ring of polygon) {
      for (let j = 1; j < ring.length; j++) {
        if (segmentsIntersect(line[i - 1], line[i], ring[j - 1], ring[j])) return true;
      }
    }
  }
  return false;
}

function lineIntersectsRegion(line, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => lineIntersectsPolygon(line, polygon));
}

const tidy = (value) => value.trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
const keyForRef = (value) => value.toUpperCase().replace(/[\s-]+/g, '');

function labelsForRoad(tags) {
  const refs = (tags.ref ?? '')
    .split(';')
    .map(tidy)
    .filter(Boolean)
    .filter((ref) => !/^E\d+$/.test(keyForRef(ref)));

  if (refs.length) {
    return refs.map((label) => ({ key: `ref:${keyForRef(label)}`, label }));
  }
  return [];
}

const isCountableSegment = (tags) =>
  !tags.highway.endsWith('_link') &&
  !['no', 'private'].includes(tags.access) &&
  !tags.abandoned &&
  !tags.proposed &&
  !tags.construction;

await mkdir(CACHE, { recursive: true });
const [boundaries, osm] = await Promise.all([
  cached('nuts-3-2024.json', () => fetchJson(BOUNDARIES_URL, 'NUTS boundaries')),
  cached('osm-toll-ways.json', fetchRoads),
]);

const regions = boundaries.features
  .filter(({ properties }) => COUNTRIES.includes(properties.CNTR_CODE))
  .filter(
    ({ properties }) => !NOT_MAINLAND.some((prefix) => properties.NUTS_ID.startsWith(prefix)),
  )
  .map((feature) => ({
    feature,
    roads: new Map(),
    bbox: bboxOfPoints(flattenPoints(feature.geometry.coordinates)),
  }));

let unlabelledWays = 0;
let invalidWays = 0;

for (const way of osm.elements) {
  if (!isCountableSegment(way.tags ?? {})) continue;
  const line = way.geometry?.map(({ lon, lat }) => [lon, lat]);
  if (!line || line.length < 2) {
    invalidWays++;
    continue;
  }

  const labels = labelsForRoad(way.tags ?? {});
  if (!labels.length) {
    unlabelledWays++;
    continue;
  }

  const wayBox = bboxOfPoints(line);
  for (const region of regions) {
    if (
      !overlaps(wayBox, region.bbox) ||
      !lineIntersectsRegion(line, region.feature.geometry)
    ) {
      continue;
    }
    for (const road of labels) region.roads.set(road.key, road.label);
  }
}

const byRoadName = (a, b) => a.localeCompare(b, 'en-GB', { numeric: true });
const features = regions
  .map(({ feature, roads }) => {
    const { NUTS_ID: code, CNTR_CODE: country, NAME_LATN: name } = feature.properties;
    const labels = [...roads.values()].sort(byRoadName);
    return {
      type: 'Feature',
      properties: {
        name,
        code,
        country,
        count: labels.length,
        roads: labels.join(', ') || 'None tagged',
      },
      geometry: {
        type: feature.geometry.type,
        coordinates: simplify(feature.geometry.coordinates),
      },
    };
  })
  .sort((a, b) => a.properties.code.localeCompare(b.properties.code));

const snapshot = osm.osm3s?.timestamp_osm_base?.slice(0, 10) ?? 'unknown';
await mkdir(new URL('./', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: 'Toll roads by mainland NUTS 3 region',
      source: 'OpenStreetMap toll=yes highway ways; Eurostat GISCO 2024 NUTS 3 boundaries',
      note:
        'Distinct road references intersecting each region. Mainland Spain and Portugal; ' +
        'general-traffic tolls only, excluding link ramps and closed/private ways.',
      osm_snapshot: snapshot,
      generated: new Date().toISOString().slice(0, 10),
      unlabelled_ways_omitted: unlabelledWays,
    },
    features,
  }),
);

const ranked = [...features].sort((a, b) => b.properties.count - a.properties.count);
console.log(
  `Wrote ${features.length} mainland regions from ${osm.elements.length} tolled OSM ways ` +
    `(${unlabelledWays} unlabelled and ${invalidWays} without geometry omitted)`,
);
console.log(
  'Most toll roads: ' +
    ranked
      .slice(0, 12)
      .map(({ properties: p }) => `${p.name} ${p.count}`)
      .join(', '),
);
