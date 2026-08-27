/**
 * Validates every layer against the contract and against its own data file:
 * missing files, empty collections, and properties a layer refers to but the
 * GeoJSON does not have. Run it after adding or editing a layer.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { validateLayer } from '../src/lib/schema.ts';
import { buildPaint, buildLayout, buildFillPattern } from '../src/lib/paint.ts';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

const layersDir = new URL('../src/layers/', import.meta.url);
const publicDir = new URL('../public/', import.meta.url);

const problems = [];
const notes = [];

const folders = (await readdir(layersDir, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name);

for (const folder of folders) {
  const path = `src/layers/${folder}/layer.ts`;
  let def;
  try {
    def = (await import(new URL(`${folder}/layer.ts`, layersDir))).default;
  } catch (err) {
    if (err.message.includes('.svelte')) {
      notes.push(`${path}: uses a Svelte component, checked in the browser only`);
      continue;
    }
    problems.push(`${path}: will not import — ${err.message}`);
    continue;
  }

  problems.push(...validateLayer(def, path));
  problems.push(...validatePaint(def, path));
  if (def?.id && def.id !== folder) {
    problems.push(`${path}: id "${def.id}" does not match folder "${folder}"`);
  }
  if (!def || typeof def.source !== 'string') continue;

  const dataFile = new URL(`.${def.source}`, publicDir);
  if (!existsSync(dataFile)) {
    problems.push(`${path}: no data file at public${def.source}`);
    continue;
  }

  let geojson;
  try {
    geojson = JSON.parse(await readFile(dataFile, 'utf8'));
  } catch (err) {
    problems.push(`public${def.source}: not valid JSON — ${err.message}`);
    continue;
  }

  if (geojson.type !== 'FeatureCollection' || !geojson.features?.length) {
    problems.push(`public${def.source}: expected a FeatureCollection with at least one feature`);
    continue;
  }

  const keys = new Set(geojson.features.flatMap((f) => Object.keys(f.properties ?? {})));
  const referenced = [
    def.render?.colour?.property,
    def.render?.radius?.property,
    def.render?.width?.property,
    def.render?.icons?.property,
    def.popup?.title,
    ...(def.popup?.fields ?? []).map((f) => f.key),
  ].filter(Boolean);

  for (const key of new Set(referenced)) {
    if (!keys.has(key)) {
      problems.push(
        `${path}: refers to property "${key}", which is not in the data. ` +
          `Available: ${[...keys].join(', ') || 'none'}`,
      );
    }
  }

  if (def.render?.type === 'symbol' && def.render.icons) {
    const property = def.render.icons.property;
    const values = new Set(geojson.features.map((f) => f.properties?.[property]).filter(Boolean));
    for (const value of values) {
      const image = def.render.icons.images[value];
      if (!image) {
        problems.push(`${path}: no icon image is mapped for ${property}=${JSON.stringify(value)}`);
        continue;
      }
      if (!existsSync(new URL(`.${image}`, publicDir))) {
        problems.push(`${path}: no icon image at public${image}`);
      }
    }
  }

  notes.push(`${folder}: ${geojson.features.length} features, properties: ${[...keys].join(', ')}`);
}

for (const note of notes) console.log(`  ${note}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`\n${folders.length} layer(s) OK`);

/**
 * Builds the layer's MapLibre paint and layout and checks them against the style
 * spec. Catches what neither types nor data can: expressions that are the right
 * shape but that MapLibre refuses at runtime, where the layer silently draws nothing.
 */
function validatePaint(def, path) {
  if (!def?.render?.type || def.component) return [];

  const layout = buildLayout(def.render, 'icon');
  const style = {
    version: 8,
    sources: { s: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
    layers: [
      { id: 'l', type: def.render.type, source: 's', paint: buildPaint(def.render), ...(layout ? { layout } : {}) },
    ],
  };

  const errors = validateStyleMin(style)
    .filter((error) => !/icon-image/.test(error.message)) // the image is added at runtime
    .map((error) => `${path}: ${error.message.replace('layers[0].', '')}`);

  if (def.render.type === 'fill') {
    const pattern = buildFillPattern(def.render, 'check');
    if (pattern) {
      const patternStyle = {
        ...style,
        layers: [{ id: 'l', type: 'fill', source: 's', paint: pattern.paint }],
      };
      errors.push(
        ...validateStyleMin(patternStyle).map(
          (error) => `${path} (combined): ${error.message.replace('layers[0].', '')}`,
        ),
      );
    }
  }

  return errors;
}
