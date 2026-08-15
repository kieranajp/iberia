/**
 * Cuts a release: checks, builds, and publishes two archives to GitHub.
 *
 *   npm run release              build, check and publish
 *   npm run release -- --dry-run build and package, publish nothing
 *
 *   iberia-site-<version>.tar.gz   the built site, data included. Unpack it on a host.
 *   iberia-data-<version>.tar.gz   the datasets alone, for a new machine.
 *
 * The datasets are not in git, so the release is where they live. A new clone runs
 * `npm run data:restore` and has hours of rate-limited downloading already done.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';

import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = `${root}public/data/`;
const outDir = `${root}.release/`;
const dryRun = process.argv.includes('--dry-run');

const run = (command, args, whenItFails) => {
  try {
    return execFileSync(command, args, { cwd: root, stdio: 'inherit', encoding: 'utf8' });
  } catch {
    console.error(`\n${whenItFails ?? `${command} ${args.join(' ')} failed`}`);
    process.exit(1);
  }
};
const capture = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();

const { version } = JSON.parse(await readFile(`${root}package.json`, 'utf8'));
const tag = `v${version}`;

if (!dryRun) {
  /* The archives come from the working tree, but `gh release create` tags the
     remote's HEAD. If those differ, the tag describes code that was never shipped. */
  const dirty = capture('git', ['status', '--porcelain']);
  if (dirty) {
    console.error(`Uncommitted changes. Commit them first, or the ${tag} tag will not match what is in the archives:\n${dirty}`);
    process.exit(1);
  }

  const unpushed = capture('git', ['rev-list', '@{upstream}..HEAD', '--count']);
  if (unpushed !== '0') {
    console.error(`${unpushed} commit(s) not pushed. Push first, or ${tag} will be cut from the wrong commit.`);
    process.exit(1);
  }
}

if (!dryRun) {
  const existing = capture('gh', ['release', 'list', '--json', 'tagName', '--limit', '100']);
  if (JSON.parse(existing).some((r) => r.tagName === tag)) {
    console.error(`Release ${tag} exists. Bump the version in package.json first.`);
    process.exit(1);
  }
}

console.log('Checking the layers against their types and their data');
run('npm', ['run', 'typecheck'], 'A layer does not match the Layer interface. Nothing released.');
run('npm', ['run', 'check'],
    'A layer and its data disagree, or a dataset is missing.\n' +
    'Build them with npm run data, or fetch the last ones with npm run data:restore.\n' +
    'Nothing released.');

console.log('\nBuilding');
run('npm', ['run', 'build'], 'The build failed. Nothing released.');

/* Vite copies public/ into dist/, so the site archive already carries the data. */
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const site = `iberia-site-${version}.tar.gz`;
const data = `iberia-data-${version}.tar.gz`;
run('tar', ['-czf', `${outDir}${site}`, '-C', `${root}dist`, '.'], 'Could not package the site.');
run('tar', ['-czf', `${outDir}${data}`, '-C', dataDir, '.'], 'Could not package the datasets.');

const datasets = [];
for (const file of (await readdir(dataDir)).filter((f) => f.endsWith('.geojson'))) {
  const { metadata = {}, features = [] } = JSON.parse(await readFile(dataDir + file, 'utf8'));
  datasets.push(`| \`${file}\` | ${features.length} | ${metadata.generated ?? 'unknown'} | ${metadata.source ?? ''} |`);
}

const notes = [
  `Static site and datasets for ${tag}.`,
  '',
  '| Dataset | Features | Built | Source |',
  '| --- | --- | --- | --- |',
  ...datasets,
  '',
  '**To host it:** unpack `' + site + '` and serve the directory. No backend.',
  '',
  '**On a new machine:** clone, `npm install`, then `npm run data:restore` to pull the',
  'datasets from this release rather than spending an hour inside Open-Meteo rate limits.',
].join('\n');

await writeFile(`${outDir}notes.md`, notes);

const sizes = capture('du', ['-h', `${outDir}${site}`, `${outDir}${data}`]);
console.log(`\nPackaged:\n${sizes}`);

if (dryRun) {
  console.log(`\nDry run. Artefacts are in .release/, notes in .release/notes.md`);
  process.exit(0);
}

run('gh', ['release', 'create', tag, `${outDir}${site}`, `${outDir}${data}`,
           '--title', `Iberia ${tag}`, '--notes-file', `${outDir}notes.md`],
    `Publishing ${tag} failed. The artefacts are in .release/ if you want to upload them by hand.`);
console.log(`\nPublished ${tag}`);
