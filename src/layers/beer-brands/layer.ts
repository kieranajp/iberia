import type { Layer } from '../../lib/types.ts';

const LOGOS = [
  'estrella-galicia',
  'mahou',
  'amstel',
  'keler',
  'san-miguel',
  'ambar',
  'estrella-damm',
  'turia',
  'cruzcampo',
  'alhambra',
  'estrella-levante',
  'tropical',
  'dorada',
  'super-bock',
  'sagres',
  'especial',
  'coral',
];

export default {
  id: 'beer-brands',
  name: '🍺 Beer on the bar',
  description: 'The logos you are likely to run into — not a live sales ranking',
  group: 'Food & drink',
  order: 33,

  source: '/data/beer-brands.geojson',
  attribution:
    'Hand-compiled from brewery portfolios and regional availability; brand marks belong to their owners',

  render: {
    type: 'symbol',
    size: 30,
    icons: {
      property: 'logo',
      images: Object.fromEntries(LOGOS.map((logo) => [logo, `/data/beer-logos/${logo}.png`])),
    },
  },

  popup: {
    title: 'brand',
    fields: [
      { key: 'area', label: 'Where' },
      { key: 'status', label: 'Why this logo' },
      { key: 'also', label: 'Also likely' },
      { key: 'note', label: '' },
    ],
  },
} satisfies Layer;
