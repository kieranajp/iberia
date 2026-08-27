import type { Benchmark, FillRender, Render, Scale, ScaleSpec } from './types.ts';

/** Turns the declarative `render` block of a layer into MapLibre paint properties. */

type ScaleObject = ScaleSpec<unknown>;

const isScaleObject = (scale: unknown): scale is ScaleObject =>
  typeof scale === 'object' && scale !== null && !Array.isArray(scale) && 'stops' in scale;

function scaleToExpression(scale: Scale<unknown> | undefined, fallback: unknown): unknown {
  if (scale === undefined || scale === null) return fallback;
  if (!isScaleObject(scale)) return scale;

  const { property, stops, mode = 'interpolate', missing = fallback } = scale;
  const value = ['get', property];

  if (mode === 'match') return ['match', value, ...stops.flat(), missing];
  if (mode === 'step') {
    const [, first] = stops[0];
    return ['step', value, first, ...stops.slice(1).flat()];
  }
  return ['interpolate', ['linear'], value, ...stops.flat()];
}

export type PatternKind =
  | 'diagonal'
  | 'reverse-diagonal'
  | 'horizontal'
  | 'vertical'
  | 'dots'
  | 'crosshatch';

/**
 * Area layers from different sections get different visual channels when combined.
 * Keeping this mapping here makes map textures and legend textures agree.
 */
export function patternForGroup(group: string | undefined): PatternKind {
  switch (group) {
    case 'Practical':
      return 'diagonal';
    case 'Food & drink':
      return 'dots';
    case 'Climate':
      return 'horizontal';
    case 'Landscape':
      return 'vertical';
    case 'Culture':
      return 'crosshatch';
    default:
      return 'reverse-diagonal';
  }
}

export interface FillPatternSpec {
  images: { id: string; colour: string }[];
  paint: Record<string, unknown>;
}

/**
 * Turns a fill colour scale into categorical image ids. MapLibre cannot blend
 * pattern images, so continuous scales are deliberately quantised at the
 * midpoints between their authored stops while layers are combined.
 */
export function buildFillPattern(render: FillRender, prefix: string): FillPatternSpec | null {
  const colour = render.colour ?? '#7aa2f7';
  if (typeof colour === 'string') {
    const id = `${prefix}-pattern-0`;
    return {
      images: [{ id, colour }],
      paint: patternPaint(render, id),
    };
  }
  if (!isScaleObject(colour)) return null;

  const stops = colour.stops;
  if (!stops.length || stops.some(([, output]) => typeof output !== 'string')) return null;

  const images = stops.map(([, output], i) => ({ id: `${prefix}-pattern-${i}`, colour: output as string }));
  const value = ['get', colour.property];
  const mode = colour.mode ?? 'interpolate';
  let expression: unknown;

  if (mode === 'match') {
    const fallbackColour = typeof colour.missing === 'string' ? colour.missing : null;
    let fallbackId = images[0].id;
    if (fallbackColour) {
      const existing = images.find((image) => image.colour === fallbackColour);
      fallbackId = existing?.id ?? `${prefix}-pattern-missing`;
      if (!existing) images.push({ id: fallbackId, colour: fallbackColour });
    }
    expression = ['match', value, ...stops.flatMap(([key], i) => [key, images[i].id]), fallbackId];
  } else {
    const thresholds = stops.slice(1).flatMap(([stop], i) => {
      const threshold =
        mode === 'step'
          ? stop
          : ((stops[i][0] as number) + (stop as number)) / 2;
      return [threshold, images[i + 1].id];
    });
    expression = ['step', value, images[0].id, ...thresholds];
  }

  return { images, paint: patternPaint(render, expression) };
}

function patternPaint(render: FillRender, pattern: unknown): Record<string, unknown> {
  return {
    'fill-pattern': pattern,
    'fill-opacity': 0.94,
    ...(render.outline ? { 'fill-outline-color': render.outline } : {}),
  };
}

