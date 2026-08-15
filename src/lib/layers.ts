import { validateLayer } from './schema.ts';
import type { Layer } from './types.ts';

/**
 * Every `src/layers/<id>/layer.ts` is picked up automatically. There is no
 * registry to edit — adding a folder is enough. Folders starting with `_`
 * (the template) are ignored.
 */
const modules = import.meta.glob<{ default: Layer }>('../layers/*/layer.ts', { eager: true });

const loaded: Layer[] = [];
for (const [path, mod] of Object.entries(modules)) {
  if (path.includes('/_')) continue;
  const def = mod.default;
  const problems = validateLayer(def, path);
  if (problems.length) {
    console.error(`Layer ignored:\n  ${problems.join('\n  ')}`);
    continue;
  }
  loaded.push(def);
}

export const layers = loaded.sort(
  (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name),
);

export const groups = layers.reduce<Record<string, Layer[]>>((acc, layer) => {
  const group = layer.group ?? 'Other';
  (acc[group] ??= []).push(layer);
  return acc;
}, {});
