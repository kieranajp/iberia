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

  /* Groups holding something switched on stay open, until the reader says otherwise. */
  const isOpen = (group: string, defs: Layer[]) => opened[group] ?? (Boolean(query) || activeCount(defs) > 0);
</script>

<aside class:collapsed={!ui.panelOpen}>
  <header>
    {#if ui.panelOpen}<h1>Iberia</h1>{/if}
    <button class="icon" onclick={() => (ui.panelOpen = !ui.panelOpen)} aria-label="Toggle panel">
      {ui.panelOpen ? '×' : '☰'}
    </button>
  </header>

  {#if ui.panelOpen}
    {#if searchable}
      <input type="search" placeholder="Find a layer" bind:value={query} />
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
  {/if}
</aside>

<style>
  aside {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 1;
    width: 300px;
    max-height: calc(100% - 24px);
    overflow-y: auto;
    padding: 10px 14px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    backdrop-filter: blur(8px);
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.4);
  }

  aside.collapsed {
    width: auto;
    padding: 6px 10px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  h1 {
    margin: 0;
    font-size: 15px;
    letter-spacing: 0.03em;
  }

  .icon {
    border: 0;
    padding: 2px 4px;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 16px;
    cursor: pointer;
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
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    cursor: pointer;
  }

  .count {
    padding: 0 5px;
    border-radius: 8px;
    background: var(--accent);
    color: #10131a;
    font-size: 10px;
    letter-spacing: 0;
  }

  label {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 4px 0 2px;
    cursor: pointer;
  }

  label em {
    display: block;
    font-size: 11px;
    font-style: normal;
    color: var(--muted);
  }

  input[type='checkbox'] {
    accent-color: var(--accent);
  }

  .empty {
    margin: 10px 0 4px;
    font-size: 12px;
    color: var(--muted);
  }
</style>
