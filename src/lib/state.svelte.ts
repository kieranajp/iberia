import { layers } from './layers.ts';

const KEY = 'iberia.ui.v1';
const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');

const defaults = Object.fromEntries(layers.map((l) => [l.id, Boolean(l.defaultOn)]));

interface UiState {
  enabled: Record<string, boolean>;
  panelOpen: boolean;
}

export const ui: UiState = $state({
  enabled: { ...defaults, ...(saved.enabled ?? {}) },
  panelOpen: saved.panelOpen ?? true,
});

$effect.root(() => {
  $effect(() => {
    localStorage.setItem(KEY, JSON.stringify({ enabled: ui.enabled, panelOpen: ui.panelOpen }));
  });
});
