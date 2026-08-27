import type { Layer } from '../../lib/types.ts';
import { berlinWinterLight, winterLightBenchmarks } from '../_winter-light-benchmarks.ts';

function winterLightStory(light: number) {
  const berlinRatio = light / berlinWinterLight;
  if (berlinRatio < 1.15) return '🌑 Berlin-grade winter light: properly grim by this measure.';
  if (berlinRatio < 1.75) return '🌫️ Brighter than Berlin, but still on the dim side.';
  if (berlinRatio < 2.25) return '⛅ Around twice Berlin’s winter light.';
  if (berlinRatio < 2.8) return '🌤️ A very different winter from Berlin — natural light is plentiful.';
  return '☀️ Winter barely gets a vote here.';
}

function daylightDuration(hours: number) {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min/day`;
}

export default {
  id: 'winter-light',
  name: 'Winter light',
  description: 'Mean solar light at ground, Dec–Feb 2015–2024 — a proxy, not a SAD score',
  group: 'Climate',
  order: 5,

  source: '/data/winter-light.geojson',
  attribution:
    'NASA <a href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/">POWER</a> (SYN1DEG); land mask © <a href="https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics">Eurostat GISCO</a>',
  unit: 'MJ/m²/day',
  benchmarks: winterLightBenchmarks,

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.68,
    colour: {
      property: 'light_mj',
      stops: [
        [2, '#18212e'],
        [3, '#2c3d52'],
        [4.5, '#50677a'],
        [6, '#78969b'],
        [7.5, '#b4b985'],
        [9, '#dec66f'],
        [11, '#f5df8d'],
      ],
      format: (value) => `${value}`,
    },
  },

  popup: {
    fields: [
      { key: 'light_mj', label: '', format: winterLightStory },
      {
        key: 'light_mj',
        label: 'Winter light',
        format: (value) => `${value.toLocaleString('en-GB')} MJ/m²/day`,
      },
      { key: 'daylight_h', label: 'Daylight window', format: daylightDuration },
    ],
  },
} satisfies Layer;
