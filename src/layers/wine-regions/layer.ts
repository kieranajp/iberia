import type { Layer } from '../../lib/types.ts';

export default {
  id: 'wine-regions',
  name: '🍷 Wine regions',
  description: 'Spain’s 72 DO/DOCa and Portugal’s 12 mainland wine regions',
  group: 'Food & drink',
  order: 30,

  source: '/data/wine-regions.geojson',
  attribution:
    '© <a href="https://www.mapa.gob.es/es/cartografia-y-sig/ide/descargas/alimentacion/vinos">Ministerio de Agricultura, Pesca y Alimentación (MAPA)</a>; <a href="https://www.ivv.gov.pt/np4/785/%7B%24clientServletPath%7D/?fileName=Regi_es_Vitivin_colas_09_12_2024.pdf&newsId=10171">Instituto da Vinha e do Vinho (IVV)</a>; <a href="https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/local-administrative-units">Eurostat GISCO</a>',

  render: {
    type: 'fill',
    under: 'labels',
    opacity: 0.32,
    colour: {
      property: 'category',
      stops: [
        ['DOCa', '#7a1224'],
        ['DO', '#c2536a'],
        ['Portuguese wine region', '#b7833e'],
      ],
      mode: 'match',
      format: (v: string) =>
        ({
          DOCa: 'Denominación de Origen Calificada',
          DO: 'Denominación de Origen',
          'Portuguese wine region': 'Região vitivinícola (Portugal)',
        })[v] ?? v,
    },
    outline: 'rgba(92, 14, 39, 0.75)',
  },

  popup: {
    title: 'name',
    fields: [
      { key: 'category', label: 'Category' },
      { key: 'country', label: 'Country' },
      { key: 'comunidad', label: 'Region', format: (v) => (v === 'Portugal' ? 'Mainland' : v) },
      { key: 'boundary', label: 'Boundary' },
      { key: 'note', label: '' },
    ],
  },
} satisfies Layer;
