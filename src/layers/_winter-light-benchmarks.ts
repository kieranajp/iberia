import data from '../../data/winter-light-benchmarks.json' with { type: 'json' };

/** Values and provenance are refreshed with `npm run data:winter-light-benchmarks`. */
export const winterLightBenchmarks = data.locations.map((location) => ({
  label: location.label,
  value: location.light_mj,
}));

export const berlinWinterLight = data.locations.find(({ label }) => label === 'Berlin')!.light_mj;
