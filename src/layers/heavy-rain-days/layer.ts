import type { Layer } from '../../lib/types.ts';
import { rainfallBenchmarks } from '../_rainfall-benchmarks.ts';

const VERDICTS = [
  '',
  '🌦️ The dramatic stuff is rare. Most wet days here are ordinary ones.',
  '☔ A few proper soakings each year — punctuation rather than the plot.',
  '🌧️ Heavy rain is a regular visitor here, not a freak event.',
  '🌧️ The sky opens properly roughly once a month or more.',
  '⛈️ Not drizzle with good publicity. This is proper rain, often.',
];

export default {
  id: 'heavy-rain-days',
  name: 'Very heavy rain',
  description: 'Mean days with at least 20 mm, 2015–2024',
  group: 'Climate',
  order: 12,

  source: '/data/rainfall.geojson',
  attribution:
    'Open-Meteo <a href="https://open-meteo.com/en/docs/historical-weather-api">Historical Weather API</a> (Best Match model); threshold from <a href="https://surfobs.climate.copernicus.eu/userguidance/indicesdictionary.php">Copernicus R20mm</a>',
  unit: 'days/yr',

  benchmarks: rainfallBenchmarks('very_heavy_days'),

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.6,
    colour: {
      property: 'very_heavy_days',
      stops: [
        [0, '#eee3c4'],
        [2, '#d8bd70'],
        [5, '#9fbd72'],
        [10, '#51a08b'],
        [15, '#337b9b'],
        [25, '#3b5288'],
        [35, '#2a235f'],
      ],
      format: (days) => `${days}`,
    },
  },

  popup: {
    fields: [
      { key: 'downpour_band', label: '', format: (v) => VERDICTS[v] },
      { key: 'very_heavy_days', label: '≥20 mm days', format: (v) => `${v} a year` },
      { key: 'heavy_days', label: '≥10 mm days', format: (v) => `${v} a year` },
      { key: 'wettest_day', label: 'Wettest day', format: (v) => `${v} mm` },
      { key: 'mm', label: 'Annual total', format: (v) => `${v.toLocaleString('en-GB')} mm/yr` },
    ],
  },
} satisfies Layer;
