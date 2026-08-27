/** Builds beer-brand points and copies their committed, normalised logo assets. */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SRC = new URL('../data/beer-brands.json', import.meta.url);
const LOGOS = new URL('../data/beer-logos/', import.meta.url);
const OUT = new URL('../public/data/beer-brands.geojson', import.meta.url);
const OUT_LOGOS = new URL('../public/data/beer-logos/', import.meta.url);

const authored = JSON.parse(await readFile(SRC, 'utf8'));
const problems = [];
const logoKeys = new Set();

for (const [index, market] of authored.markets.entries()) {
  const where = market.area ?? `row ${index + 1}`;
  for (const field of ['region', 'area', 'brand', 'logo', 'status', 'also', 'note']) {
    if (!market[field]) problems.push(`${where}: needs ${field}`);
  }
  if (
    !Array.isArray(market.coordinates) ||
    market.coordinates.length !== 2 ||
    market.coordinates.some((number) => !Number.isFinite(number))
  ) {
    problems.push(`${where}: coordinates must be [longitude, latitude] numbers`);
  }
  if (market.logo) {
    logoKeys.add(market.logo);
    if (!authored.metadata.logo_sources[market.logo]) {
      problems.push(`${where}: logo ${market.logo} has no source note`);
    }
    if (!existsSync(new URL(`${market.logo}.png`, LOGOS))) {
      problems.push(`${where}: missing data/beer-logos/${market.logo}.png`);
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in data/beer-brands.json:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

await mkdir(new URL('./', OUT), { recursive: true });
await mkdir(OUT_LOGOS, { recursive: true });
for (const key of logoKeys) {
  await copyFile(new URL(`${key}.png`, LOGOS), new URL(`${key}.png`, OUT_LOGOS));
}

await writeFile(
  OUT,
  JSON.stringify({
    type: 'FeatureCollection',
    metadata: { ...authored.metadata, generated: new Date().toISOString().slice(0, 10) },
    features: authored.markets.map(({ coordinates, ...properties }) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates },
    })),
  }),
);
console.log(`Wrote ${authored.markets.length} beer markets using ${logoKeys.size} logos`);
