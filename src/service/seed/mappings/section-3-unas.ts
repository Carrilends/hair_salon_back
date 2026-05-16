import { SectionMapping } from './shared-types';

// UUIDs reales (ver tags-snapshot.json).
const ROOT_UNAS = '517d44ba-ff4c-4077-b99a-1ca8021fa21a';
const MUJER = '9d53d0d4-225d-4e2d-b8c1-636e8252986f';
const NINOS = '5330410b-7132-4267-a5d9-c9f42fe3725b';
const UNISEX = 'b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57';
const MANICURE = '5d9fa316-db1c-4307-8ecc-839ba82df21f';
const PEDICURE = 'b28b9374-0324-4613-8fb5-3ddcfa23aa81';
const NAIL_ART = '9b702516-037c-4524-a21a-6faa71890b5f';
const ACRILICAS = 'a4162d8a-6f39-40b1-aadd-5c7c484a07ac';
const MANT_REPARACION = 'b1445426-4264-4b65-8ec0-adfc02142cd9';

// Placeholders 'NEW:<nombre>' — el runner los resolverá tras insertar NEW_TAGS.
const NEW_EXPRESS = 'NEW:Express';
const NEW_SPA = 'NEW:Spa';

export const mapping: SectionMapping = {
  sectionKey: 'uñas',
  serviceType: 'nails',
  priceRange: { min: 18000, max: 80000 },
  durationRange: { min: 30, max: 90 },
  rootTagUuids: [ROOT_UNAS],
  fallbackGenderTagUuid: MUJER,
  kidsTagUuids: [NINOS],
  tagMap: {
    // Descriptivos (omitidos)
    Avanzado: [],

    // Estilísticos / estructurales
    Clásico: [MANICURE],
    Cuidado: [MANT_REPARACION],
    Decoración: [NAIL_ART],
    Esculpidas: [ACRILICAS],
    Express: [NEW_EXPRESS],
    Manicure: [MANICURE],
    Moderno: [NAIL_ART],
    'Nail art': [NAIL_ART],
    Pedicure: [PEDICURE],
    Reparador: [MANT_REPARACION],
    Spa: [NEW_SPA],
    Tratamiento: [MANT_REPARACION],

    // Género
    Mujer: [MUJER],
    Niña: [NINOS],
    Unisex: [UNISEX],
  },
  perServiceOverrides: {},
};

export default mapping;
