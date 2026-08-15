import data from '../../data/rainfall-benchmarks.json' with { type: 'json' };

type RainfallMetric = 'rainfall_mm' | 'rain_days' | 'very_heavy_days';

/** Values and provenance are refreshed with `npm run data:rainfall-benchmarks`. */
export function rainfallBenchmarks(metric: RainfallMetric) {
  return data.locations.map((location) => ({
    label: location.label,
    value: location[metric],
  }));
}
