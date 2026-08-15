/**
 * Fetches the datasets from the latest release, so a fresh clone does not have to
 * rebuild them. The rainfall grid alone takes an hour of waiting on rate limits.
 *
 *   npm run data:restore
 *
 * These are snapshots. Rebuild with `npm run data` when you want them current.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Skips macOS AppleDouble companions, which end in .geojson but are binary. */
const datasets = (names) => names.filter((f) => f.endsWith('.geojson') && !f.startsWith('._'));

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = `${root}public/data/`;
const tmpDir = `${root}.release/restore/`;

await mkdir(dataDir, { recursive: true });
await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

try {
  execFileSync('gh', ['release', 'download', '--pattern', 'iberia-data-*.tar.gz', '--dir', tmpDir], {
    cwd: root,
    stdio: 'inherit',
  });
} catch {
  console.error(
    'No release with a data archive. Build the datasets instead:\n' +
      '  npm run data          all three, the last of which takes an hour\n' +
      '  npm run data:resorts  the hand-compiled one, instantly',
  );
  process.exit(1);
}

const [archive] = await readdir(tmpDir);
execFileSync('tar', ['-xzf', tmpDir + archive, '-C', dataDir], { cwd: root });
await rm(tmpDir, { recursive: true, force: true });

console.log(`\nRestored from ${archive}:`);
for (const file of datasets(await readdir(dataDir))) {
  const { metadata = {}, features = [] } = JSON.parse(await readFile(dataDir + file, 'utf8'));
  console.log(`  ${file}: ${features.length} features, built ${metadata.generated ?? 'unknown'}`);
}
