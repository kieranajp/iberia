import type { Layer } from '../../lib/types.ts';

export default {
  id: 'international-cuisine',
  name: '🌍 World food in town',
  description: 'What is easy to find—and what may take hunting',
  group: 'Food & drink',
  order: 34,

  source: '/data/international-cuisine.geojson',
  attribution:
    '© OpenStreetMap contributors, ODbL; snapshot via Overpass and ohsome, bands derived from cuisine tags',

  render: {
    type: 'symbol',
    icon: '🍕',
    size: 28,
  },

  popup: {
    title: 'title',
    fields: [
      { key: 'easy', label: '🟢 Easy', big: true },
      { key: 'some', label: '🟡 Some', big: true },
      { key: 'thin', label: '🔎 Hunt', big: true },
      { key: 'breadth', label: 'Range' },
      { key: 'sample', label: 'OSM' },
    ],
  },
} satisfies Layer;
