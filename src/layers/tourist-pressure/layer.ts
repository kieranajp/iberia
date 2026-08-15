import type { Layer } from '../../lib/types.ts';

export default {
  id: 'tourist-pressure',
  name: 'Tourist pressure',
  description: 'How outnumbered residents are',
  group: 'Practical',
  order: 21,

  source: '/data/tourism.geojson',
  attribution: 'Eurostat, NUTS 3 regions',
  unit: 'nights per resident',

  // From the same data, so the comparison is like for like.
  benchmarks: [
    { label: 'Madrid', value: 4.6 },
    { label: 'Iberia', value: 10 },
    { label: 'Lanzarote', value: 114.6 },
  ],

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.55,
    colour: {
      property: 'per_resident',
      stops: [
        [2, '#2d6a4f'],
        [5, '#6a994e'],
        [10, '#c9b458'],
        [25, '#d08c3c'],
        [60, '#bf4f2e'],
        [125, '#8f2140'],
      ],
    },
    outline: 'rgba(0,0,0,0.35)',
  },

  popup: {
    title: 'name',
    fields: [
      { key: 'per_resident', label: 'Nights per resident', format: (v: number) => `${v} a year` },
      { key: 'nights', label: 'Tourist nights', format: (v: number) => v.toLocaleString('en-GB') },
      { key: 'population', label: 'Residents', format: (v: number) => v.toLocaleString('en-GB') },
    ],
  },
} satisfies Layer;
