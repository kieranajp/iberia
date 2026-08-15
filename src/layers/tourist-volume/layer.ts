import type { Layer } from '../../lib/types.ts';

export default {
  id: 'tourist-volume',
  name: 'Tourist volume',
  description: 'How many tourists, in total',
  group: 'Practical',
  order: 22,

  // Same file as tourist-pressure. The two answer different questions: this one
  // counts tourists, that one counts them against the people who live there.
  source: '/data/tourism.geojson',
  attribution: 'Eurostat, NUTS 3 regions',
  unit: 'nights a year',

  benchmarks: [
    { label: 'Lisbon', value: 19_900_000 },
    { label: 'Madrid', value: 32_300_000 },
  ],

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.55,
    colour: {
      property: 'nights',
      stops: [
        [250_000, '#f2e8d5'],
        [1_500_000, '#c9c07a'],
        [5_000_000, '#8fae6b'],
        [15_000_000, '#3f8a7d'],
        [35_000_000, '#2a5980'],
        [55_000_000, '#2b2f6b'],
      ],
      format: (v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : `${Math.round(v / 1000)}k`),
    },
    outline: 'rgba(0,0,0,0.35)',
  },

  popup: {
    title: 'name',
    fields: [
      { key: 'nights', label: 'Tourist nights', format: (v: number) => v.toLocaleString('en-GB') },
      { key: 'per_resident', label: 'Per resident', format: (v: number) => `${v} a year` },
      { key: 'population', label: 'Residents', format: (v: number) => v.toLocaleString('en-GB') },
    ],
  },
} satisfies Layer;
