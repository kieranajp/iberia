import type { Layer } from '../../lib/types.ts';
import { rainfallBenchmarks } from '../_rainfall-benchmarks.ts';

function rainDaysStory(days: number) {
  if (days < 60) return '🌵 Rain is an event here, not a routine.';
  if (days < 90) return '🌤️ Long dry spells are normal; rain mostly comes in episodes.';
  if (days < 120) return '🌦️ Rain turns up regularly, but still less often than in Berlin.';
  if (days < 150) return '☔ A wet day every few days — regular, but not Derry-persistent.';
  if (days < 180) return '🌧️ Wet days are a familiar part of the week.';
  return '🌧️ Persistent-rain country: more drip-drip-drip than occasional drama.';
}

export default {
  id: 'rain-days',
  name: 'Rainy days',
  description: 'Mean days with at least 1 mm, 2015–2024',
  group: 'Climate',
  order: 11,

  // Shares the daily precipitation behind the yearly-rainfall layer.
  source: '/data/rainfall.geojson',
  attribution:
    'Open-Meteo <a href="https://open-meteo.com/en/docs/historical-weather-api">Historical Weather API</a> (Best Match model)',
  unit: 'days/yr',

  benchmarks: rainfallBenchmarks('rain_days'),

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.6,
    colour: {
      property: 'rain_days',
      stops: [
        [30, '#8a3a12'],
        [60, '#c07c28'],
        [90, '#ddc169'],
        [120, '#8fbd6d'],
        [150, '#3f9e8c'],
        [180, '#2f74a8'],
        [220, '#2b3f8f'],
      ],
      format: (days) => `${days}`,
    },
  },

  popup: {
    fields: [
      { key: 'rain_days', label: '', format: rainDaysStory },
      {
        key: 'rain_days',
        label: 'Rainy days',
        format: (v) => `${v.toLocaleString('en-GB')} days/yr`,
      },
      { key: 'mm', label: 'Annual total', format: (v) => `${v.toLocaleString('en-GB')} mm/yr` },
      { key: 'elevation', label: 'Elevation', format: (v) => `${v} m` },
    ],
  },
} satisfies Layer;
