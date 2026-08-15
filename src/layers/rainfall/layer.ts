import type { Layer } from '../../lib/types.ts';

export default {
  id: 'rainfall',
  name: 'Yearly rainfall',
  description: 'Mean annual total, 2015–2024',
  group: 'Climate',
  order: 10,
  defaultOn: true,

  source: '/data/rainfall.geojson',
  attribution: 'ERA5 via <a href="https://open-meteo.com/">Open-Meteo</a>',
  unit: 'mm/yr',

  // Long-run averages, rounded. They anchor the scale to somewhere known.
  benchmarks: [
    { label: 'Lanzarote', value: 115 },
    { label: 'Berlin', value: 570 },
    { label: 'Ireland', value: 1230 },
  ],

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.6,
    colour: {
      property: 'mm',
      stops: [
        [250, '#8a3a12'],
        [450, '#c07c28'],
        [650, '#ddc169'],
        [850, '#8fbd6d'],
        [1100, '#3f9e8c'],
        [1500, '#2f74a8'],
        [2000, '#2b3f8f'],
      ],
      format: (mm) => `${mm}`,
    },
  },

  popup: {
    fields: [
      { key: 'mm', label: 'Rainfall', format: (v) => `${v.toLocaleString('en-GB')} mm/yr` },
      { key: 'elevation', label: 'Elevation', format: (v) => `${v} m` },
    ],
  },
} satisfies Layer;
