/**
 * Assembles the presentation from `presentation/` and the scored shortlist.
 *
 *   npm run deck
 *
 * Writes two files into .cache/:
 *   deck.html          the page itself, for publishing as an artifact
 *   deck-preview.html  the same wrapped in a document, for opening in a browser
 *
 * The deck carries its data inline because a published artifact cannot fetch
 * anything: no tiles, no API, no /data. The region outlines therefore travel as
 * SVG paths, which is why `build-shortlist.mjs` emits them.
 *
 * Publishing keeps the artifact's URL only if the same file path is republished,
 * or the existing URL is passed explicitly.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const cache = new URL('.cache/', root);
const shortlist = new URL('.cache/shortlist.json', root);

if (!existsSync(shortlist)) {
  console.error('No scored shortlist. Run: npm run data:shortlist');
  process.exit(1);
}

const data = JSON.parse(await readFile(shortlist, 'utf8'));

/** Only what the deck reads. The rest of the shortlist is working-out. */
const payload = {
  weights: data.weights,
  britPenalty: data.britPenalty,
  viewBox: data.viewBox,
  regions: data.regions.map(({ wineNames, ...region }) => ({
    ...region,
    wineNames: wineNames.slice(0, 6),
  })),
  inedible: data.inedible,
  context: data.context,
};

const [head, body] = await Promise.all(
  ['head.html', 'body.html'].map((file) => readFile(new URL(`presentation/${file}`, root), 'utf8')),
);

const page = `${head}
<script>
const DATA = ${JSON.stringify(payload)};
</script>
${body}`;

await mkdir(cache, { recursive: true });
await writeFile(new URL('deck.html', cache), page);
await writeFile(
  new URL('deck-preview.html', cache),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>\n${page.slice(head.length)}\n</body>\n</html>\n`,
);

const size = (text) => `${Math.round(Buffer.byteLength(text) / 1024)} kB`;
console.log(`Built .cache/deck.html (${size(page)})`);
console.log(`  ${payload.regions.length} provinces ranked, ${payload.inedible.length} ruled out`);
console.log(`  top three: ${payload.regions.slice(0, 3).map((r) => `${r.name} ${r.score}`).join(', ')}`);
console.log('\nOpen .cache/deck-preview.html to look at it.');
