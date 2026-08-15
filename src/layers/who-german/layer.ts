import type { Layer } from '../../lib/types.ts';
import { flagPopup, flagRender } from '../_nationality.ts';

export default {
  id: 'who-german',
  name: '🇩🇪 German',
  description: 'Where German tourists go',
  group: 'Who goes where',
  order: 11,
  defaultOn: false,

  source: '/data/resorts.geojson',
  attribution: 'Hand-compiled, deliberately opinionated',

  render: flagRender('german', '🇩🇪', [9, -9]),
  popup: flagPopup('german', 'German'),
} satisfies Layer;
