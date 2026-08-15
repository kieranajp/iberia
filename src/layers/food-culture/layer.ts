import type { Layer } from '../../lib/types.ts';

const BANDS = [
  '',
  'bring sandwiches',
  'hard work',
  'manageable',
  'easy going',
  'you will eat better than the carnivores',
];

export default {
  id: 'food-culture',
  name: '🥬 Eating without meat',
  description: 'How hard a vegetarian will find it',
  group: 'Food & drink',
  order: 31,

  source: '/data/food-culture.geojson',
  attribution: 'Hand-compiled opinion, boundaries from Eurostat',

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.5,
    colour: {
      property: 'rating',
      mode: 'step',
      stops: [
        [1, '#8f2140'],
        [2, '#c25f2e'],
        [3, '#c9b458'],
        [4, '#6a994e'],
        [5, '#2d6a4f'],
      ],
      format: (v: number) => BANDS[v],
    },
    outline: 'rgba(0,0,0,0.4)',
  },

  // Hover rather than click: this layer is for reading across the map, not for
  // interrogating one region.
  popup: {
    trigger: 'hover',
    title: 'name',
    fields: [
      { key: 'icons', big: true },
      { key: 'verdict', label: '' },
      { key: 'meat', label: '🥩' },
      { key: 'veg', label: '🥬' },
      { key: 'rating', label: '', format: (v: number) => BANDS[v] },
    ],
  },
} satisfies Layer;
