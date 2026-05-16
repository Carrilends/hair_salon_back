import { NewTagSpec } from './shared-types';

export const NEW_TAGS: NewTagSpec[] = [
  // Sección 1 — Cortes_hombre_nino
  { name: 'Cabello afro/rizado', parentId: 'ead486e4-d86e-4481-954c-4b2eb5915be2' },
  { name: 'Alternativo', parentId: '83c6a558-805c-4156-94f6-fa7ea55c7d84' },
  { name: 'Cabello largo', parentId: 'ead486e4-d86e-4481-954c-4b2eb5915be2' },

  // Sección 3 — uñas (parent: Uñas)
  { name: 'Express', parentId: '517d44ba-ff4c-4077-b99a-1ca8021fa21a' },
  { name: 'Spa', parentId: '517d44ba-ff4c-4077-b99a-1ca8021fa21a' },

  // Sección 4 — maquillaje (parent: Maquillajes)
  { name: 'Caracterización', parentId: 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f' },
  { name: 'Correctivo', parentId: 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f' },

  // Sección 5 — cejas_pestanas (parent: Cejas y pestañas, decisión #10)
  { name: 'Cobertura canas', parentId: '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83' },
  { name: 'Color natural', parentId: '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83' },

  // Sección 6 — tinturas (parent: Tintes)
  { name: 'Cobertura de canas', parentId: '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7' },
];
