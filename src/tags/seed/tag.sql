INSERT INTO tag (id, name, "parentId") VALUES
  ('2432c659-381e-4152-99ae-da3946ba78f6', 'Género', NULL),
  ('ead486e4-d86e-4481-954c-4b2eb5915be2', 'Cabello', NULL),
  ('517d44ba-ff4c-4077-b99a-1ca8021fa21a', 'Uñas', NULL),
  ('d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f', 'Maquillajes', NULL),
  ('11eb3167-dce0-4d4b-92d2-0ab1c4a940a7', 'Tintes', NULL),
  ('90fd2551-7f19-4bf0-86c7-c8c09ffc5c83', 'Cejas y pestañas', NULL);
INSERT INTO tag (id, name, "parentId") VALUES
  ('5330410b-7132-4267-a5d9-c9f42fe3725b', 'Niños', '2432c659-381e-4152-99ae-da3946ba78f6'),
  ('9d53d0d4-225d-4e2d-b8c1-636e8252986f', 'Mujer', '2432c659-381e-4152-99ae-da3946ba78f6'),
  ('47b511ec-2288-4a83-aa51-947d81ecc29b', 'Hombre', '2432c659-381e-4152-99ae-da3946ba78f6'),
  ('b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57', 'Unisex', '2432c659-381e-4152-99ae-da3946ba78f6');
