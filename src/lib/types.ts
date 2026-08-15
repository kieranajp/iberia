import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { Component } from 'svelte';

/**
 * The layer contract. Everything a layer can say about itself lives here, and
 * `src/layers/_template/layer.ts` is a worked example of it.
 */

/** A value that varies by feature property. */
export interface ScaleSpec<T = string> {
  /** Feature property to read, e.g. 'mm'. */
  property: string;
  /** Ascending value/output pairs. `match` mode keys on strings instead of numbers. */
  stops: [number | string, T][];
  /** interpolate: blend between stops. step: flat bands. match: look up by value. */
  mode?: 'interpolate' | 'step' | 'match';
  /** Output for values the stops do not cover. `match` mode only. */
  missing?: T;
  /** How stop values are written in the legend. */
  format?: FeatureValueFormatter;
}

/**
 * Feature properties come out of GeoJSON untyped, so formatters take `any`.
 * Annotate the parameter in your layer file and the call site is checked.
 */
export type FeatureValueFormatter = (value: any) => string;

/** A fixed value, a raw MapLibre expression, or a scale over a feature property. */
export type Scale<T = string> = T | ExpressionSpecification | ScaleSpec<T>;

interface RenderBase {
  /** 'labels' draws the layer beneath the basemap's place names. */
  under?: 'labels';
  opacity?: number;
  minzoom?: number;
  maxzoom?: number;
  filter?: FilterSpecification;
  colour?: Scale;
}

export interface CircleRender extends RenderBase {
  type: 'circle';
  radius?: Scale<number>;
  strokeWidth?: number;
  strokeColour?: string;
}

export interface FillRender extends RenderBase {
  type: 'fill';
  outline?: string;
}

export interface LineRender extends RenderBase {
  type: 'line';
  width?: Scale<number>;
}

export interface HeatmapRender extends RenderBase {
  type: 'heatmap';
  radius?: Scale<number>;
  weight?: Scale<number>;
  heatmapColour?: ExpressionSpecification;
}

export interface SymbolRender extends RenderBase {
  type: 'symbol';
  /**
   * An emoji to mark each feature, e.g. '🇬🇧'. Drawn to an image, because the
   * basemap's glyph fonts have no emoji in them.
   */
  icon?: string;
  /** How large the icon is drawn, in pixels. A number, or a scale. Default 22. */
  size?: Scale<number>;
  /** Nudge in screen pixels, so layers on the same places do not sit on top of each other. */
  offset?: [number, number];
  /** Property holding text to draw instead of an icon. */
  label?: string;
  textSize?: number;
  font?: string[];
  haloColour?: string;
}

export type Render = CircleRender | FillRender | LineRender | HeatmapRender | SymbolRender;

/** A familiar place to measure the map against, in the same unit as the colour scale. */
export interface Benchmark {
  label: string;
  value: number;
}

export interface PopupField {
  /** Feature property to show. */
  key: string;
  label?: string;
  format?: FeatureValueFormatter;
}

export interface Popup {
  /** Property to use as the heading. */
  title?: string;
  fields?: PopupField[];
}

interface LayerBase {
  /** Kebab-case, and the same as the folder name. */
  id: string;
  /** Shown in the layer panel. */
  name: string;
  description?: string;
  /** Panel heading. Reuse one: Climate, Landscape, Food & drink, Culture, Practical. */
  group?: string;
  /** Lower sorts higher in the panel. Default 100. */
  order?: number;
  defaultOn?: boolean;
  /** Credit for the data, shown in the map's attribution box. May contain a link. */
  attribution?: string;
  /** Printed after the numbers on the legend, e.g. 'mm/yr'. */
  unit?: string;
  /** Two or three familiar places. Wanted on every numeric layer. */
  benchmarks?: Benchmark[];
}

/** The ordinary case: a GeoJSON file drawn from a declarative `render` block. */
export interface DataLayer extends LayerBase {
  /** A file under `public/data`, referenced from the site root, or inline GeoJSON. */
  source: string | FeatureCollection;
  render: Render;
  popup?: Popup;
  component?: never;
}

/** The escape hatch: a Svelte component that draws itself. */
export interface CustomLayer extends LayerBase {
  component: Component<{ def: CustomLayer }>;
  source?: string | FeatureCollection;
  render?: never;
  popup?: never;
}

export type Layer = DataLayer | CustomLayer;
