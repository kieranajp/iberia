<script lang="ts">
  import {
    legendEntries,
    gradientCss,
    sampleColour,
    scaleRange,
    colourScale,
    sizeScale,
  } from '../lib/paint.ts';
  import type { Layer } from '../lib/types.ts';

  let { def }: { def: Layer } = $props();

  const scale = $derived(colourScale(def.render));
  const continuous = $derived(scale && (scale.mode ?? 'interpolate') === 'interpolate' ? scale : null);
  const swatches = $derived(continuous ? [] : legendEntries(def.render));

  const format = $derived(continuous?.format ?? ((v: number) => v.toLocaleString('en-GB')));
  const range = $derived(continuous ? scaleRange(continuous) : [0, 0]);

  /* Benchmarks outside the data range pin to the end of the bar; their printed
     value keeps them honest. */
  const marks = $derived(
    continuous
      ? (def.benchmarks ?? []).map((b) => {
          const [min, max] = range;
          const position = ((b.value - min) / (max - min)) * 100;
          return {
            ...b,
            position: Math.min(100, Math.max(0, position)),
            outside: b.value < min || b.value > max,
            colour: sampleColour(continuous, b.value),
          };
        })
      : [],
  );

  /* Icon layers encode by size alone, so the legend shows the marker growing. */
  const icon = $derived(def.render?.type === 'symbol' ? def.render.icon : undefined);
  const sizes = $derived.by(() => {
    const scale = sizeScale(def.render);
    if (!scale || !icon) return [];
    const [low, high] = scale.stops as [number, number][];
    const label = scale.format ?? String;
    const steps = Math.min(6, high[0] - low[0] + 1);
    return Array.from({ length: steps }, (_, i) => {
      const value = low[0] + i;
      const t = (value - low[0]) / (high[0] - low[0] || 1);
      return { value, px: Math.round(low[1] + (high[1] - low[1]) * t), label: label(value) };
    });
  });
</script>

{#if sizes.length}
  <ul class="sizes">
    {#each sizes as size}
      <li style:font-size="{size.px}px" title="{size.label}">{icon}</li>
    {/each}
  </ul>
  <div class="ends">
    <span>{sizes[0].label}</span>
    <span>{sizes[sizes.length - 1].label}</span>
  </div>
{/if}

{#if continuous}
  <div class="ramp" style:background={gradientCss(continuous)}>
    {#each marks as mark}
      <span
        class="tick"
        class:outside={mark.outside}
        style:left="{mark.position}%"
        title="{mark.label}: {mark.value} {def.unit ?? ''}"
      ></span>
    {/each}
  </div>
  <div class="ends">
    <span>{format(range[0])}</span>
    <span>{format(range[1])}{def.unit ? ` ${def.unit}` : ''}</span>
  </div>
  {#if marks.length}
    <ul class="marks">
      {#each marks as mark}
        <li>
          <span class="dot" style:background={mark.colour}></span>
          {mark.label}
          <b>{mark.value.toLocaleString('en-GB')}</b>
        </li>
      {/each}
    </ul>
  {/if}
{:else if swatches.length}
  <ul class="swatches">
    {#each swatches as entry}
      <li><span class="dot" style:background={entry.colour}></span>{entry.label}</li>
    {/each}
  </ul>
{/if}

<style>
  .ramp {
    position: relative;
    height: 8px;
    margin: 6px 0 3px 24px;
    border-radius: 2px;
  }

  .tick {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    margin-left: -1px;
    background: var(--fg);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
  }

  .tick.outside {
    opacity: 0.45;
  }

  .ends {
    display: flex;
    justify-content: space-between;
    margin-left: 24px;
    font-size: 10px;
    color: var(--muted);
  }

  .sizes {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    margin: 4px 0 2px 24px;
    padding: 0;
    list-style: none;
    line-height: 1;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    margin: 4px 0 6px 24px;
    padding: 0;
    list-style: none;
    font-size: 11px;
    color: var(--muted);
  }

  li {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  b {
    color: var(--fg);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }
</style>
