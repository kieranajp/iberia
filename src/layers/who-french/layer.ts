import type { Layer } from '../../lib/types.ts';
import { flagPopup, flagRender } from '../_nationality.ts';

export default {
  id: 'who-french',
  name: '🇫🇷 French',
  description: 'Where French tourists go',
  group: 'Who goes where',
  order: 12,
  defaultOn: false,

  source: '/data/resorts.geojson',
  attribution: 'Hand-compiled, deliberately opinionated',

  render: flagRender('french', '🇫🇷', [-9, 9]),
  popup: flagPopup('french', 'French'),
} satisfies Layer;
