import type { Layer } from '../../lib/types.ts';

export default {
  id: 'wine-regions',
  name: '🍷 Wine regions',
  description: 'The DO and DOCa wine denominations, 2 DOCa and 70 DO',
  group: 'Food & drink',
  order: 30,

  // One point per denomination, at a representative town — not the official boundary.
  // MAPA publishes the real DO polygons, but the download is captcha-gated and there
  // is no free alternative, so this cannot be a fill layer the way tourism.geojson is.
  source: '/data/wine-regions.geojson',
  attribution: 'MAPA, Denominaciones de Origen Protegidas de vinos',

  render: {
    type: 'circle',
    under: 'labels',
    opacity: 0.85,
    colour: {
      property: 'category',
      stops: [
        ['DOCa', '#7a1224'],
        ['DO', '#c2536a'],
      ],
      mode: 'match',
      format: (v: string) => (v === 'DOCa' ? 'Denominación de Origen Calificada' : 'Denominación de Origen'),
    },
    // DOCa is the higher of the two quality tiers — only Rioja and Priorat hold it —
    // so it gets a bigger dot rather than a separate legend.
    radius: {
      property: 'category',
      stops: [
        ['DOCa', 8],
        ['DO', 4.5],
      ],
      mode: 'match',
      // `match` needs a fallback even when every value is covered.
      missing: 4.5,
    },
    strokeWidth: 1,
    strokeColour: 'rgba(255,255,255,0.85)',
  },

  popup: {
    title: 'name',
    fields: [
      { key: 'category', label: 'Category' },
      { key: 'comunidad', label: 'Region' },
      { key: 'note', label: '' },
    ],
  },
} satisfies Layer;
