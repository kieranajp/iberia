import type { Layer } from '../../lib/types.ts';
import { flagPopup, flagRender } from '../_nationality.ts';

export default {
  id: 'who-british',
  name: '🇬🇧 British',
  description: 'Where British tourists go',
  group: 'Who goes where',
  order: 10,
  defaultOn: true,

  source: '/data/resorts.geojson',
  attribution: 'Hand-compiled, deliberately opinionated',

  render: flagRender('british', '🇬🇧', [-9, -9]),
  popup: flagPopup('british', 'British'),
} satisfies Layer;
