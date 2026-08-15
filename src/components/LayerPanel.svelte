<script lang="ts">
  import { layers, groups } from '../lib/layers.ts';
  import { ui } from '../lib/state.svelte.ts';
  import type { Layer } from '../lib/types.ts';
  import Legend from './Legend.svelte';

  let query = $state('');
  const opened = $state<Record<string, boolean>>({});

  const searchable = layers.length > 8;

  const matches = $derived.by<Record<string, Layer[]>>(() => {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return groups;

    const found: Record<string, Layer[]> = {};
    for (const [group, defs] of Object.entries(groups)) {
      const hits = defs.filter((def) =>
        `${def.name} ${def.description ?? ''} ${group}`.toLowerCase().includes(wanted),
      );
      if (hits.length) found[group] = hits;
    }
    return found;
  });

  const activeCount = (defs: Layer[]) => defs.filter((d) => ui.enabled[d.id]).length;
  const enabledCount = $derived(layers.filter((def) => ui.enabled[def.id]).length);

  /* Groups holding something switched on stay open, until the reader says otherwise. */
  const isOpen = (group: string, defs: Layer[]) => opened[group] ?? (Boolean(query) || activeCount(defs) > 0);
</script>

<aside class:collapsed={!ui.panelOpen} aria-label="Map layers">
  <header>
    {#if ui.panelOpen}
      <div class="heading">
        <h1>Iberia</h1>
        <span>Map layers</span>
      </div>
    {/if}
    <button
      class="icon"
      type="button"
      onclick={() => (ui.panelOpen = !ui.panelOpen)}
      aria-expanded={ui.panelOpen}
      aria-controls="layer-panel-content"
      aria-label={ui.panelOpen ? 'Close layers' : `Open layers (${enabledCount} active)`}
    >
      {#if ui.panelOpen}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 9 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M4 17l8 4 8-4" />
        </svg>
        <span class="button-label">Layers</span>
        {#if enabledCount}<span class="button-count" aria-hidden="true">{enabledCount}</span>{/if}
      {/if}
    </button>
  </header>

  {#if ui.panelOpen}
    <div class="panel-content" id="layer-panel-content">
      {#if searchable}
        <input type="search" aria-label="Find a layer" placeholder="Find a layer" bind:value={query} />
      {/if}

      {#each Object.entries(matches) as [group, defs] (group)}
        <details
          open={isOpen(group, defs)}
          ontoggle={(e) => (opened[group] = (e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary>
            {group}
            {#if activeCount(defs)}<span class="count">{activeCount(defs)}</span>{/if}
          </summary>

          {#each defs as def (def.id)}
            <label>
              <input type="checkbox" bind:checked={ui.enabled[def.id]} />
              <span>
                {def.name}
                {#if def.description}<em>{def.description}</em>{/if}
              </span>
            </label>
            {#if ui.enabled[def.id]}<Legend {def} />{/if}
          {/each}
        </details>
      {:else}
        <p class="empty">Nothing matches “{query}”.</p>
      {/each}
    </div>
  {/if}
</aside>

<style>
  aside {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 300px;
    max-height: calc(100% - 24px);
    overflow: hidden;
    padding: 10px 14px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    backdrop-filter: blur(8px);
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.4);
  }

  aside.collapsed {
    width: auto;
    padding: 0;
    border-radius: 999px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex: 0 0 auto;
  }

  .heading {
    display: flex;
    align-items: baseline;
    gap: 7px;
  }

  h1 {
    margin: 0;
    font-size: 15px;
    letter-spacing: 0.03em;
  }

  .heading span {
    color: var(--muted);
    font-size: 11px;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 40px;
    min-height: 40px;
    border: 0;
    padding: 8px;
    background: none;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }

  .icon:hover,
  .icon:focus-visible {
    color: var(--fg);
  }

  .icon:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -4px;
    border-radius: 999px;
  }

  .icon svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
  }

  .button-label {
    display: none;
    font-weight: 650;
  }

  .button-count,
  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--accent);
    color: #10131a;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0;
  }

  .button-count {
    display: none;
  }

  .panel-content {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  input[type='search'] {
    width: 100%;
    margin: 8px 0 2px;
    padding: 5px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: none;
    color: var(--fg);
    font: inherit;
    font-size: 12px;
  }

  details {
    border-top: 1px solid var(--line);
    padding: 6px 0 2px;
  }

  summary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    cursor: pointer;
  }

  summary::after {
    content: '+';
    margin-left: auto;
    font-size: 15px;
    line-height: 1;
  }

  details[open] summary::after {
    content: '\2212';
  }

  label {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    min-height: 36px;
    padding: 6px 0 4px;
    cursor: pointer;
  }

  label em {
    display: block;
    font-size: 11px;
    font-style: normal;
    color: var(--muted);
  }

  input[type='checkbox'] {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    margin: 2px 0 0;
    accent-color: var(--accent);
  }

  .empty {
    margin: 10px 0 4px;
    font-size: 12px;
    color: var(--muted);
  }

  @media (max-width: 600px) {
    aside {
      top: auto;
      right: max(8px, env(safe-area-inset-right));
      bottom: max(8px, env(safe-area-inset-bottom));
      left: max(8px, env(safe-area-inset-left));
      width: auto;
      max-height: 72vh;
      max-height: min(72dvh, 620px);
      padding: 10px 16px 14px;
      border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
      border-radius: 18px;
      background: color-mix(in srgb, var(--panel) 96%, transparent);
      box-shadow: 0 10px 36px rgb(0 0 0 / 0.52);
    }

    aside.collapsed {
      right: auto;
      max-height: none;
      padding: 0;
    }

    header {
      min-height: 44px;
    }

    .heading {
      align-items: center;
    }

    h1 {
      font-size: 17px;
    }

    .heading span {
      font-size: 12px;
    }

    .icon {
      min-width: 48px;
      min-height: 48px;
      padding: 12px;
    }

    .collapsed .icon {
      width: auto;
      padding: 0 16px;
      color: var(--fg);
    }

    .collapsed .button-label,
    .collapsed .button-count {
      display: inline-flex;
    }

    .panel-content {
      margin-right: -6px;
      padding-right: 6px;
    }

    input[type='search'] {
      height: 44px;
      margin: 8px 0 4px;
      padding: 9px 12px;
      border-radius: 9px;
      font-size: 16px;
    }

    details {
      padding: 4px 0 2px;
    }

    summary {
      min-height: 44px;
      font-size: 11px;
    }

    label {
      min-height: 48px;
      padding: 9px 0 7px;
      font-size: 15px;
      line-height: 1.25;
    }

    label em {
      margin-top: 2px;
      font-size: 12px;
      line-height: 1.35;
    }

    input[type='checkbox'] {
      width: 20px;
      height: 20px;
      margin-top: 0;
    }
  }

  @media (max-width: 600px) and (max-height: 500px) {
    aside {
      max-height: calc(100dvh - 16px - env(safe-area-inset-bottom));
    }
  }
</style>
