<script lang="ts">
  import {
    GeoJSONSource,
    CircleLayer,
    FillLayer,
    LineLayer,
    HeatmapLayer,
    SymbolLayer,
    Popup,
    Image,
    ImageLoader,
    getMapContext,
  } from 'svelte-maplibre-gl';
  import type { FeatureCollection } from 'geojson';
  import type { LngLat, MapLayerMouseEvent } from 'maplibre-gl';
  import {
    buildPaint,
    buildLayout,
    compareToBenchmark,
    colourScale,
    emojiImage,
    buildFillPattern,
    fillPatternImage,
    patternForGroup,
  } from '../lib/paint.ts';
  import { firstLabelLayerId } from '../lib/basemaps.ts';
  import type { DataLayer } from '../lib/types.ts';

  /** Renders any layer whose `render` block is declarative. */
  let { def, combineFills = false }: { def: DataLayer; combineFills?: boolean } = $props();

  const ctx = getMapContext();
  const paint = $derived(buildPaint(def.render));
  const layerId = $derived(`${def.id}-${def.render.type}`);

  /* Emoji markers are drawn to an image, since the basemap's glyph fonts have none. */
  const icon = $derived(def.render.type === 'symbol' ? def.render.icon : undefined);
  const iconId = $derived(icon ? `${def.id}-icon` : undefined);
  const iconImage = $derived(icon ? emojiImage(icon) : undefined);
  const imageIcons = $derived(
    def.render.type === 'symbol' && def.render.icons
      ? Object.fromEntries(
          Object.entries(def.render.icons.images).map(([key, url]) => [
            `${def.id}-${key}`,
            [url, { pixelRatio: 2 }] as [string, { pixelRatio: number }],
          ]),
        )
      : null,
  );
  const layout = $derived(buildLayout(def.render, iconId ?? def.id));

  const fillPattern = $derived(
    combineFills && def.render.type === 'fill' ? buildFillPattern(def.render, def.id) : null,
  );
  const patternImages = $derived(
    fillPattern?.images.map(({ id, colour }) => ({
      id,
      image: fillPatternImage(colour, patternForGroup(def.group)),
    })) ?? [],
  );

  let selected = $state<{ lnglat: LngLat; props: Record<string, unknown> } | null>(null);
  let data = $state<FeatureCollection | null>(null);
  let error = $state<string | null>(null);

  /* Fetched here rather than handed to MapLibre as a URL, so a missing or
     malformed file shows a message instead of a layer that silently never appears. */
  $effect(() => {
    if (typeof def.source !== 'string') {
      data = def.source;
      return;
    }
    let cancelled = false;
    fetch(def.source)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        if (!res.headers.get('content-type')?.includes('json')) {
          throw new Error('no such file — the server returned a web page, not GeoJSON');
        }
        return res.json();
      })
      .then((json) => !cancelled && (data = json))
      .catch((err: Error) => !cancelled && (error = err.message));
    return () => {
      cancelled = true;
    };
  });

  const beforeId = $derived(
    def.render.under === 'labels' && ctx.map ? firstLabelLayerId(ctx.map) : undefined,
  );

  const components = {
    circle: CircleLayer,
    fill: FillLayer,
    line: LineLayer,
    heatmap: HeatmapLayer,
    symbol: SymbolLayer,
  };
  const Layer = $derived(components[def.render.type]);

  const hovers = $derived(def.popup?.trigger === 'hover');

  function show(ev: MapLayerMouseEvent) {
    const feature = ev.features?.[0];
    if (feature) selected = { lnglat: ev.lngLat, props: feature.properties ?? {} };
  }

  const onclick = (ev: MapLayerMouseEvent) => {
    if (def.popup && !hovers) show(ev);
  };
  const onmousemove = (ev: MapLayerMouseEvent) => {
    if (hovers) show(ev);
  };

  const cursor = (style: string) => () => {
    if (def.popup && ctx.map) ctx.map.getCanvas().style.cursor = style;
  };

  function onmouseleave() {
    cursor('')();
    if (hovers) selected = null;
  }

  const fields = $derived(
    selected
      ? (def.popup?.fields ?? []).map((field) => ({
          label: field.label ?? field.key,
          big: Boolean(field.big),
          value: field.format
            ? field.format(selected!.props[field.key])
            : selected!.props[field.key],
        }))
      : [],
  );

  const comparison = $derived.by(() => {
    const property = colourScale(def.render)?.property;
    if (!selected || !property) return null;
    return compareToBenchmark(Number(selected.props[property]), def.benchmarks);
  });
