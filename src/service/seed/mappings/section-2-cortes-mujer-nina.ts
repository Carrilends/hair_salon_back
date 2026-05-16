import { SectionMapping } from './shared-types';

// UUIDs reales (ver tags-snapshot.json).
const ROOT_CABELLO = 'ead486e4-d86e-4481-954c-4b2eb5915be2';
const MUJER = '9d53d0d4-225d-4e2d-b8c1-636e8252986f';
const NINOS = '5330410b-7132-4267-a5d9-c9f42fe3725b';
const UNISEX = 'b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57';
const CEPILLADOS_BRUSHING = '8797fc27-5ad8-4c6a-a78a-192812f235e4';
const ALISADOS = 'cd8e90af-faec-46b7-bff2-a346a4ea5266';
const CORTES_CLASICOS = 'fb2460ea-0400-44d5-a0dc-13275cf33462';
const PEINADOS = '9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed';
const TRENZAS = '498a3058-5e74-4e14-b678-214fb63517ad';

export const mapping: SectionMapping = {
  sectionKey: 'cortes_mujer_niña',
  serviceType: 'hair-women',
  priceRange: { min: 25000, max: 90000 },
  durationRange: { min: 30, max: 120 },
  rootTagUuids: [ROOT_CABELLO],
  fallbackGenderTagUuid: MUJER,
  kidsTagUuids: [NINOS],
  tagMap: {
    // Étnicos (omitidos — decisión #7)
    'Asiática/Universal': [],
    'Caucásica/Latina': [],
    'Latina/Afrolatina': [],
    'Latina/Universal': [],
    'Negra/Afrolatina': [],

    // Estilísticos / estructurales
    'Cortes mujer': [CORTES_CLASICOS],
    'Alisados/Brushing': [CEPILLADOS_BRUSHING, ALISADOS],
    Peinados: [PEINADOS],
    Trenzas: [TRENZAS],

    // Género
    Adulta: [MUJER],
    Universal: [UNISEX],
    Niña: [NINOS],
  },
  // No hay overrides puntuales — los rangos generan precios/duración razonables para todos.
  perServiceOverrides: {},
};

export default mapping;
