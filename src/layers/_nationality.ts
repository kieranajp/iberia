import type { Popup, SymbolRender } from '../lib/types.ts';

/**
 * The four nationality layers differ only in which column they read and where
 * their flag sits. Everything else lives here, so a change to the bands or the
 * popup happens once rather than four times.
 *
 * A file directly in `src/layers/` is not a layer: the glob only picks up
 * `src/layers/<id>/layer.ts`.
 */
const BANDS = ['', 'light', 'noticeable', 'heavy', 'very heavy', 'the defining crowd'];

/** Flags for the same place would land on top of each other, so each nation gets a corner. */
export function flagRender(
  property: string,
  flag: string,
  offset: [number, number],
): SymbolRender {
  return {
    type: 'symbol',
    icon: flag,
    offset,
    size: {
      property,
      stops: [
        [1, 11],
        [5, 30],
      ],
      format: (v: number) => BANDS[v],
    },
    filter: ['>', ['get', property], 0], // places where this lot are not worth mentioning
  };
}

export function flagPopup(property: string, label: string): Popup {
  return {
    title: 'name',
    fields: [
      { key: 'region', label: 'Coast' },
      { key: property, label: `${label} presence`, format: (v: number) => `${BANDS[v]} (${v}/5)` },
      { key: 'note', label: 'Verdict' },
    ],
  };
}
