import type { Layer } from '../../lib/types.ts';
import { flagPopup, flagRender } from '../_nationality.ts';

export default {
  id: 'who-spanish',
  name: '🇪🇸 Spanish',
  description: 'Where Spanish holidaymakers go',
  group: 'Who goes where',
  order: 13,
  defaultOn: false,

  source: '/data/resorts.geojson',
  attribution: 'Hand-compiled, deliberately opinionated',

  render: flagRender('spanish', '🇪🇸', [9, 9]),
  popup: flagPopup('spanish', 'Spanish'),
} satisfies Layer;