/** Draws one seamless map texture. The pale halo keeps its colour legible over roads and labels. */
export function fillPatternImage(colour: string, kind: PatternKind, pixels = 32): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = pixels;
  const ctx = canvas.getContext('2d')!;

  if (kind === 'dots') {
    const dot = (x: number, y: number, fill: string, radius: number) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const [x, y] of [
      [pixels / 4, pixels / 4],
      [(pixels * 3) / 4, (pixels * 3) / 4],
    ]) {
      dot(x, y, 'rgba(255,255,255,0.72)', 6);
      dot(x, y, colour, 4);
    }
    return ctx.getImageData(0, 0, pixels, pixels);
  }

  const path = () => {
    ctx.beginPath();
    if (kind === 'horizontal') {
      ctx.moveTo(0, pixels / 2);
      ctx.lineTo(pixels, pixels / 2);
    } else if (kind === 'vertical') {
      ctx.moveTo(pixels / 2, 0);
      ctx.lineTo(pixels / 2, pixels);
    } else {
      const diagonal = (reverse: boolean) => {
        for (let offset = -pixels; offset <= pixels * 2; offset += pixels) {
          ctx.moveTo(offset, 0);
          ctx.lineTo(reverse ? offset - pixels : offset + pixels, pixels);
        }
      };
      diagonal(kind === 'reverse-diagonal');
      if (kind === 'crosshatch') diagonal(true);
    }
  };

  const stroke = (style: string, width: number) => {
    path();
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  stroke('rgba(255,255,255,0.72)', 6);
  stroke(colour, 3);
  return ctx.getImageData(0, 0, pixels, pixels);
}

/** CSS equivalent of the map texture, used by patterned legends. */
export function patternCss(kind: PatternKind, colour: string): string {
  switch (kind) {
    case 'dots':
      return `radial-gradient(circle, ${colour} 0 2px, transparent 2.3px)`;
    case 'horizontal':
      return `repeating-linear-gradient(0deg, transparent 0 4px, ${colour} 4px 6px)`;
    case 'vertical':
      return `repeating-linear-gradient(90deg, transparent 0 4px, ${colour} 4px 6px)`;
    case 'reverse-diagonal':
      return `repeating-linear-gradient(135deg, transparent 0 5px, ${colour} 5px 7px)`;
    case 'crosshatch':
      return `repeating-linear-gradient(45deg, transparent 0 5px, ${colour} 5px 7px), repeating-linear-gradient(135deg, transparent 0 5px, ${colour} 5px 7px)`;
    default:
      return `repeating-linear-gradient(45deg, transparent 0 5px, ${colour} 5px 7px)`;
  }
}

export function buildPaint(render: Render): Record<string, unknown> {
  const colour = scaleToExpression(render.colour, '#7aa2f7');
  const opacity = render.opacity;

  switch (render.type) {
    case 'circle':
      return {
        'circle-color': colour,
        /* Circles grow with zoom when the layer says nothing about size. That default
           cannot be the fallback for a scale, though: it would end up nested inside a
           `match` arm, and MapLibre rejects a zoom expression anywhere but the top. */
        'circle-radius':
          render.radius === undefined
            ? ['interpolate', ['linear'], ['zoom'], 4, 3, 12, 9]
            : scaleToExpression(render.radius, 6),
        'circle-opacity': opacity ?? 0.9,
        'circle-stroke-width': render.strokeWidth ?? 1,
        'circle-stroke-color': render.strokeColour ?? 'rgba(0,0,0,0.5)',
      };
    case 'fill':
      return {
        'fill-color': colour,
        'fill-opacity': opacity ?? 0.7,
        ...(render.outline ? { 'fill-outline-color': render.outline } : {}),
      };
    case 'line':
      return {
        'line-color': colour,
        'line-width': scaleToExpression(render.width, 2),
        'line-opacity': opacity ?? 0.9,
      };
    case 'heatmap':
      return {
        'heatmap-weight': scaleToExpression(render.weight, 1),
        'heatmap-radius': scaleToExpression(render.radius, 24),
        'heatmap-opacity': opacity ?? 0.8,
        ...(render.heatmapColour ? { 'heatmap-color': render.heatmapColour } : {}),
      };
    case 'symbol':
      return render.icon || render.icons
        ? {
            'icon-opacity': opacity ?? 1,
            ...(render.offset ? { 'icon-translate': render.offset } : {}),
          }
        : {
            'text-color': colour,
            'text-halo-color': render.haloColour ?? 'rgba(0,0,0,0.7)',
            'text-halo-width': 1.2,
            ...(render.offset ? { 'text-translate': render.offset } : {}),
          };
  }
}

