import type { Layer } from '../../lib/types.ts';

export default {
  id: 'toll-roads',
  name: 'Toll roads',
  description: 'Distinct tolled road references in each mainland province-sized region',
  group: 'Practical',
  order: 23,

  source: '/data/toll-roads.geojson',
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>; Eurostat GISCO, NUTS 3',
  unit: 'roads',

  benchmarks: [
    { label: 'Barcelona', value: 2 },
    { label: 'Madrid', value: 7 },
    { label: 'Lisbon', value: 16 },
  ],

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.58,
    colour: {
      property: 'count',
      mode: 'step',
      stops: [
        [0, '#e6e3db'],
        [1, '#f2cf63'],
        [2, '#e89b43'],
        [4, '#cf5d3c'],
        [7, '#9d3449'],
        [11, '#612b55'],
      ],
      format: (v: number) => (v < 2 ? (v === 0 ? 'none' : '1') : `${v}+`),
    },
    outline: 'rgba(0,0,0,0.35)',
  },

  popup: {
    title: 'name',
    fields: [
      {
        key: 'count',
        label: 'Toll roads',
        format: (v: number) => `${v} ${v === 1 ? 'road' : 'roads'}`,
      },
      { key: 'roads', label: 'References' },
    ],
  },
} satisfies Layer;
