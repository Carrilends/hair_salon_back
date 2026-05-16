import { SectionMapping } from './shared-types';

// UUIDs reales (ver tags-snapshot.json).
const ROOT_CABELLO = 'ead486e4-d86e-4481-954c-4b2eb5915be2';
const HOMBRE = '47b511ec-2288-4a83-aa51-947d81ecc29b';
const NINOS = '5330410b-7132-4267-a5d9-c9f42fe3725b';
const UNISEX = 'b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57';
const DEGRADADO = '1a27aaf9-6a96-4f1d-9e7c-460d96c06879';
const URBANO = 'efc608be-52fe-4465-9684-e826872847af';
const CLASICO_BARBERIA = '40f0c389-dd02-4d42-8cb0-d717312a0899';
const CORTES_CLASICOS = 'fb2460ea-0400-44d5-a0dc-13275cf33462';
const TRENZAS = '498a3058-5e74-4e14-b678-214fb63517ad';
const TRENZAS_CLASICAS = '7a72ef5b-62a6-45be-9645-8bfa9a21787b';

// Placeholders 'NEW:<nombre>' — el runner los resolverá tras insertar NEW_TAGS.
const NEW_AFRO = 'NEW:Cabello afro/rizado';
const NEW_ALTERNATIVO = 'NEW:Alternativo';
const NEW_LARGO = 'NEW:Cabello largo';

export const mapping: SectionMapping = {
  sectionKey: 'Cortes_hombre_nino',
  serviceType: 'hair-men',
  priceRange: { min: 15000, max: 60000 },
  durationRange: { min: 30, max: 75 },
  rootTagUuids: [ROOT_CABELLO],
  fallbackGenderTagUuid: HOMBRE,
  kidsTagUuids: [NINOS],
  tagMap: {
    // Étnicos (omitidos — decisión #7)
    Adulto: [],
    Afrolatina: [],
    'Afrolatina/Negra': [],
    Asiática: [],
    'Asiática/Universal': [],
    Caucásica: [],
    'Caucásica/Asiática': [],
    'Caucásica/Latina': [],
    Latina: [],
    'Latina/Negra': [],
    Negra: [],
    'Negra/Afrolatina': [],

    // Estilísticos / estructurales
    'Fade/Degradado': [DEGRADADO],
    Clásico: [CORTES_CLASICOS, CLASICO_BARBERIA],
    Moderno: [URBANO],
    'Latino/Urbano': [URBANO],
    'Asiático/K-style': [URBANO],
    Alternativo: [NEW_ALTERNATIVO],
    'Afro/Rizado': [NEW_AFRO],
    'Cabello largo': [NEW_LARGO],
    'Trenzas/Culturales': [TRENZAS, TRENZAS_CLASICAS],

    // Género
    Universal: [UNISEX],
    Niño: [NINOS],
    Niños: [NINOS],
  },
  // No hay overrides puntuales — los rangos generan precios/duración razonables para todos.
  perServiceOverrides: {},
};

export default mapping;
