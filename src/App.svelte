<script lang="ts">
  import type * as maplibregl from 'maplibre-gl';
  import { MapLibre, NavigationControl, ScaleControl, Hash } from 'svelte-maplibre-gl';
  import { layers } from './lib/layers.ts';
  import { STYLE_URL, IBERIA } from './lib/basemaps.ts';
  import { ui } from './lib/state.svelte.ts';
  import LayerPanel from './components/LayerPanel.svelte';
  import DataLayer from './components/DataLayer.svelte';

  let map = $state<maplibregl.Map | undefined>();
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
        <DataLayer {def} />
      {/if}
    {/if}
  {/each}
</MapLibre>
</div>

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
</style>
