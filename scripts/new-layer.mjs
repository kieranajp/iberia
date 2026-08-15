/** Copies the layer template into a new folder. Usage: npm run new-layer -- <id> */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const id = process.argv[2];

if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage: npm run new-layer -- <kebab-case-id>');
  process.exit(1);
}

const dir = new URL(`../src/layers/${id}/`, import.meta.url);
if (existsSync(dir)) {
  console.error(`src/layers/${id}/ already exists`);
  process.exit(1);
}

const template = await readFile(new URL('../src/layers/_template/layer.ts', import.meta.url), 'utf8');
const body = template
  .replace("id: 'template'", `id: '${id}'`)
  .replace("source: '/data/my-layer.geojson'", `source: '/data/${id}.geojson'`);

await mkdir(dir, { recursive: true });
await writeFile(new URL('layer.ts', dir), body);

console.log(`Created src/layers/${id}/layer.ts`);
console.log(`Now add public/data/${id}.geojson, then run: npm run check`);