INSERT INTO tag (id, name, "parentId") VALUES
  ('83c6a558-805c-4156-94f6-fa7ea55c7d84', 'Cortes de barbería', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('cd8e90af-faec-46b7-bff2-a346a4ea5266', 'Alisados', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('8797fc27-5ad8-4c6a-a78a-192812f235e4', 'Cepillados y brushing', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('6788e799-77c7-4e6a-9368-72571ef8b4df', 'Aseo general', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('fb2460ea-0400-44d5-a0dc-13275cf33462', 'Cortes clásicos', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('498a3058-5e74-4e14-b678-214fb63517ad', 'Trenzas', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed', 'Peinados', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('4737bc86-f99e-4f1b-a597-28449ac599a4', 'Lavado y mascarillas', 'ead486e4-d86e-4481-954c-4b2eb5915be2'),
  ('9b654a72-9afc-4e95-a3cf-57d449ff4a35', 'Tratamientos capilares', 'ead486e4-d86e-4481-954c-4b2eb5915be2');
INSERT INTO tag (id, name, "parentId") VALUES
  ('efc608be-52fe-4465-9684-e826872847af', 'Urbano', '83c6a558-805c-4156-94f6-fa7ea55c7d84'),
  ('40f0c389-dd02-4d42-8cb0-d717312a0899', 'Clásico', '83c6a558-805c-4156-94f6-fa7ea55c7d84'),
  ('1a27aaf9-6a96-4f1d-9e7c-460d96c06879', 'Degradado', '83c6a558-805c-4156-94f6-fa7ea55c7d84'),
  ('369df7c1-8477-4b1e-8886-913137036c19', 'Skinfade', '83c6a558-805c-4156-94f6-fa7ea55c7d84');
INSERT INTO tag (id, name, "parentId") VALUES
  ('e077aff5-7a48-4ba7-a747-36fdc62c37c6', 'Keratina', 'cd8e90af-faec-46b7-bff2-a346a4ea5266'),
  ('83fb4e85-a17c-4203-a6de-2cebe4e9a0d2', 'Botox capilar', 'cd8e90af-faec-46b7-bff2-a346a4ea5266'),
  ('9a2b7a5b-d0fa-4bc2-aa7f-bfe2fd26ce78', 'Progresivo', 'cd8e90af-faec-46b7-bff2-a346a4ea5266');
INSERT INTO tag (id, name, "parentId") VALUES
  ('98fb72a0-e0f0-4f92-ba5c-bfc8a863f96e', 'Box braids', '498a3058-5e74-4e14-b678-214fb63517ad'),
  ('7a72ef5b-62a6-45be-9645-8bfa9a21787b', 'Trenzas clásicas', '498a3058-5e74-4e14-b678-214fb63517ad'),
  ('299fdcfe-c7d8-4f73-8ff3-fbc5d29b4c98', 'Trenzas con extensiones', '498a3058-5e74-4e14-b678-214fb63517ad');
INSERT INTO tag (id, name, "parentId") VALUES
  ('e4b91195-69b8-404b-b9be-01e9e1aab3cd', 'Recogidos', '9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed'),
  ('198f5d8e-6858-4e34-a073-983dfd0bfb2b', 'Semirecogidos', '9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed'),
  ('8aa827d6-d61f-4ad4-a217-9be9cc171b30', 'Peinados con accesorios', '9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed');
INSERT INTO tag (id, name, "parentId") VALUES
  ('5d9fa316-db1c-4307-8ecc-839ba82df21f', 'Manicure', '517d44ba-ff4c-4077-b99a-1ca8021fa21a'),
  ('b28b9374-0324-4613-8fb5-3ddcfa23aa81', 'Pedicure', '517d44ba-ff4c-4077-b99a-1ca8021fa21a'),
  ('9b702516-037c-4524-a21a-6faa71890b5f', 'Diseños y nail art', '517d44ba-ff4c-4077-b99a-1ca8021fa21a'),
  ('a4162d8a-6f39-40b1-aadd-5c7c484a07ac', 'Acrílicas', '517d44ba-ff4c-4077-b99a-1ca8021fa21a'),
  ('0e0a657d-66eb-4a2f-9eb8-ed5cb91946af', 'Gel y polygel', '517d44ba-ff4c-4077-b99a-1ca8021fa21a'),
  ('de246f3f-6929-49c9-8c2d-64b2189d2686', 'Semipermanente', '517d44ba-ff4c-4077-b99a-1ca8021fa21a'),
  ('3bc10a8b-91ef-40e4-97d0-4a39afe56b05', 'Para eventos', '517d44ba-ff4c-4077-b99a-1ca8021fa21a'),
  ('b1445426-4264-4b65-8ec0-adfc02142cd9', 'Mantenimiento y reparación', '517d44ba-ff4c-4077-b99a-1ca8021fa21a');
INSERT INTO tag (id, name, "parentId") VALUES
  ('6187cc84-58b8-4026-bd65-d6852c7330b6', 'Día / natural', 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f'),
  ('793936a3-d476-4f95-9326-8e70609cec2e', 'Noche', 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f'),
  ('7b9e9d6d-573d-489c-a80c-73c9354f0f80', 'Novia', 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f'),
  ('cd3876c6-b101-4c10-ae09-113ed6e61a83', 'De fiesta', 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f'),
  ('9f662cf5-f238-47d6-8309-adc984a3133e', 'Social y fotográfico', 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f'),
  ('8b150197-e995-412a-89a8-399508ba29c0', 'Quinceañera', 'd4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f');
INSERT INTO tag (id, name, "parentId") VALUES
  ('69587d12-1124-4bfd-9b9c-1f04c657225a', 'Coloración completa', '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7'),
  ('557914c0-d477-461d-b443-2e6f9ba26865', 'Mechas y balayage', '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7'),
  ('5780a1d6-dc15-47d4-a195-16c68cec22cf', 'Retoque de raíz', '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7'),
  ('3f689c05-1f87-4259-9979-7f5943095e59', 'Color fantasía', '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7'),
  ('5d9c9422-2c46-4165-9924-21674236f140', 'Decoloración', '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7'),
  ('2d3bca45-bce7-4a20-9a17-ca8ce15bd8a0', 'Matiz y gloss', '11eb3167-dce0-4d4b-92d2-0ab1c4a940a7');
INSERT INTO tag (id, name, "parentId") VALUES
  ('f03abf42-10e2-4f96-ac84-d8ec4f017a7e', 'Diseño de cejas', '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83'),
  ('16fc1249-0601-40a0-93dd-1b5f87b6e599', 'Tinte de cejas', '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83'),
  ('be1f0d24-7859-4a39-bee6-f247ebbd2eb4', 'Henna brows', '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83'),
  ('838d35cf-3c95-467a-83a2-fc2bad4cd91a', 'Perfilado (cera/hilo)', '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83'),
  ('68b3fcbd-4398-4489-8bd8-c59b336d5d46', 'Lifting de pestañas', '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83'),
  ('3ff10831-b2f4-4731-aa18-3cf1154808cd', 'Extensiones de pestañas', '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83'),
  ('91742a87-7eeb-41a8-b6da-1c82a284d3da', 'Tinte de pestañas', '90fd2551-7f19-4bf0-86c7-c8c09ffc5c83');
