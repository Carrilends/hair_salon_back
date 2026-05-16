import { SectionMapping } from './shared-types';

// UUIDs reales (ver tags-snapshot.json).
const ROOT_MAQUILLAJES = 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f';
const MUJER = '9d53d0d4-225d-4e2d-b8c1-636e8252986f';
const NINOS = '5330410b-7132-4267-a5d9-c9f42fe3725b';
const UNISEX = 'b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57';
const DIA_NATURAL = '6187cc84-58b8-4026-bd65-d6852c7330b6';
const NOCHE = '793936a3-d476-4f95-9326-8e70609cec2e';
const NOVIA = '7b9e9d6d-573d-489c-a80c-73c9354f0f80';
const DE_FIESTA = 'cd3876c6-b101-4c10-ae09-113ed6e61a83';
const SOCIAL_FOTOGRAFICO = '9f662cf5-f238-47d6-8309-adc984a3133e';
const QUINCEANERA = '8b150197-e995-412a-89a8-399508ba29c0';

// Placeholders 'NEW:<nombre>' — el runner los resolverá tras insertar NEW_TAGS.
const NEW_CARACTERIZACION = 'NEW:Caracterización';
const NEW_CORRECTIVO = 'NEW:Correctivo';

export const mapping: SectionMapping = {
  sectionKey: 'maquillaje',
  serviceType: 'makeup',
  priceRange: { min: 40000, max: 150000 },
  durationRange: { min: 45, max: 120 },
  rootTagUuids: [ROOT_MAQUILLAJES],
  fallbackGenderTagUuid: MUJER,
  kidsTagUuids: [NINOS],
  tagMap: {
    // Genérico (raíz Maquillajes ya se añade por defecto)
    Maquillaje: [],

    // Estilísticos / estructurales
    Caracterización: [NEW_CARACTERIZACION],
    Correctivo: [NEW_CORRECTIVO],
    'Día/natural': [DIA_NATURAL],
    Fiesta: [DE_FIESTA],
    Fotográfico: [SOCIAL_FOTOGRAFICO],
    Noche: [NOCHE],
    Novia: [NOVIA],
    Quinceañera: [QUINCEANERA],
    'Social/Fotográfico': [SOCIAL_FOTOGRAFICO],

    // Género
    Mujer: [MUJER],
    Niña: [NINOS],
    Unisex: [UNISEX],
  },
  perServiceOverrides: {},
};

export default mapping;
