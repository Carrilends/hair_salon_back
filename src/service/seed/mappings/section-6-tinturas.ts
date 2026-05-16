import { SectionMapping } from './shared-types';

// UUIDs reales (ver tags-snapshot.json).
const ROOT_TINTES = '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7';
const MUJER = '9d53d0d4-225d-4e2d-b8c1-636e8252986f';
const NINOS = '5330410b-7132-4267-a5d9-c9f42fe3725b';
const UNISEX = 'b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57';
const COLORACION_COMPLETA = '69587d12-1124-4bfd-9b9c-1f04c657225a';
const MECHAS_BALAYAGE = '557914c0-d477-461d-b443-2e6f9ba26865';
const RETOQUE_RAIZ = '5780a1d6-dc15-47d4-a195-16c68cec22cf';
const COLOR_FANTASIA = '3f689c05-1f87-4259-9979-7f5943095e59';
const DECOLORACION = '5d9c9422-2c46-4165-9924-21674236f140';
const MATIZ_GLOSS = '2d3bca45-bce7-4a20-9a17-ca8ce15bd8a0';

// Placeholders 'NEW:<nombre>' — el runner los resolverá tras insertar NEW_TAGS.
const NEW_COBERTURA_DE_CANAS = 'NEW:Cobertura de canas';

export const mapping: SectionMapping = {
  sectionKey: 'tinturas',
  serviceType: 'tinting',
  priceRange: { min: 50000, max: 250000 },
  durationRange: { min: 60, max: 180 },
  rootTagUuids: [ROOT_TINTES],
  fallbackGenderTagUuid: MUJER,
  kidsTagUuids: [NINOS],
  tagMap: {
    // Descriptivos (omitidos)
    Avanzado: [],
    Especializado: [],
    Integral: [],
    Híbrido: [],
    'Color natural': [],
    Discreto: [],
    Cálido: [],
    Frío: [],
    Express: [],
    Mantenimiento: [],
    Tratamiento: [],

    // Estilísticos / estructurales
    Artístico: [COLOR_FANTASIA],
    Tendencia: [COLOR_FANTASIA],
    Vibrante: [COLOR_FANTASIA],
    'Color fantasía': [COLOR_FANTASIA],
    Pastel: [COLOR_FANTASIA],
    Balayage: [MECHAS_BALAYAGE],
    Mechas: [MECHAS_BALAYAGE],
    'Mechas/Balayage': [MECHAS_BALAYAGE],
    Brillo: [MATIZ_GLOSS],
    Iluminación: [MATIZ_GLOSS],
    'Matiz/Gloss': [MATIZ_GLOSS],
    Neutralizador: [MATIZ_GLOSS],
    'Coloración completa': [COLORACION_COMPLETA],
    Decoloración: [DECOLORACION],
    'Cobertura canas': [NEW_COBERTURA_DE_CANAS],
    'Retoque raíz': [RETOQUE_RAIZ],

    // Género
    Mujer: [MUJER],
    Unisex: [UNISEX],
  },
  perServiceOverrides: {},
};

export default mapping;
