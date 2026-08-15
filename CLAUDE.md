# Iberia map

A static map of the Iberian peninsula that grows one data layer at a time.
Svelte 5 + Vite + TypeScript, MapLibre GL through `svelte-maplibre-gl`. No backend,
no API keys.

## Project environment

- Web-only Svelte 5 application, built by Vite 8 with TypeScript 6 and npm. It is not
  React Native and has no native iOS or Android projects.
- `npm run dev` serves on Vite's default port 5173; `npm run preview` uses 4173.
- The QA path is `npm run typecheck`, `npm run check`, then `npm run build`. There is no
  separate unit or end-to-end test runner.

## Adding a layer — the happy path

1. **Get the data as GeoJSON** (WGS84 lon/lat) and save it to `public/data/<id>.geojson`.
   If it comes from an API or a raw download, write `scripts/build-<id>.mjs` that produces
   the file and add a `data:<id>` entry to `package.json`. Commit the script, not the generated
   output. `scripts/build-rainfall.mjs` is the worked example: batching, caching, provenance.
2. **`npm run new-layer -- <id>`** — copies the template to `src/layers/<id>/layer.ts`.
3. **Edit that one file.** Set the name, group, `render.type`, colour stops and popup fields.
   Delete the options you do not use. It ends in `satisfies Layer`, so the editor lists what
   is allowed and refuses what is not: `width` on a circle layer is an error, not a silent
   no-op. `src/lib/types.ts` is the contract; `src/layers/_template/layer.ts` explains it.
4. **`npm run typecheck && npm run check`** — the first checks the layer against the
   interface, the second against its data: missing files, bad GeoJSON, and properties the
   layer refers to but the data does not have. It prints the property names it found.
5. **`npm run dev`** and look at it.

There is no registry. The folder is the registration: `src/lib/layers.ts` globs
`src/layers/*/layer.ts` and validates each one, skipping folders that start with `_`.

Types cover the shape of a layer; `npm run check` covers what types cannot see: the data,
and the MapLibre paint the layer generates. Both, every time.

A layer that MapLibre rejects draws nothing while looking perfectly healthy — the source
loads, the legend renders, the checkbox works. `check` validates the generated paint
against the style spec to catch that before the browser does, and the map shows any
runtime error in a banner rather than swallowing it.

## Rules

- **Every numeric layer carries `benchmarks`.** A rainfall figure in millimetres means
  nothing on its own; "1.4× Derry" means something. Two to four familiar places,
  in the same unit as the colour scale. For layers scored on a made-up scale, label the
  bands in words through `colour.format` instead — `light`, `heavy`, `saturated` —
  so the legend reads as English rather than as numbers.
- Data files go in `public/data/`. Never paste large GeoJSON into a `.ts` file.
- **`public/data/` is build output and is not in git. Every dataset has a build script.**
  Even the hand-compiled ones: the ratings in `data/resorts.json` are the source, one place
  per line so a diff reads like an argument about Benidorm, and `npm run data:resorts`
  wraps them in GeoJSON. Never hand-edit anything under `public/data/`; it will be
  overwritten and it is not backed up by the repo.
- Authored data goes in `data/` and is committed. Derived data goes in `public/data/` and
  is released. There is no third category.
- `npm run release` is where the datasets are kept: it checks, builds, and publishes both
  the site and the data as archives on a versioned GitHub release. A new machine runs
  `npm run data:restore` instead of spending an hour inside Open-Meteo's rate limits.
- **Publishing a release deploys it.** `deploy.yml` unpacks the site archive from the
  release into an nginx image and runs `helm upgrade` — it does not rebuild. Rebuilding
  would have to fetch the datasets again and could ship something other than what was
  released. Chart in `charts/iberia`; the image is static files and nothing else.
- **Pick one lane per layer and say which.** A layer that covers the Algarve but stops at
  the Spanish border for its neighbour is worse than either choice made consistently: a
  blank Portugal reads as "no tourists", not "no data". Eurostat covers both countries
  where Spain's INE stops at the border, so prefer it for anything comparative. Where a
  source really is Spain-only, put that in the layer's `description`.
- Property keys: short and lowercase (`mm`, `elevation`). Numbers as numbers, not strings.
- Keep a data file under about 5 MB. Coarsen the grid or simplify geometry instead.
- Reuse an existing group before inventing one: Climate, Landscape, Food & drink,
  Culture, Practical, Who goes where.
- Several layers may share one data file. `resorts.geojson` carries a column per
  nationality, and each layer draws its own with `filter` and a `size` scale. Prefer that
  to four near-identical files.
- Hand-compiled data is allowed where no survey exists, but say so in the layer's
  `attribution` and in the file's `metadata`, and keep the ratings on a stated scale.
- Adding a layer must not require editing `src/lib/` or `src/components/`. If it does,
  the contract is missing something: add the option to `src/lib/types.ts`, handle it in
  `src/lib/paint.ts`, check it in `src/lib/schema.ts`, and document it in the template.
- Anything the declarative options cannot express goes behind the escape hatch: a Svelte
  component in the layer folder, set as `component` in the layer file. Use it rarely.

## Layout

| Path | What it is |
| --- | --- |
| `src/layers/<id>/layer.ts` | One layer. The only file most changes touch. |
| `src/lib/types.ts` | The contract: the `Layer` interface and everything it allows. |
| `src/layers/_template/layer.ts` | The contract as a worked example. |
| `public/data/<id>.geojson` | That layer's data. |
| `scripts/build-<id>.mjs` | How that data was produced, so it can be rebuilt. |
| `data/<id>.json` | Hand-compiled source, where a layer's data is a judgement. |
| `scripts/release.mjs` | Checks, builds, and publishes the site and the datasets. |
| `charts/iberia/` | Helm chart: deployment, service, Traefik IngressRoute. |
| `.github/workflows/` | CI on push; deploy on a published release. |
| `src/lib/layers.ts` | Finds and validates layers. |
| `src/lib/paint.ts` | Turns `render` into MapLibre paint properties and legends. |
| `src/lib/schema.ts` | Runtime validation. Shared by the browser and `npm run check`. |
| `src/components/DataLayer.svelte` | Renders any declarative layer. |
| `src/components/LayerPanel.svelte` | Toggles, legends, search. |

## Traps

- **Keep `maplibre-gl` on 5.x.** With 6.3.0, `svelte-maplibre-gl` 2.2.1 throws inside its
  GeoJSON source setup and the map stalls before any tile is requested: no console error,
  no tiles, a blank basemap. Recheck when `svelte-maplibre-gl` states v6 support in its
  changelog rather than only in its peer range.
- **Never give the map container its own `position`.** Size a parent element instead;
  the map fills it. `maplibre-gl.css` is imported first in `main.ts` so `app.css` can
  override it — keep that order, and put overrides of MapLibre's own classes (popups,
  controls) in `app.css` rather than in a component's scoped styles.
- **`typescript` stays on 6.x.** `svelte-check` refuses to run against TypeScript 7
  unless both majors are installed.
- In dev the map instance is on `window.__map`, which is the quickest way to inspect
  camera, style and source state from a browser console or CDP.

## Conventions

- British English in the UI and in code (`colour`, not `color`, except in MapLibre's own
  property names, which stay as the spec writes them).
- Map state lives in the URL hash, so links share a view. Layer toggles live in
  `localStorage`.
- Basemaps come from OpenFreeMap and need no key. Terrain and hillshade sources must stay
  keyless too.
