# Iberia

A map of Spain, one data layer at a time.

![The four nationality layers switched on at once](docs/screenshot.png)

## Why

I moved to Spain and wanted to understand it better than a guidebook allows — where it
rains, where everyone else goes, and where they don't. Each layer answers one question,
and switching two on at once usually asks a better one.

It doubles as a way of deciding where to go over the coming year. The nationality layers
started as a joke about avoiding the Costa del Sol and turned into the most useful thing
here: switch all four on and the country divides itself up in front of you.

## Layers

| Layer | What it shows | Source |
| --- | --- | --- |
| Yearly rainfall | Mean annual precipitation, 2015–2024 | ERA5 via Open-Meteo, 0.5° grid |
| Tourist pressure | How outnumbered residents are | Eurostat, NUTS 3 regions |
| Tourist volume | How many tourists, in total | Eurostat, NUTS 3 regions |
| Who goes where | 62 places rated 0–5 for British, German, French and Spanish crowds | Hand-compiled |

Pressure and volume read the same file and disagree usefully: Valencia is tenth by volume
and thirty-first by pressure, because dividing by 2.6 million residents hides a lot.

Numeric layers carry benchmarks — familiar places marked on the legend — so 1,600 mm reads
as "1.3× Ireland" and 114 nights per resident reads as "Lanzarote".

## Running it

```sh
npm install
npm run dev
```

The generated datasets are not in the repo. Build them once:

```sh
npm run data:tourism     # a minute
npm run data:rainfall    # an hour or more: Open-Meteo rate-limits hard, and the
                         # script waits for each window rather than giving up
```

Both cache every response, so a second run costs nothing. Until they have run, those layers
show a red note on the map instead of silently drawing nothing.

## Adding a layer

```sh
npm run new-layer -- volcanoes   # creates src/layers/volcanoes/layer.ts
# put the GeoJSON at public/data/volcanoes.geojson, then edit the layer file
npm run typecheck && npm run check
```

There is no registry: the folder is the registration. A layer file is a plain object —
source, render type, colour stops, popup fields — ending in `satisfies Layer`, so the
editor lists what is allowed and refuses what is not. `src/lib/types.ts` is the contract,
`src/layers/_template/layer.ts` is the worked example, and `CLAUDE.md` is the house style.

The two checks cover different halves. `typecheck` catches the shape of a layer;
`check` catches everything types cannot see — missing files, malformed GeoJSON, and
properties the layer refers to but the data does not have.

## Stack

Svelte 5, Vite and TypeScript, with MapLibre GL through `svelte-maplibre-gl`. Basemaps come
from OpenFreeMap. No backend, no API keys, nothing to sign up for.

## On the data

Everything is sourced or admitted. The rainfall and tourism layers come from ERA5 and
Eurostat and can be rebuilt from the scripts that made them. The nationality ratings are
mine, hand-compiled, and the file says so — they are a judgement about the character of a
place, not a statistic. Where a source stops at the Spanish border, the layer says so
rather than leaving Portugal blank, which would read as "no tourists" instead of "no data".

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Static build into `dist/` |
| `npm run typecheck` | Checks layers against the `Layer` interface |
| `npm run check` | Validates layers against their data |
| `npm run new-layer -- <id>` | Scaffolds a layer |
| `npm run data:rainfall` | Rebuilds the rainfall grid |
| `npm run data:tourism` | Rebuilds the tourism figures |
