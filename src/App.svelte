<script lang="ts">
  import type * as maplibregl from 'maplibre-gl';
  import { MapLibre, NavigationControl, ScaleControl, Hash } from 'svelte-maplibre-gl';
  import { layers } from './lib/layers.ts';
  import { STYLE_URL, IBERIA } from './lib/basemaps.ts';
  import { ui } from './lib/state.svelte.ts';
  import LayerPanel from './components/LayerPanel.svelte';
  import DataLayer from './components/DataLayer.svelte';

  let map = $state<maplibregl.Map | undefined>();
  let mapError = $state<string | null>(null);
  const combineFills = $derived(
    layers.filter((def) => ui.enabled[def.id] && def.render?.type === 'fill').length > 1,
  );

  /* MapLibre rejects a bad paint or layout by throwing an error event and drawing
     nothing. Without this, a broken layer looks exactly like an empty one. */
  function onerror(event: maplibregl.ErrorEvent) {
    const message = event.error?.message ?? 'unknown map error';
    if (/AJAXError|Failed to fetch|NetworkError/i.test(message)) return; // a tile hiccup
    mapError = message;
    console.error(event.error);
  }
  $effect(() => {
    if (import.meta.env.DEV) window.__map = map;
  });
</script>

<div class="map-frame">
<MapLibre
  bind:map
  class="map"
  autoloadGlobalCss={false}
  style={STYLE_URL}
  center={IBERIA.center}
  zoom={IBERIA.zoom}
  maxZoom={14}
  attributionControl={{ compact: true }}
  {onerror}
>
  <Hash />
  <NavigationControl position="top-right" showCompass={false} />
  <ScaleControl position="bottom-right" />

  {#each layers as def (def.id)}
    {#if ui.enabled[def.id]}
      {@const Custom = def.component}
      {#if Custom}
        <Custom {def} />
      {:else}
        <DataLayer {def} {combineFills} />
      {/if}
    {/if}
  {/each}
</MapLibre>
</div>

{#if mapError}
  <p class="note map-error">
    Map error: {mapError}
    <button onclick={() => (mapError = null)} aria-label="Dismiss">×</button>
  </p>
{/if}

<LayerPanel />

<style>
  /* The map fills a sized parent. Setting its own position here would lose to
     maplibre-gl.css, which loads later and collapses the container to zero. */
  .map-frame {
    position: absolute;
    inset: 0;
  }

  :global(.map) {
    width: 100%;
    height: 100%;
  }

  .map-error {
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
  }

  .map-error button {
    margin-left: 8px;
    border: 0;
    background: none;
    color: inherit;
    font-size: 14px;
    cursor: pointer;
  }
</style>