</script>

{#if iconImage && iconId}
  <Image id={iconId} image={iconImage} options={{ pixelRatio: 2 }} />
{/if}

{#each patternImages as pattern (pattern.id)}
  <Image id={pattern.id} image={pattern.image} options={{ pixelRatio: 2 }} />
{/each}

{#snippet dataLayer()}
  {#if data}
    <GeoJSONSource id={def.id} {data} attribution={def.attribution}>
      {#if fillPattern}
        <FillLayer
          id={layerId}
          paint={fillPattern.paint as never}
          {beforeId}
          minzoom={def.render.minzoom}
          maxzoom={def.render.maxzoom}
          filter={def.render.filter}
          {onclick}
          {onmousemove}
          onmouseenter={cursor(hovers ? 'default' : 'pointer')}
          {onmouseleave}
        />
      {:else}
        <Layer
          id={layerId}
          paint={paint as never}
          layout={layout as never}
          {beforeId}
          minzoom={def.render.minzoom}
          maxzoom={def.render.maxzoom}
          filter={def.render.filter}
          {onclick}
          {onmousemove}
          onmouseenter={cursor(hovers ? 'default' : 'pointer')}
          {onmouseleave}
        />
      {/if}
    </GeoJSONSource>
  {/if}
{/snippet}

{#if imageIcons}
  <ImageLoader images={imageIcons}>
    {@render dataLayer()}
  </ImageLoader>
{:else}
  {@render dataLayer()}
{/if}

{#if selected}
  <Popup
    lnglat={hovers ? undefined : selected.lnglat}
    trackPointer={hovers}
    closeButton={!hovers}
    closeOnClick={!hovers}
    onclose={() => (selected = null)}
    maxWidth="280px"
  >
    {#if def.popup?.title}
      <h3>{selected.props[def.popup.title]}</h3>
    {/if}
    <dl>
      {#each fields as field}
        {#if field.big && field.label}
          <dt class="big-label">{field.label}</dt>
          <dd class="big-row">{field.value ?? '—'}</dd>
        {:else if field.big}
          <dd class="big">{field.value}</dd>
        {:else}
          <dt>{field.label}</dt>
          <dd>{field.value ?? '—'}</dd>
        {/if}
      {/each}
    </dl>
    {#if comparison}
      <p class="compare">{comparison}</p>
    {/if}
  </Popup>
{/if}

{#if error}
  <p class="note data-error">{def.name}: {def.source} — {error}</p>
{/if}

<style>
  h3 {
    margin: 0 0 6px;
    font-size: 14px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  dd.big {
    grid-column: 1 / -1;
    margin: 1px 0 5px;
    font-size: 22px;
    letter-spacing: 3px;
    line-height: 1.1;
  }

  dt.big-label {
    display: flex;
    align-items: center;
    padding-right: 2px;
    color: inherit;
    font-weight: 600;
    white-space: nowrap;
  }

  dd.big-row {
    min-width: 0;
    padding: 2px 0 4px 10px;
    border-left: 1px solid var(--line);
    font-size: 20px;
    letter-spacing: 2px;
    line-height: 1.2;
  }

  .compare {
    margin: 8px 0 0;
    padding-top: 6px;
    border-top: 1px solid var(--line);
    color: var(--accent);
  }

  .data-error {
    bottom: 12px;
    left: 12px;
  }
</style>
