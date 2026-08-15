import type * as maplibregl from 'maplibre-gl';

/** Keyless vector basemap from OpenFreeMap. Liberty carries the most detail. */
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export const IBERIA = { center: [-4.0, 39.9] as [number, number], zoom: 5.4 };

/**
 * Id of the first label layer, so data can be drawn under place names
 * rather than over them.
 */
export function firstLabelLayerId(map: maplibregl.Map): string | undefined {
  const layer = map.getStyle()?.layers?.find((l) => l.type === 'symbol');
  return layer?.id;
}
