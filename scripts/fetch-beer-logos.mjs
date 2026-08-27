/**
 * Refreshes the committed beer logo source assets from their documented homes.
 * Not part of `npm run data`: releases rebuild from the pinned 64×64 PNGs in data/.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const OUT = new URL('../data/beer-logos/', import.meta.url);
const TMP = new URL('../.cache/beer-logo-downloads/', import.meta.url);
const sources = {
  'estrella-galicia': 'https://estrellagalicia.es/content/dam/hdr-sites/spain/eg/favicons/apple-touch-icon.png',
  mahou: 'https://www.mahou.es/wp-content/themes/mahouv3/favicon/favicon.ico',
  amstel: 'https://www.amstel.es/wp-content/uploads/2026/04/amstel-logo.png',
  keler: 'https://www.keler.eus/themes/custom/keler/favicon.ico',
  'san-miguel': 'https://www.sanmiguel.com/es/wp-content/uploads/sites/2/2021/03/cropped-Cervezas-San-Miguel-logo-192x192.jpg',
  ambar: 'https://ambar.com/wp-content/themes/ambar/assets/favicons/apple-icon-180x180.png',
  'estrella-damm': 'https://www.estrelladamm.com/themes/custom/estrelladamm/img/favicons/apple-touch-icon-180x180.png',
  turia: 'https://www.cervezaturia.es/sites/default/files/favicon.ico',
  cruzcampo: 'https://www.cruzcampo.es/static/img/favicon/apple-touch-icon.png',
  alhambra: 'https://www.cervezasalhambra.com/themes/alhambra/assets/img/favicons.ico/apple-icon-180x180.png',
  'estrella-levante': 'https://www.estrelladelevante.es/themes/custom/damm/favicon.ico',
  tropical: 'https://static.wixstatic.com/media/e38af7_92380c28a9f743259a97a5f682b12f52~mv2.png/v1/fill/w_192,h_192,lg_1,q_95/e38af7_92380c28a9f743259a97a5f682b12f52~mv2.png',
  dorada: 'https://static.wixstatic.com/media/73a070_cb6f53cb2fac423bad5ddf0205ba84b9~mv2.png/v1/fill/w_192,h_192,lg_1,q_95/73a070_cb6f53cb2fac423bad5ddf0205ba84b9~mv2.png',
  'super-bock': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Super_Bock_logo.svg',
  sagres: 'https://www.cervejasagres.pt/images/favicons/favicon-32x32.png',
  especial: 'https://pintplease.s3.eu-west-1.amazonaws.com/beer/profile/especial_36873-1.jpg',
  coral: 'https://beertasting.app/storage/media/f268af1199c2c92ae55f43299a1bbd5b/conversions/lyxkceovav31lvsynift-optimized.jpg',
};
const darkBadges = {
  amstel: '#d41424',
};

await mkdir(OUT, { recursive: true });
await mkdir(TMP, { recursive: true });

for (const [key, url] of Object.entries(sources)) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; iberia-map-data-builder/1.0)',
      referer: new URL('/', url).href,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${key}: ${response.status} fetching ${url}`);
  const contentType = response.headers.get('content-type') ?? '';
  const suffix = contentType.includes('svg')
    ? 'svg'
    : contentType.includes('icon')
      ? 'ico'
      : contentType.includes('jpeg')
        ? 'jpg'
        : 'png';
  const input = new URL(`${key}.${suffix}`, TMP);
  await writeFile(input, Buffer.from(await response.arrayBuffer()));
  const output = new URL(`${key}.png`, OUT);
  const badge = darkBadges[key] ?? '#fffffff2';
  await exec('magick', [
    '-size', '64x64', 'xc:none',
    '-fill', badge, '-stroke', '#17120f30', '-strokewidth', '1',
    '-draw', 'roundrectangle 1,1 62,62 11,11',
    '(', `${input.pathname}[0]`, '-trim', '+repage', '-thumbnail', '54x54', ')',
    '-gravity', 'center', '-composite',
    '-strip', output.pathname,
  ]);
  console.log(`Wrote data/beer-logos/${key}.png`);
}

await rm(TMP, { recursive: true, force: true });