/** Emoji are drawn to a canvas this many pixels across, then scaled by `icon-size`. */
const ICON_PIXELS = 32;

export function buildLayout(render: Render, imageId?: string): Record<string, unknown> | undefined {
  if (render.type !== 'symbol') return undefined;

  if (render.icon || render.icons) {
    const iconImage = render.icons
      ? [
          'match',
          ['get', render.icons.property],
          ...Object.keys(render.icons.images).flatMap((key) => [key, `${imageId}-${key}`]),
          '',
        ]
      : imageId;
    return {
      'icon-image': iconImage,
      // `size` is given in pixels, but icon-size is a multiplier of the drawn image.
      'icon-size': ['/', scaleToExpression(render.size, 22), ICON_PIXELS],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    };
  }

  return {
    'text-field': ['get', render.label ?? 'name'],
    'text-size': render.textSize ?? 12,
    'text-offset': [0, 1.1],
    'text-anchor': 'top',
    'text-font': render.font ?? ['Noto Sans Regular'],
  };
}

/** Draws an emoji into an image the map can use as a marker. */
export function emojiImage(emoji: string, pixels = ICON_PIXELS * 2): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = pixels;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${Math.round(pixels * 0.82)}px system-ui, "Apple Color Emoji", "Noto Color Emoji"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, pixels / 2, pixels / 2);
  return ctx.getImageData(0, 0, pixels, pixels);
}

/** The size scale of an icon layer, for a legend that shows the marker itself. */
export function sizeScale(render: Render | undefined): ScaleObject | null {
  if (render?.type !== 'symbol' || !render.icon) return null;
  return isScaleObject(render.size) ? render.size : null;
}

/** The colour scale as a plain object, or null when it cannot drive a legend. */
export function colourScale(render: Render | undefined): ScaleObject | null {
  return isScaleObject(render?.colour) ? render.colour : null;
}

export const scaleRange = (scale: ScaleObject): [number, number] => [
  scale.stops[0][0] as number,
  scale.stops[scale.stops.length - 1][0] as number,
];

/** Legend swatches, derived from the colour scale so a layer never needs its own legend. */
export function legendEntries(render: Render | undefined): { colour: string; label: string }[] {
  const scale = colourScale(render);
  if (!scale) return [];
  const format = scale.format ?? String;
  return scale.stops.map(([value, colour]) => ({ colour: colour as string, label: format(value) }));
}

/** The colour scale as a CSS gradient, for a continuous legend bar. */
export function gradientCss(scale: ScaleObject): string {
  const [min, max] = scaleRange(scale);
  const span = max - min || 1;
  const steps = scale.stops.map(
    ([value, colour]) => `${colour} ${((((value as number) - min) / span) * 100).toFixed(1)}%`,
  );
  return `linear-gradient(90deg, ${steps.join(', ')})`;
}

/** The colour a value takes on the scale. Used to tint benchmark markers. */
export function sampleColour(scale: ScaleObject, value: number): string {
  const stops = scale.stops as [number, string][];
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];

  const i = stops.findIndex(([stop]) => stop > value);
  const [lowValue, lowColour] = stops[i - 1];
  const [highValue, highColour] = stops[i];
  const t = (value - lowValue) / (highValue - lowValue);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const [lr, lg, lb] = rgb(lowColour);
  const [hr, hg, hb] = rgb(highColour);
  return `rgb(${mix(lr, hr)}, ${mix(lg, hg)}, ${mix(lb, hb)})`;
}

const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * A value put in terms of the closest familiar place, e.g. "1.4× Derry".
 * Closest is measured by ratio, so it works across the whole range of a scale.
 */
export function compareToBenchmark(value: number, benchmarks: Benchmark[] = []): string | null {
  if (!benchmarks.length || !Number.isFinite(value) || value <= 0) return null;

  const nearest = benchmarks.reduce((best, b) =>
    Math.abs(Math.log(value / b.value)) < Math.abs(Math.log(value / best.value)) ? b : best,
  );
  const ratio = value / nearest.value;

  if (ratio > 0.9 && ratio < 1.1) return `about the same as ${nearest.label}`;
  if (ratio >= 1.1) return `${ratio.toFixed(1)}× ${nearest.label}`;
  return `${(1 / ratio).toFixed(1)}× less than ${nearest.label}`;
}
