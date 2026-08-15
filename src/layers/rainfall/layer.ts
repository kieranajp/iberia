import type { Layer } from '../../lib/types.ts';

function rainfallStory(mm: number) {
  if (mm < 400) return '🏜️ Rain makes a cameo here. It is not part of the regular cast.';
  if (mm < 650) return '🌤️ On the dry side — around Berlin’s annual total, or less.';
  if (mm < 900) return '🌦️ Enough rain to keep things green, without defining the place.';
  if (mm < 1200) return '☔ Properly wet — Derry territory by total, though not necessarily by frequency.';
  if (mm < 1600) return '🌧️ A lot of water. The question is whether it arrives gently or all at once.';
  return '🌊 Atlantic-firehose numbers. Check rainy days to see whether this means persistence or downpours.';
}

export default {
  id: 'rainfall',
  name: 'Yearly rainfall',
  description: 'Mean annual total, 2015–2024',
  group: 'Climate',
  order: 10,
  defaultOn: true,

  source: '/data/rainfall.geojson',
  attribution:
    'Open-Meteo <a href="https://open-meteo.com/en/docs/historical-weather-api">Historical Weather API</a> (Best Match model)',
  unit: 'mm/yr',

  // Reference averages, rounded. They anchor the scale to somewhere known.
  benchmarks: [
    { label: 'Lanzarote', value: 115 },
    { label: 'Berlin', value: 570 },
    { label: 'Derry', value: 1060 },
    { label: 'Keswick', value: 1530 },
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
      { key: 'mm', label: '', format: rainfallStory },
      { key: 'mm', label: 'Rainfall', format: (v) => `${v.toLocaleString('en-GB')} mm/yr` },
      { key: 'elevation', label: 'Elevation', format: (v) => `${v} m` },
    ],
  },
} satisfies Layer;
