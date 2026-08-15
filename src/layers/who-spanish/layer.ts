import type { Layer } from '../../lib/types.ts';

const BANDS = ['', 'light', 'noticeable', 'heavy', 'very heavy', 'the defining crowd'];

export default {
  id: 'who-spanish',
  name: '🇪🇸 Spanish',
  description: 'Where Spanish holidaymakers go',
  group: 'Who goes where',
  order: 13,
  defaultOn: false,

  source: '/data/resorts.geojson',
  attribution: 'Hand-compiled, deliberately opinionated',

  render: {
    type: 'symbol',
    icon: '🇪🇸',
    // Flags for the same place would land on top of each other, so each
    // nationality sits in its own corner.
    offset: [9, 9],
    size: {
      property: 'spanish',
      stops: [
        [1, 11],
        [5, 30],
      ],
      format: (v: number) => BANDS[v],
    },
    // Places where this lot are not worth mentioning.
    filter: ['>', ['get', 'spanish'], 0],
  },

  popup: {
    title: 'name',
    fields: [
      { key: 'region', label: 'Coast' },
      { key: 'spanish', label: 'Spanish presence', format: (v: number) => `${BANDS[v]} (${v}/5)` },
      { key: 'note', label: 'Verdict' },
    ],
  },
} satisfies Layer;
