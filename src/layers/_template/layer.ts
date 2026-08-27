import type { Layer } from '../../lib/types.ts';

/**
 * Layer template. Copy this folder to `src/layers/<your-id>/` and edit.
 * The map picks up new folders on its own — there is no registry to update.
 *
 * `satisfies Layer` at the bottom is what makes the editor and `npm run typecheck`
 * tell you off. Keep it. The full contract is in `src/lib/types.ts`; the options
 * below are the ones worth explaining.
 *
 * Delete every option you do not need. Only `id`, `name`, `source` and `render`
 * are required.
 */
export default {
  // Kebab-case, and the same as the folder name.
  id: 'template',

  name: 'My layer',
  description: 'What this shows, and from when',

  // Reuse a heading where it fits: Climate, Landscape, Food & drink, Culture, Practical.
  group: 'Other',

  // Lower sorts higher in the panel. Default 100.
  order: 100,

  // Tick the box on first load. Default false.
  defaultOn: false,

  // A GeoJSON file in `public/data/`, referenced from the site root.
  // WGS84 lon/lat, as GeoJSON always is.
  source: '/data/my-layer.geojson',

  attribution: 'Source name',
  unit: 'units',

  // Wanted on every numeric layer: familiar places to measure the map against.
  // They appear as marks on the legend's colour bar, and popups put the clicked
  // value in their terms ("1.4× Derry"). Pick places the reader knows in their
  // bones, not the biggest or the nearest.
  benchmarks: [
    { label: 'Lanzarote', value: 115 },
    { label: 'Derry', value: 1060 },
  ],

  render: {
    // Points: circle. Areas: fill. Routes: line. Density of many points: heatmap.
    // The type decides which other options are allowed — `width` on a circle is
    // a type error, not a silent no-op.
    type: 'circle',

    // Draws beneath the basemap's place names.
    under: 'labels',

    opacity: 0.8,

    // Either a fixed CSS colour, or a scale over a feature property.
    colour: {
      property: 'value',
      // Numbers blend between the stops. Use mode 'step' for flat bands, or
      // 'match' to look up by text value.
      stops: [
        [0, '#c07c28'],
        [100, '#2f74a8'],
      ],
      mode: 'interpolate',
      // How stop values are written in the legend.
      format: (v: number) => `${v}`,
    },

    // circle and heatmap only. A number, or the same shape as `colour`.
    radius: 6,

    // symbol layers can use an emoji as the marker instead of a colour:
    //   type: 'symbol', icon: '🇩🇪', size: { property: 'german', stops: [[1, 11], [5, 30]] },
    //   offset: [9, -9],   // pixels, to keep layers off each other's markers
    // Size alone carries the value, so leave `colour` off those.
    // Or map a feature property to local images (normalise them to 64×64):
    //   type: 'symbol', size: 30,
    //   icons: { property: 'brand', images: { local: '/data/logos/local.png' } },

    // Hide the layer outside this zoom range.
    minzoom: 0,
    maxzoom: 22,
  },

  // Omit for a layer nothing needs to be read off.
  popup: {
    // 'hover' follows the pointer and clears on leaving, which suits reading across
    // an area. 'click' (the default) pins the popup until dismissed.
    trigger: 'click',
    title: 'name',
    fields: [
      // `big` draws the value large and label-less, across the popup. For emoji.
      { key: 'icons', big: true },
      { key: 'value', label: 'Value', format: (v: number) => `${v} units` },
    ],
  },

  // Escape hatch: for anything the options above cannot express, drop a Svelte
  // component in the layer folder and set `component` instead of `render`.
} satisfies Layer;
