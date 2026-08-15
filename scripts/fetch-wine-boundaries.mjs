/**
 * Fetches and simplifies MAPA's 2014 wine-region polygons for use as committed
 * source data. Campo de Calatrava, registered in 2024, is assembled from the 16
 * municipalities in its specification using Eurostat GISCO's 1:1m LAU polygons.
 * Portugal's 12 mainland wine regions come from IVV's official 2023 shapefile.
 *
 *   node scripts/fetch-wine-boundaries.mjs
 *   node scripts/fetch-wine-boundaries.mjs --from /path/to/raw.geojson \
 *     --lau-from /path/to/lau.geojson --portugal-from /path/to/site.zip
 */
import { readFile, writeFile } from 'node:fs/promises';
import shp from 'shpjs';

const SERVICE =
  'https://services.arcgis.com/VgnIzOwU2FBU6E7K/ArcGIS/rest/services/' +
  'Espagne_Vineyards/FeatureServer/1/query?where=1%3D1&outFields=*&' +
  'returnGeometry=true&outSR=4326&f=geojson';
const LAU_SERVICE =
  'https://gisco-services.ec.europa.eu/features/collections/' +
  'gisco.lau_rg_01m_2024_4326/items.json?bbox=-4.2,38.5,-3.4,39.2&limit=500';
// IVV removed the live download while redesigning its site. This is an archived,
// byte-for-byte copy of the official site.zip linked from its wine-regions page.
const IVV_ARCHIVE =
  'https://web.archive.org/web/20250905234345id_/https://www.ivv.gov.pt/' +
  'np4/785/%7B$clientServletPath%7D/?newsId=10171&fileName=site.zip';
const OUT = new URL('../data/wine-boundaries.geojson', import.meta.url);
const TOLERANCE = 0.0025; // about 250 m; comfortably inside this map's useful precision

const fromIndex = process.argv.indexOf('--from');
const raw = fromIndex === -1
  ? await fetch(SERVICE).then((response) => {
      if (!response.ok) throw new Error(`Boundary download failed: HTTP ${response.status}`);
      return response.json();
    })
  : JSON.parse(await readFile(process.argv[fromIndex + 1], 'utf8'));

const lauFromIndex = process.argv.indexOf('--lau-from');
const lau = lauFromIndex === -1
  ? await fetch(LAU_SERVICE).then((response) => {
      if (!response.ok) throw new Error(`LAU download failed: HTTP ${response.status}`);
      return response.json();
    })
  : JSON.parse(await readFile(process.argv[lauFromIndex + 1], 'utf8'));

const portugalFromIndex = process.argv.indexOf('--portugal-from');
const portugalZip = portugalFromIndex === -1
  ? Buffer.from(
      await fetch(IVV_ARCHIVE).then(async (response) => {
        if (!response.ok) throw new Error(`IVV boundary download failed: HTTP ${response.status}`);
        return response.arrayBuffer();
      }),
    )
  : await readFile(process.argv[portugalFromIndex + 1]);
const portugal = await shp(portugalZip);
if (Array.isArray(portugal) || portugal.type !== 'FeatureCollection') {
  throw new Error('IVV archive did not contain one readable shapefile');
}

const CAMPO_DE_CALATRAVA = new Set([
  'Aldea del Rey',
  'Almagro',
  'Argamasilla de Calatrava',
  'Ballesteros de Calatrava',
  'Bolaños de Calatrava',
  'Calzada de Calatrava',
  'Cañada de Calatrava',
  'Carrión de Calatrava',
  'Granátula de Calatrava',
  'Miguelturra',
  'Moral de Calatrava',
  'Pozuelo de Calatrava',
  'Torralba de Calatrava',
  'Valenzuela de Calatrava',
  'Villanueva de San Carlos',
  'Villar del Pozo',
]);

function squareSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx || dy) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyStep(points, first, last, toleranceSquared, keep) {
  let furthestDistance = toleranceSquared;
  let furthestIndex;

  for (let i = first + 1; i < last; i++) {
    const distance = squareSegmentDistance(points[i], points[first], points[last]);
    if (distance > furthestDistance) {
      furthestIndex = i;
      furthestDistance = distance;
    }
  }

  if (furthestIndex === undefined) return;
  if (furthestIndex - first > 1) simplifyStep(points, first, furthestIndex, toleranceSquared, keep);
  keep.push(points[furthestIndex]);
  if (last - furthestIndex > 1) simplifyStep(points, furthestIndex, last, toleranceSquared, keep);
}

function simplifyRing(ring) {
  const points = ring.slice(0, -1);
  if (points.length < 4) return ring;

  const keep = [points[0]];
  simplifyStep(points, 0, points.length - 1, TOLERANCE * TOLERANCE, keep);
  keep.push(points.at(-1));
  const simplified = keep.length >= 3 ? keep : points;
  const rounded = simplified.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
  rounded.push(rounded[0]);
  return rounded;
}

function simplifyGeometry(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const coordinates = polygons.map((polygon) => polygon.map(simplifyRing));
  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: coordinates[0] }
    : { type: 'MultiPolygon', coordinates };
}

const features = raw.features
  .filter(({ properties }) =>
    properties.TPR_DS_DES === 'Denominación de Origen' ||
    properties.TPR_DS_DES === 'Denominación de Origen Calificada' ||
    properties.ZON_DS_NOM === 'Granada',
  )
  .map((feature) => ({
    type: 'Feature',
    properties: { source_name: feature.properties.ZON_DS_NOM, boundary: 'MAPA 2014' },
    geometry: simplifyGeometry(feature.geometry),
  }));

const portugalFeatures = portugal.features.map((feature) => ({
  type: 'Feature',
  properties: {
    source_name: feature.properties.DESIGNACAO,
    boundary: 'IVV 2023',
  },
  geometry: simplifyGeometry(feature.geometry),
}));
if (portugalFeatures.length !== 12) {
  throw new Error(`Expected 12 IVV wine regions, received ${portugalFeatures.length}`);
}
features.push(...portugalFeatures);

const campoMunicipalities = lau.features.filter(
  (feature) => feature.properties.gisco_id.startsWith('ES_') && CAMPO_DE_CALATRAVA.has(feature.properties.lau_name),
);
if (campoMunicipalities.length !== CAMPO_DE_CALATRAVA.size) {
  const found = new Set(campoMunicipalities.map((feature) => feature.properties.lau_name));
  const missing = [...CAMPO_DE_CALATRAVA].filter((name) => !found.has(name));
  throw new Error(`Campo de Calatrava is missing LAU polygons: ${missing.join(', ')}`);
}

features.push({
  type: 'Feature',
  properties: { source_name: 'Campo de Calatrava', boundary: 'Eurostat municipalities 2024' },
  geometry: simplifyGeometry({
    type: 'MultiPolygon',
    coordinates: campoMunicipalities.flatMap(({ geometry }) => geometry.coordinates),
  }),
});

await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      title: 'Iberian wine-region boundaries',
      source:
        '© Ministerio de Agricultura, Pesca y Alimentación (MAPA); ' +
        'Instituto da Vinha e do Vinho (IVV)',
      additional_source: 'Eurostat GISCO LAU 2024 (Campo de Calatrava municipalities)',
      note:
        'MAPA polygons were downloaded from the public Espagne Vineyards ArcGIS feature ' +
        'service and simplified for web display. Campo de Calatrava was assembled from ' +
        'the 16 municipalities named in its specification. Portugal uses the 12 mainland ' +
        'wine regions in IVV\'s official site.zip shapefile; its live link was unavailable, ' +
        'so the file was retrieved from the Internet Archive\'s preserved official download.',
      source_dates: 'MAPA 2014-03; IVV shapefile files dated 2023-04-13',
      source_detail: 'MAPA scale 1:25,000; IVV regional polygons',
      ivv_archive: IVV_ARCHIVE,
      simplification: `${TOLERANCE} degrees`,
    },
    features,
  }),
);

console.log(
  `Wrote ${features.length} simplified boundary features ` +
    `(${features.length - portugalFeatures.length} Spain, ${portugalFeatures.length} Portugal) ` +
    'to data/wine-boundaries.geojson',
);
