import type { Layer, Scale, ScaleSpec } from './types.ts';

/**
 * Runtime half of the contract, for what types cannot catch: hand-written data,
 * files that do not exist, properties that do not match. Runs in both the browser
 * and Node (`npm run check`), so keep it free of Svelte and DOM imports.
 */

const RENDER_TYPES = ['circle', 'fill', 'line', 'heatmap', 'symbol'];

/** Returns a list of problems. Empty list means the layer is valid. */
export function validateLayer(def: Layer | undefined, origin = 'unknown'): string[] {
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(`${origin}: ${msg}`);

  if (!def || typeof def !== 'object') return [`${origin}: default export is not an object`];
  if (!def.id) fail('missing `id`');
  if (def.id && !/^[a-z0-9-]+$/.test(def.id)) fail('`id` must be kebab-case (a-z, 0-9, -)');
  if (!def.name) fail('missing `name` (shown in the layer panel)');

  if (def.component) return problems; // escape hatch: the component owns everything below

  if (!def.source) fail('missing `source` (a URL under /data, or an inline GeoJSON object)');
  if (typeof def.source === 'string' && !def.source.startsWith('/')) {
    fail('`source` must be an absolute path, e.g. "/data/rainfall.geojson"');
  }

  const render = def.render;
  if (!render) {
    fail('missing `render`');
  } else if (!RENDER_TYPES.includes(render.type)) {
    fail(`\`render.type\` must be one of ${RENDER_TYPES.join(', ')} (got ${JSON.stringify(render.type)})`);
  }

  if (render && 'colour' in render && !validScale(render.colour)) {
    fail('`render.colour` scale needs `property` and 2+ `stops`');
  }
  if (render && 'radius' in render && !validScale(render.radius)) {
    fail('`render.radius` scale needs `property` and 2+ `stops`');
  }
  if (render?.type === 'symbol' && render.icon && render.icons) {
    fail('a symbol layer may use `render.icon` or `render.icons`, not both');
  }
  if (render?.type === 'symbol' && render.icons) {
    if (!render.icons.property) fail('`render.icons` needs a feature `property`');
    if (!Object.keys(render.icons.images ?? {}).length) {
      fail('`render.icons` needs at least one image');
    }
    for (const [key, url] of Object.entries(render.icons.images ?? {})) {
      if (typeof url !== 'string' || !url.startsWith('/')) {
        fail(`render.icons.images[${JSON.stringify(key)}] must be an absolute path`);
      }
    }
  }

  if (def.popup && !def.popup.title && !def.popup.fields?.length) {
    fail('`popup` needs a `title` property name or at least one entry in `fields`');
  }
  return problems;
}

function validScale(scale: Scale<unknown> | undefined): boolean {
  if (scale === undefined || scale === null) return true;
  if (typeof scale !== 'object') return true; // a literal colour or size
  if (Array.isArray(scale)) return true; // a raw MapLibre expression
  const spec = scale as ScaleSpec<unknown>;
  return Boolean(spec.property) && Array.isArray(spec.stops) && spec.stops.length >= 2;
}
