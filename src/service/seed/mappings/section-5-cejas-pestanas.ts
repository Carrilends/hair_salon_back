import { SectionMapping } from './shared-types';

// UUIDs reales (ver tags-snapshot.json).
const ROOT_CEJAS_PESTANAS = '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83';
const MUJER = '9d53d0d4-225d-4e2d-b8c1-636e8252986f';
const NINOS = '5330410b-7132-4267-a5d9-c9f42fe3725b';
const UNISEX = 'b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57';
const DISENO_CEJAS = 'f03abf42-10e2-4f96-ac84-d8ec4f017a7e';
const TINTE_CEJAS = '16fc1249-0601-40a0-93dd-1b5f87b6e599';
const HENNA_BROWS = 'be1f0d24-7859-4a39-bee6-f247ebbd2eb4';
const PERFILADO = '838d35cf-3c95-467a-83a2-fc2bad4cd91a';
const LIFTING_PESTANAS = '68b3fcbd-4398-4489-8bd8-c59b336d5d46';
const EXTENSIONES_PESTANAS = '3ff10831-b2f4-4731-aa18-3cf1154808cd';
const TINTE_PESTANAS = '91742a87-7eeb-41a8-b6da-1c82a284d3da';

// Placeholders 'NEW:<nombre>' — el runner los resolverá tras insertar NEW_TAGS.
// Decisión #10: independientes del bloque de tinturas, propios de cejas/pestañas.
const NEW_COBERTURA_CANAS = 'NEW:Cobertura canas';
const NEW_COLOR_NATURAL = 'NEW:Color natural';

export const mapping: SectionMapping = {
  sectionKey: 'cejas_pestanas',
  serviceType: 'brows-lashes',
  priceRange: { min: 10000, max: 90000 },
  durationRange: { min: 15, max: 75 },
  rootTagUuids: [ROOT_CEJAS_PESTANAS],
  fallbackGenderTagUuid: MUJER,
  kidsTagUuids: [NINOS],
  tagMap: {
    // Descriptivos (omitidos)
    Clásico: [],
    Natural: [],
    Combinado: [],
    Híbrido: [],
    Personalizado: [],
    Especializado: [],
    Mantenimiento: [],
    Tratamiento: [],
    Express: [],

    // Cejas
    'Diseño cejas': [DISENO_CEJAS],
    'Tinte cejas': [TINTE_CEJAS],
    'Henna brows': [HENNA_BROWS],
    Cera: [PERFILADO],
    Hilo: [PERFILADO],
    Pinza: [PERFILADO],
    Perfilado: [PERFILADO],

    // Pestañas
    'Lifting pestañas': [LIFTING_PESTANAS],
    Semipermanente: [LIFTING_PESTANAS],
    Extensiones: [EXTENSIONES_PESTANAS],
    Volumen: [EXTENSIONES_PESTANAS],
    'Tinte pestañas': [TINTE_PESTANAS],

    // Tags propios de cejas/pestañas (decisión #10)
    'Cobertura canas': [NEW_COBERTURA_CANAS],
    'Color natural': [NEW_COLOR_NATURAL],

    // Género
    Mujer: [MUJER],
    Unisex: [UNISEX],
  },
  perServiceOverrides: {},
};

export default mapping;
