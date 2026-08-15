import type { Map } from 'maplibre-gl';

declare global {
  interface Window {
    /** The map instance, in dev only, for poking at from the console. */
    __map?: Map;
  }
}

export {};
