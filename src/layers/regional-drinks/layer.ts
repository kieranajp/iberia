import type { Layer } from '../../lib/types.ts';

export default {
  id: 'regional-drinks',
  name: '🍸 Regional bevvies',
  description: 'What to order, and the local ritual around it',
  group: 'Food & drink',
  order: 32,

  source: '/data/regional-drinks.geojson',
  attribution:
    'Hand-compiled cultural guide from official Spanish and Portuguese tourism sources; boundaries © Eurostat GISCO',

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.42,
    colour: {
      property: 'family',
      mode: 'match',
      stops: [
        ['Cider', '#d5a326'],
        ['Wine', '#8f3d59'],
        ['Fortified wine', '#b5653b'],
        ['Aperitif', '#d55645'],
        ['Spirit & liqueur', '#72508f'],
        ['Cocktail', '#258d88'],
        ['Coffee & soft', '#78543a'],
        ['Tea', '#4f8065'],
      ],
      format: (value: string) => value,
    },
    outline: 'rgba(25,18,15,0.48)',
  },

  popup: {
    trigger: 'click',
    title: 'name',
    fields: [
      { key: 'icon', big: true },
      { key: 'drink', label: 'Order' },
      { key: 'ritual', label: 'How' },
      { key: 'also', label: 'Also' },
      { key: 'note', label: '' },
    ],
  },
} satisfies Layer;
