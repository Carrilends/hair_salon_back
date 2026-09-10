--
-- PostgreSQL database dump
--

\restrict WN6lQ4LN35DsHpe2vh3r9hgJdjGHfu25I6bjf6DaA8dY6DzpR5LcM0jqPkxgC8v

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.image_manager DROP CONSTRAINT IF EXISTS "FK_ba0dd99d3cb65dfa2758535024d";
ALTER TABLE IF EXISTS ONLY public.image_manager DROP CONSTRAINT IF EXISTS "FK_b40fd1da30dfcc0990cdbe1171d";
ALTER TABLE IF EXISTS ONLY public.auth_tokens DROP CONSTRAINT IF EXISTS "FK_auth_tokens_user_id";
ALTER TABLE IF EXISTS ONLY public.service DROP CONSTRAINT IF EXISTS "FK_9bbef42f10fafcf9c9fd55f48a6";
ALTER TABLE IF EXISTS ONLY public.reservation_services DROP CONSTRAINT IF EXISTS "FK_98e19f81ba239737fcfa594d6bf";
ALTER TABLE IF EXISTS ONLY public."reviewsByUser" DROP CONSTRAINT IF EXISTS "FK_90911aa1d412eb682c7128f0957";
ALTER TABLE IF EXISTS ONLY public.service_tags_tag DROP CONSTRAINT IF EXISTS "FK_89d3643a767b3c7551c45d93181";
ALTER TABLE IF EXISTS ONLY public.service_tags_tag DROP CONSTRAINT IF EXISTS "FK_6b9529e6d4558dd00fb2e759b19";
ALTER TABLE IF EXISTS ONLY public.tag DROP CONSTRAINT IF EXISTS "FK_5f4effb7cd258ffa9ef554cfbbb";
ALTER TABLE IF EXISTS ONLY public.reservations DROP CONSTRAINT IF EXISTS "FK_4af5055a871c46d011345a255a6";
ALTER TABLE IF EXISTS ONLY public.planne DROP CONSTRAINT IF EXISTS "FK_45a3c2297d340e56b1f8bd24d6f";
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS "FK_3ddc983c5f7bcf132fd8732c3f4";
ALTER TABLE IF EXISTS ONLY public.reservations DROP CONSTRAINT IF EXISTS "FK_1834ead84dfb79d54d08ff3f3fe";
ALTER TABLE IF EXISTS ONLY public."reviewsByUser" DROP CONSTRAINT IF EXISTS "FK_00e91bb4716a6fe4394ff1e5321";
DROP INDEX IF EXISTS public."IDX_d5e27da0cd39bc3bb2811fc8ba";
DROP INDEX IF EXISTS public."IDX_auth_tokens_user_id_type";
DROP INDEX IF EXISTS public."IDX_89d3643a767b3c7551c45d9318";
DROP INDEX IF EXISTS public."IDX_6b9529e6d4558dd00fb2e759b1";
DROP INDEX IF EXISTS public."IDX_3ddc983c5f7bcf132fd8732c3f";
ALTER TABLE IF EXISTS ONLY public.reservations DROP CONSTRAINT IF EXISTS excl_reservations_worker_overlap;
ALTER TABLE IF EXISTS ONLY public."reviewsByUser" DROP CONSTRAINT IF EXISTS "UQ_bcc2af1fcef0be39cf9c7b176e4";
ALTER TABLE IF EXISTS ONLY public.auth_tokens DROP CONSTRAINT IF EXISTS "UQ_auth_tokens_token_hash";
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS "UQ_a7838d2ba25be1342091b6695f1";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3";
ALTER TABLE IF EXISTS ONLY public.service DROP CONSTRAINT IF EXISTS "UQ_7806a14d42c3244064b4a1706ca";
ALTER TABLE IF EXISTS ONLY public.tag DROP CONSTRAINT IF EXISTS "UQ_6a9775008add570dc3e5a0bab7b";
ALTER TABLE IF EXISTS ONLY public.service DROP CONSTRAINT IF EXISTS "UQ_4df47ef659e04d5be78ddb6b598";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS "UQ_0bd5012aeb82628e07f6a1be53b";
ALTER TABLE IF EXISTS ONLY public.planne DROP CONSTRAINT IF EXISTS "UQ_00f8f9fe71b6b2618e721e152d5";
ALTER TABLE IF EXISTS ONLY public.service DROP CONSTRAINT IF EXISTS "REL_9bbef42f10fafcf9c9fd55f48a";
ALTER TABLE IF EXISTS ONLY public.planne DROP CONSTRAINT IF EXISTS "REL_45a3c2297d340e56b1f8bd24d6";
ALTER TABLE IF EXISTS ONLY public.workers DROP CONSTRAINT IF EXISTS "PK_e950c9aba3bd84a4f193058d838";
ALTER TABLE IF EXISTS ONLY public.reservations DROP CONSTRAINT IF EXISTS "PK_da95cef71b617ac35dc5bcda243";
ALTER TABLE IF EXISTS ONLY public.auth_tokens DROP CONSTRAINT IF EXISTS "PK_auth_tokens_id";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS "PK_a3ffb1c0c8416b9fc6f907b7433";
ALTER TABLE IF EXISTS ONLY public.tag DROP CONSTRAINT IF EXISTS "PK_8e4052373c579afc1471f526760";
ALTER TABLE IF EXISTS ONLY public.migrations DROP CONSTRAINT IF EXISTS "PK_8c82d7f526340ab734260ea46be";
ALTER TABLE IF EXISTS ONLY public.image_manager DROP CONSTRAINT IF EXISTS "PK_89adfc523c3ea78eda37d570a7c";
ALTER TABLE IF EXISTS ONLY public.service DROP CONSTRAINT IF EXISTS "PK_85a21558c006647cd76fdce044b";
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS "PK_7d8bee0204106019488c4c50ffa";
ALTER TABLE IF EXISTS ONLY public.planne DROP CONSTRAINT IF EXISTS "PK_574b5f18287d22c75431f1f2ae1";
ALTER TABLE IF EXISTS ONLY public.reservation_services DROP CONSTRAINT IF EXISTS "PK_4f6633abeabcab5b1c5c4288f19";
ALTER TABLE IF EXISTS ONLY public."reviewsByUser" DROP CONSTRAINT IF EXISTS "PK_4a2706da5f3b027795254f1ca72";
ALTER TABLE IF EXISTS ONLY public.type DROP CONSTRAINT IF EXISTS "PK_40410d6bf0bedb43f9cadae6fef";
ALTER TABLE IF EXISTS ONLY public.service_tags_tag DROP CONSTRAINT IF EXISTS "PK_2f1e93522993ff0afb0a8cc0351";
ALTER TABLE IF EXISTS ONLY public.faqs DROP CONSTRAINT IF EXISTS "PK_2ddf4f2c910f8e8fa2663a67bf0";
ALTER TABLE IF EXISTS ONLY public.detail DROP CONSTRAINT IF EXISTS "PK_28de27ee9ae6103af88ab1b3c0c";
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS "PK_231ae565c273ee700b283f15c1d";
ALTER TABLE IF EXISTS public.migrations ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.workers;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.type;
DROP TABLE IF EXISTS public.tag;
DROP TABLE IF EXISTS public.service_tags_tag;
DROP TABLE IF EXISTS public.service;
DROP TABLE IF EXISTS public."reviewsByUser";
DROP TABLE IF EXISTS public.reviews;
DROP TABLE IF EXISTS public.reservations;
DROP TABLE IF EXISTS public.reservation_services;
DROP TABLE IF EXISTS public.refresh_tokens;
DROP TABLE IF EXISTS public.planne;
DROP SEQUENCE IF EXISTS public.migrations_id_seq;
DROP TABLE IF EXISTS public.migrations;
DROP TABLE IF EXISTS public.image_manager;
DROP TABLE IF EXISTS public.faqs;
DROP TABLE IF EXISTS public.detail;
DROP TABLE IF EXISTS public.auth_tokens;
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS btree_gist;
--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auth_tokens; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.auth_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auth_tokens OWNER TO luis;

--
-- Name: detail; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.detail (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    description text NOT NULL,
    specifications jsonb NOT NULL
);


ALTER TABLE public.detail OWNER TO luis;

--
-- Name: faqs; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.faqs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.faqs OWNER TO luis;

--
-- Name: image_manager; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.image_manager (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "publicId" text DEFAULT 'example_public_id'::text NOT NULL,
    version text,
    url text DEFAULT '/'::text NOT NULL,
    "isPrincipal" boolean DEFAULT false NOT NULL,
    "serviceId" uuid,
    "planneId" uuid
);


ALTER TABLE public.image_manager OWNER TO luis;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO luis;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: luis
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO luis;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: luis
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: planne; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.planne (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    "servicesIds" text[] NOT NULL,
    gender text NOT NULL,
    "detailId" uuid
);


ALTER TABLE public.planne OWNER TO luis;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    family_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO luis;

--
-- Name: reservation_services; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.reservation_services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    service_id uuid,
    name text NOT NULL,
    price numeric NOT NULL,
    duration_minutes integer NOT NULL
);


ALTER TABLE public.reservation_services OWNER TO luis;

--
-- Name: reservations; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.reservations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    worker_id uuid NOT NULL,
    total_duration_minutes integer NOT NULL,
    ended_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pendiente'::text NOT NULL,
    user_id uuid,
    customer_name text,
    customer_phone text,
    customer_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reservations OWNER TO luis;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    score integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reviews OWNER TO luis;

--
-- Name: reviewsByUser; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public."reviewsByUser" (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid NOT NULL,
    "reviewId" uuid NOT NULL
);


ALTER TABLE public."reviewsByUser" OWNER TO luis;

--
-- Name: service; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.service (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    type text,
    price numeric NOT NULL,
    "isSpecial" boolean DEFAULT false NOT NULL,
    slug text NOT NULL,
    detail_id uuid NOT NULL,
    have_promotion boolean DEFAULT false NOT NULL,
    porcentage_disscount numeric DEFAULT '0'::numeric NOT NULL,
    duration integer DEFAULT 30 NOT NULL
);


ALTER TABLE public.service OWNER TO luis;

--
-- Name: service_tags_tag; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.service_tags_tag (
    "serviceId" uuid NOT NULL,
    "tagId" uuid NOT NULL
);


ALTER TABLE public.service_tags_tag OWNER TO luis;

--
-- Name: tag; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.tag (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    "parentId" uuid
);


ALTER TABLE public.tag OWNER TO luis;

--
-- Name: type; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.type (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "translateKey" text NOT NULL
);


ALTER TABLE public.type OWNER TO luis;

--
-- Name: users; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    password text,
    "fullName" text NOT NULL,
    roles text[] DEFAULT '{user}'::text[] NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    data_policy_accepted_at timestamp with time zone,
    email_verified_at timestamp with time zone,
    google_id text
);


ALTER TABLE public.users OWNER TO luis;

--
-- Name: workers; Type: TABLE; Schema: public; Owner: luis
--

CREATE TABLE public.workers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);


ALTER TABLE public.workers OWNER TO luis;

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Data for Name: auth_tokens; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.auth_tokens (id, user_id, type, token_hash, expires_at, used_at, created_at) FROM stdin;
2420dc59-ae89-4300-8fdb-da336826a009	1c9297c9-c6c9-4abc-af9d-3bc79bbc8837	email_verification	6d57f31a2f3aeb349a856c739a1f76a0d9a696df83479f1ac817003f835f3bf6	2026-08-19 21:31:12.073+00	\N	2026-08-18 21:31:12.152309+00
2dd9e762-000f-469a-bec9-1e1fbe7de4e5	46c9aec8-97fc-4f22-b994-dd91a3dd6eb0	email_verification	bfb9f9c43c230cf6d43f0ebcfdb082d078cb432411ac5fd4f669763ba145ef18	2026-08-19 21:55:32.927+00	\N	2026-08-18 21:55:32.999609+00
\.


--
-- Data for Name: detail; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.detail (id, description, specifications) FROM stdin;
8d5a17c2-7932-4672-ab3d-6031fa17e003	hola este es un servicio de prueba	{"df": ""}
fc652de2-5ebb-4d36-aab4-faf347d6f71b	El degradado comienza justo por encima de la línea de las orejas y desciende suavemente hacia la nuca. Es el corte de barbería más solicitado del mundo por su versatilidad: luce igual de bien con cabello liso, ondulado o rizado, y se adapta tanto a ambientes casuales como formales.	{}
d528f87d-c520-497f-8028-636341d985f3	Corte militar clasico, perfecto para un hombre disciplinado	{"df": ""}
51c3bb87-1d9e-4f05-8e0b-114cd43ec577	El degradado arranca a la mitad lateral de la cabeza, creando un contraste moderado entre los lados y la parte superior. Es la opción preferida en el estilo urbano y streetwear, y combina perfectamente con diseños grabados o cortes texturizados arriba.	{}
a2ebe7fe-0b7e-486f-ad23-b4f490e511ec	feqfewqfewqfewqfffffff	{"df": ""}
9fe5d5cb-f070-401b-8221-d1ba5e183ee0	feqfewqfewqfewqfffffff	{"df": ""}
4913c88b-40a3-4c20-b620-49a420ab3379	El degradado comienza muy arriba, casi en la coronilla, generando un contraste dramático y un aspecto muy limpio. Es ideal para quienes quieren un look llamativo y moderno; resalta especialmente bien con afros, quiffs o pompadours en la parte superior.	{}
6b47baf9-9241-4f21-838e-3146c598b63f	El degradado llega hasta la piel, dejando los laterales completamente rapados sin ningún pelo visible. Es el acabado más limpio y radical de los fades, muy popular en barberías urbanas y en combinación con cualquier estilo en la parte superior.	{}
dd4cef03-08d8-4861-82f6-b74fc2269f70	Degradado progresivo y suave que sigue la línea natural del cuello y las sienes. A diferencia del fade tradicional, el taper es más gradual y conservador, ideal para cabellos finos y lisos y ambientes de trabajo formales donde se necesita un look prolijo pero no exagerado.	{}
979fa79f-b07e-482e-9db4-0abec1f28bf1	El degradado sigue una línea curva que 'cae' detrás de la oreja, creando un contorno redondeado y estético en lugar de la línea horizontal estándar. Aporta un aspecto más artístico y dinámico, y funciona muy bien con diseños grabados en la zona de la sien.	{}
59838466-def1-4d14-a707-0872a5ac8cb2	Degradado enfocado exclusivamente en las sienes (temples), que limpia y define el perímetro facial sin alterar demasiado los laterales. Es un complemento frecuente de otros cortes para dar un acabado más cuidado y elegante al contorno del rostro.	{}
25f00d4e-f1b1-4fc4-b770-c83950d6aa09	El degradado tiene forma de arco o sol alrededor de la oreja, irradiando hacia afuera. Se usa especialmente en combinación con mohawks o afros para enmarcar el estilo central. Es un corte con mucha personalidad, muy popular en la cultura afrolatina y urbana.	{}
0d8c151c-ec07-4627-aada-97f4c451137e	Inspirado en el peinado de Julio César, este corte tiene un largo uniforme en toda la cabeza con un flequillo recto peinado hacia adelante. Es sencillo, fácil de mantener y atemporal. Funciona bien en cabellos lisos o ligeramente ondulados y es muy popular entre niños por su facilidad de cuidado.	{}
965590bb-e149-4a65-a1a1-ae7c4d66767c	Corte corto por los lados y la nuca con algo más de largo en la parte superior, peinado hacia adelante o con ligera textura. Es uno de los estilos más masculinos y versátiles que existen, asociado históricamente con lo militar y deportivo. Funciona en cualquier tipo de cabello.	{}
f975e0c7-dea1-432a-8542-a039d072659b	Variante más refinada del crew cut, con suficiente largo al frente para peinarse con una raya lateral. Evoca el ambiente universitario de élite estadounidense y es perfecto para entornos formales o profesionales. Requiere algo de peinado pero se mantiene toda la jornada.	{}
7ed1903d-b673-4dad-944d-d695f1f49810	El cabello se peina con una raya marcada a un lado, creando un look clásico, ordenado y elegante. Puede hacerse con el cabello liso, ondulado o con rizo leve. Es el estilo más recurrente en ambientes corporativos y formales, y combina perfectamente con barba bien arreglada.	{}
a92144a9-5c8a-4b00-b74d-fad04707de76	Todo el cabello se peina hacia atrás usando gel, pomada o aceite, dejando la frente completamente despejada. Da un look sofisticado, dominante y cinematográfico. Funciona especialmente bien con cabello grueso y con ondas naturales, y es un clásico del estilo italiano y latino.	{}
493a6281-15f5-49b9-be63-3b68ab0f7e27	Los laterales y la nuca van rapados o muy cortos, mientras que la parte superior conserva mucho largo, creando un contraste fuerte de volumen. Es uno de los estilos más populares de la última década por su adaptabilidad: el pelo de arriba puede peinarse hacia atrás, a un lado, en moño o con textura.	{}
3d495354-d9c5-420f-975f-2d1ac805abc5	Similar al undercut clásico pero con una línea perfectamente definida entre la parte rapada y el largo superior, sin degradado de transición. La separación abrupta genera un efecto visual muy impactante. Es popular en moda asiática, barbería nórdica y estética punk-moderna.	{}
25d23b86-fe4c-42a3-b45c-15c0a3aafd14	Corte corto con la parte superior texturizada y con movimiento, generalmente con flequillo hacia adelante y lados con fade o taper. Es el corte de tendencia más pedido actualmente en Europa y Latinoamérica. Muy fácil de mantener y estilizar con un poco de cera o sal marina.	{}
461927e6-84e8-4bf3-a5f1-e96bfb81b429	Flequillo recto y definido con los laterales cortos y una leve textura arriba. Originado en la moda francesa, tiene un aire europeo elegante y moderno. Es especialmente favorecedor para rostros ovalados o rectangulares y para cabellos lisos o con onda leve.	{}
afe2982d-6252-4360-b7ee-353e9efc8eb7	Corte con mucho volumen en la parte frontal peinado hacia arriba y atrás, con lados más cortos. Es una fusión entre el pompadour y el crop moderno. Aporta altura al rostro y es muy popular en el estilo rockabilly contemporáneo y en la moda masculina europea.	{}
3649b06a-1576-4094-a2aa-73538fb1e3aa	El cabello superior es largo y se peina completamente hacia atrás y arriba logrando gran volumen y altura, mientras los lados van cortos o con fade. Símbolo del rock and roll de los años 50, hoy es un clásico reinventado que transmite carácter y estilo retro-moderno.	{}
9e137fd7-8e52-43e6-aaa1-11be01cee919	Simula un mohawk sin necesidad de rapar los lados completamente: el cabello central se eleva con gel o pomada mientras los costados van con fade o peinados hacia adentro. Es el término medio entre lo atrevido y lo aceptable en entornos laborales. Muy popular entre niños y adolescentes.	{}
0abdade1-abe0-407e-9794-bd5f3eadf57e	Los lados de la cabeza van completamente rapados y se deja una banda central de pelo que puede pararse en punta con fijador. Originado en la cultura nativa americana y popularizado por el punk en los años 70. Hoy existen versiones más suaves y estilizadas para uso cotidiano.	{}
8d910c06-4cc4-4cae-a510-a566cfc0268f	La cresta central del mohawk va trenzada en lugar de parada, fusionando la estética punk con técnicas africanas de trenzado. Los lados pueden ir con fade, cornrows o también trenzados. Es un estilo con mucha identidad cultural y creatividad, muy visto en comunidades afrolatinas.	{}
e8131abc-b381-408c-9796-7f4d5cddb6af	El cabello afro crece en su forma natural sin alisados ni alteraciones químicas, formando una corona densa y redondeada. Símbolo de identidad, orgullo y resistencia cultural desde el movimiento Black Power de los años 60. Se mantiene con hidratación, aceites naturales y peinado con peine de púas anchas.	{}
bf0ddb7b-a992-4b3b-ac5e-8c244012d8b6	Técnica en la que el cabello se divide en secciones y se tuerce en dos hebras; al soltarse, revela rizos muy definidos y con volumen. El resultado varía según el grosor de los twists y el producto usado. Es uno de los estilos de cabello natural más usados por su resultado impresionante sin calor.	{}
2a9e72c1-f0c2-43fb-8a77-815633ed9903	Dreadlocks en su etapa inicial o media, de longitud por encima de los hombros. El cabello se secciona y se deja compactar de forma natural o con ayuda del crochet. Representan el inicio de un camino de largo plazo con profundo significado cultural, especialmente en comunidades rastafari y africanas.	{}
bd5fd218-56ef-479c-81d6-f949d69d1346	Dreadlocks completamente maduros y bien definidos que pueden llegar a la espalda o más. Son el resultado de años de crecimiento y mantenimiento. Tienen un peso cultural enorme en tradiciones africanas, jamaicanas y espirituales, y hoy también forman parte del mainstream de la moda global.	{}
ab6b6305-31b6-4748-a855-e63e6ab3b077	Patrón de ondas continuas que rodean toda la cabeza en 360 grados, conseguido mediante cepillado constante con brocha, uso de durag y productos de fijación. Es un estilo que requiere disciplina y rutina diaria, muy popular entre hombres negros jóvenes en Estados Unidos.	{}
c7763779-b340-4e12-a6f7-7d182b39d2b1	Corte icónico de los años 80 y 90 con un bloque plano de cabello afro en la parte superior y un fade limpio en los costados. Fue popularizado por artistas del hip-hop y jugadores de la NBA. Hoy vive un resurgimiento en la moda retro afroamericana.	{}
3dace187-ba36-4420-b574-a535f570d3ef	Técnica rápida para definir rizos en cabello afro usando una esponja con agujeros que al frotarse sobre el pelo húmedo genera pequeños coils compactos y uniformes. Es muy popular para cuidado diario del cabello natural y funciona tanto en adultos como en niños desde los primeros años.	{}
5cc7b817-3d3d-4330-a87f-4c0c7c300159	Trenzas de sección cuadrada que van de longitud corta al mentón o al hombro. Se pueden hacer con cabello natural o con extensiones y ofrecen mucha versatilidad para peinar de distintas maneras. Son una opción de protección del cabello muy practicada en hombres con identidad afro.	{}
18289820-8d34-4bc9-8b18-221153f6f2f5	Trenzas planas y pegadas directamente al cuero cabelludo, tejidas en líneas rectas o patrones curvos. Es una de las técnicas de peinado más antiguas del mundo, con raíces en África Occidental. Son protectoras del cabello natural, duran semanas y admiten innumerables diseños y patrones.	{}
ddf67094-dbfc-4db8-8d09-c10b0baebbca	Combinación de cornrows en la parte superior con un degradado fade limpio en los laterales. Esta fusión de técnicas tradicionales africanas y barbería moderna es extremadamente popular en barbershops urbanos de todo el mundo y aporta un look contemporáneo con profunda identidad cultural.	{}
68580506-dba7-455d-860f-99ededc3fb93	Dos mechones de cabello se retuercen entre sí a lo largo de toda su extensión. Son más fáciles de hacer que las trenzas, duran varios días y pueden deshacerse para crear un twist out. Muy usados como estilo de transición o de protección en hombres que están creciendo su cabello natural.	{}
38e92a63-b969-4064-b2bb-62507f27ee98	El cabello largo se recoge en un moño alto en la coronilla, dejando el cuello y la nuca despejados. Es práctico, cómodo y tiene un atractivo bohemio-moderno. Puede usarse con cabello totalmente recogido o con algunos mechones sueltos enmarcando el rostro para un look más relajado.	{}
7fad7906-f1ce-4552-a072-61e3a7f91a07	Solo la mitad superior del cabello se recoge en un moño, mientras el resto cae libre sobre los hombros. Es un estilo relajado y casual que combina lo recogido con lo suelto, muy popular en artistas, músicos y el mundo del surf y snowboard.	{}
dfa15204-db34-485d-9c18-4e6db86fc1a4	Cabello largo y liso o ligeramente ondulado que se divide con una raya al centro y cae hacia ambos lados enmarcando el rostro como una cortina. Ícono de los años 90 popularizado por actores y músicos de la época, actualmente en pleno resurgimiento en la generación Z.	{}
25e1009e-6890-4330-b00d-c01d4598967f	Moño tirante y alto ubicado en la coronilla, inspirado en el chonmage tradicional japonés de los samuráis. Transmite disciplina, fuerza y estética oriental. Funciona mejor con cabello liso y grueso, y ha ganado popularidad global gracias al anime y la cultura japonesa contemporánea.	{}
20532d3d-5da9-4c89-9d80-3c42fbb4b93e	Corte en capas largas y desordenadas que mezcla el shag de los años 70 con el mullet moderno. Tiene mucho volumen en la parte superior y capas largas y sueltas abajo. Es la tendencia más viral de los últimos años en redes sociales, adoptada por hombres y mujeres por igual.	{}
867557ac-b456-4534-9cf2-32518e5d7971	Los laterales y la nuca se cortan muy cortos o al rape, mientras la parte superior conserva su largo natural sin degradado de transición. Es el corte dominante en Corea del Sur desde mediados de los 2010 y ha trascendido globalmente gracias al K-pop y los dramas coreanos.	{}
b2f0c16b-b7ef-4c26-9bf9-b238a9b86fed	Ondas suaves y naturales conseguidas con permanente de bajo impacto, técnica popularizada en Corea del Sur. A diferencia del rizo marcado occidental, el perm coreano da movimiento y volumen orgánico al cabello liso. Muy solicitado en hombres asiáticos y latinos con cabello fino.	{}
761c0820-688e-4fc1-9893-497b8fe683f3	El cabello cae uniforme alrededor de la cabeza con un flequillo recto que rodea toda la frente, dando forma de hongo. Es un corte que surgió en los 60s, pasó por los 90s y hoy está en plena tendencia gracias a la moda Y2K y la influencia asiática. Favorece rostros ovalados y pequeños.	{}
b064d340-dea4-4f02-92fc-0174281654f4	Flequillo recto, horizontal y perfectamente definido combinado con fade en los laterales. Es el corte más representativo de la cultura barrial latina en EE.UU. y México, y ha conquistado barbershops en toda Latinoamérica. Puede hacerse con línea grabada para mayor definición del perímetro.	{}
493d6d6e-0e30-4332-8ab7-b58ab3e4f366	Degradado en las sienes acompañado de una línea grabada con la máquina que define con precisión el borde del cabello. Es el sello de identidad de la barbería urbana latina y caribeña. La línea puede ser recta o tener diseños geométricos más elaborados según el cliente.	{}
a566a106-eb88-4c59-ad30-c9ebb550f508	El cabello afro o rizado se peina hacia afuera con difusor y secador, creando una corona esponjada y con volumen uniforme alrededor de la cabeza. Es un estilo icónico de Miami y las comunidades cubanas y puertorriqueñas en EE.UU., y representa la identidad afrolatina con mucho orgullo.	{}
dc7b94d4-db4f-44cc-81c3-17be1c169496	El corte más reconocible en niños pequeños: el pelo se corta recto alrededor de la cabeza a nivel de las orejas siguiendo una línea circular, como si se hubiera puesto un tazón encima. Es fácil de ejecutar, de mantener y muy resistente al movimiento de los niños en su día a día.	{}
08a78c5e-178a-45a3-96f9-0fdd6e1f1ed0	Flequillo natural y texturizado que cae sobre la frente sin usar gel ni productos fuertes. Es un corte moderno pensado para niños entre 3 y 10 años, con apariencia desenfadada y juvenil. Los laterales van ligeramente cortos y la parte superior conserva movimiento y volumen.	{}
8fcdd043-c67d-48b4-aa59-31ec15334039	Taper suave en nuca y sienes con largo natural en la parte superior, sin fade pronunciado. Es el corte más solicitado por padres que quieren algo limpio, fácil de mantener y apropiado para el colegio. Funciona muy bien en niños con cabello liso o ligeramente ondulado de cualquier tono.	{}
0e244b16-3e3b-406d-add3-00f119d37c89	Cabello afro natural bien hidratado y cuidado en niños, peinado con aceite de coco o manteca de karité para mantener la forma y evitar el frizz. Es una declaración de identidad desde la infancia, promovida por padres comprometidos con la herencia cultural afro. Se acompaña de educación sobre el amor propio y el cabello natural.	{}
181a01ac-1518-41a1-a980-841b3bb7b987	El cabello conserva su largo y se trabajan capas suaves y graduales que aportan movimiento y aligeran las puntas sin sacrificar densidad. Es uno de los cortes más solicitados porque favorece prácticamente cualquier rostro y permite peinar el cabello con ondas, liso o en recogidos. Funciona muy bien tanto en cabellos finos como gruesos.	{}
c467aeb3-9543-4be1-a025-98fe9845fe6b	Corte recto a la altura de la mandíbula con líneas limpias y geométricas, inspirado en el icónico bob de los años 20. Estiliza el rostro, resalta el cuello y transmite elegancia atemporal. Es ideal para cabellos lisos o con onda leve y se mantiene impecable con un brushing rápido en casa.	{}
cc876123-e9ed-4607-bcfc-898e8271ca2a	Versión más larga del bob, llega entre el mentón y los hombros con un corte recto o ligeramente desfilado. Es el punto medio perfecto entre lo corto y lo largo: aporta movimiento, es fácil de mantener y combina con todo tipo de rostros. Una de las tendencias más estables de la última década.	{}
d1e96071-37b9-4c5f-a35b-cda85c5f79c3	Corte corto y desenfadado que deja la nuca y los costados muy cortos, con algo más de largo y textura en la coronilla y el flequillo. Es un corte de alto impacto que resalta los rasgos del rostro, especialmente los ojos y los pómulos. Requiere visitas frecuentes a la peluquería para mantener la forma.	{}
c54916ab-5946-42e6-8808-52c00415283a	Versión más suave del pixie tradicional, con suficiente largo en la parte superior para peinarse a un lado o hacia atrás. Es ideal para quienes quieren animarse a un corte corto sin un cambio tan radical, y se adapta a entornos profesionales con un look moderno y femenino.	{}
fa1145be-ffd6-4454-b7f8-792d7f10a113	Corte por capas muy desfiladas con flequillo abierto y mucho movimiento, originario de los años 70. Aporta volumen en la coronilla y aligera las puntas, dando un look bohemio y rockero. Funciona especialmente bien en cabellos con onda natural y favorece a rostros ovalados y alargados.	{}
b13c4368-7cf8-42cb-ab63-29f7420fd278	Fusión entre el shag setentero y el mullet moderno, con capas cortas y voluminosas en la parte superior y largos desfilados en las puntas. Es uno de los cortes más virales en redes sociales gracias a su estética desenfadada y editorial. Realza la textura natural del cabello sin necesidad de mucho producto.	{}
a0db9075-0620-498b-90ec-9cc56bf4ae2c	Corte completamente recto, sin capas ni desfilado, que da la sensación de un cabello más denso y pesado. Es un look muy limpio y moderno, popular en la moda asiática y en pasarelas internacionales. Funciona mejor en cabello liso de densidad media a alta.	{}
734803d5-3872-4117-be80-9dfee579c4f4	Variación moderna del bob donde un lado es notoriamente más largo que el otro, generando un efecto visual dinámico y vanguardista. Es perfecto para clientas que quieren un corte clásico con un toque diferente. Estiliza el rostro y aporta una personalidad fuerte a la imagen.	{}
bf76529c-4a42-4f13-8dbf-bf1cc513ac9d	Las capas se cortan formando una V pronunciada en la parte trasera, dejando las puntas centrales más largas que los costados. Es ideal para cabellos largos porque añade movimiento y profundidad sin perder longitud, y crea un efecto visual muy elegante cuando se peina con ondas suaves.	{}
b0e53724-1f76-4502-a9a4-a6616724b5e9	Similar a las capas en V pero con una curva más suave y redondeada en la parte trasera, lo que produce una caída uniforme y natural. Es el corte por capas más conservador y favorecedor para casi cualquier tipo de rostro. Aporta movimiento sin alterar la forma general del peinado.	{}
7b4aa9e4-12ee-4835-9ee6-f1047c8f3cb5	Reinterpretación femenina del mullet ochentero: corto en la parte superior y los lados, con largo desfilado en la nuca. Hoy se usa con mucho carácter editorial y se ha convertido en favorito de la generación Z por su actitud disruptiva y andrógina.	{}
238cc68f-532d-48c4-9106-5b2a82e3a697	Corte a la altura del hombro acompañado de un flequillo cortina abierto al centro que enmarca el rostro. Es uno de los cortes más pedidos actualmente porque combina practicidad y estilo, y favorece especialmente rostros ovalados, redondos y con forma de corazón.	{}
23b35486-c35b-4e45-b158-20f744dd6b9c	Bob corto a la altura del mentón con flequillo recto y aire parisino. Transmite chic, naturalidad y una sensualidad sutil muy característica del estilo francés. Funciona mejor en cabello liso o ligeramente ondulado y queda increíble con tonos castaños o rubios cenizos.	{}
d8a301e0-5fdf-48e8-aa7b-980ac69ffc75	Todo el cabello se recoge en lo alto de la coronilla con una liga, dejando el rostro despejado y aportando un efecto lifting natural. Es un peinado versátil que sirve tanto para el día a día como para eventos cuando se acompaña de ondas o accesorios. Favorece cualquier tipo de rostro.	{}
87f04a85-29e4-4f02-bad1-d3357b33e220	El cabello se recoge a la altura de la nuca de manera elegante y discreta. Es ideal para entornos formales, oficina y eventos sobrios, y combina muy bien con un mechón envolviendo la liga para esconderla y dar un acabado más pulido y profesional.	{}
dd01d30d-8853-40e3-b784-1d41114d0c9e	Recogido tirante y perfectamente pulido en lo alto de la cabeza, inspirado en la disciplina del ballet. Aporta un aire elegante, sofisticado y atlético, y es muy usado en eventos formales, sesiones fotográficas y clases de danza. Suele acompañarse de fijador para garantizar firmeza durante horas.	{}
557d75ee-1d17-4bee-b9d3-d2b34882fb36	Recogido pulido a la altura de la nuca, con el cabello peinado completamente hacia atrás o con raya al medio. Es uno de los peinados más solicitados para bodas, galas y eventos protocolares por su sobriedad y limpieza visual. Combina con cualquier escote y favorece todos los rostros.	{}
8a3df95a-3b54-4eac-9f16-d6fe8d675bfb	Moño desordenado con mechones sueltos enmarcando el rostro, que da una apariencia relajada pero estudiada. Es el peinado favorito para el día a día porque se logra en pocos minutos, pero también se adapta a bodas estilo boho cuando se acompaña de flores o accesorios florales.	{}
291e9d30-4bf0-43e6-b1b4-9b379885379d	Solo la mitad superior del cabello se recoge en una coleta o moño, dejando el resto suelto cayendo sobre los hombros. Es un peinado romántico y juvenil que combina lo recogido con lo natural. Ideal para citas, graduaciones y celebraciones que no exigen un recogido total.	{}
44cf78f3-32d9-47af-92b0-48f3ba377d5f	Recogido suave en la parte de atrás de la cabeza con mechones ondulados sueltos y volumen estratégico en la coronilla. Es uno de los peinados nupciales más solicitados porque aporta un aire romántico, vintage y femenino que combina con velos, tiaras y todo tipo de accesorios.	{}
124e9bcd-592b-46d7-8388-0107b369858b	Ondas grandes, definidas y muy brillantes peinadas hacia un solo lado, inspiradas en las divas del cine clásico de Hollywood. Es un peinado de alfombra roja por excelencia, y exige una técnica precisa de plancha o rulos para lograr la uniformidad de las ondas y el acabado glossy.	{}
2576c6ad-01af-45c8-b4bc-d02a0098a49f	Ondas naturales y desenfadadas que imitan el efecto del mar y la sal sobre el cabello, con textura suelta y aspecto playero. Es un peinado relajado y juvenil, perfecto para el día a día, planes informales y looks de verano. Se logra con plancha, tenacilla ancha o spray salino.	{}
638dac33-e2b2-4a8a-a0ef-e8a6f21b4395	Técnica que utiliza la plancha para crear ondas marcadas en forma de S a lo largo del cabello, con un acabado moderno y geométrico. Es muy popular gracias a las redes sociales y favorece especialmente cabellos largos y de densidad media, dando un efecto editorial sin necesidad de tenacilla.	{}
21d2bc8d-f334-4c02-921d-6a56df968a4c	Técnica de peinado para cabellos rizados naturales que utiliza productos específicos (cremas, geles, mousses) y un difusor para definir cada rizo sin generar frizz. Realza la textura natural y es la base del movimiento curly girl, que promueve el cuidado y aceptación del cabello rizado.	{}
e39d0706-fafa-41cc-b28b-117e19b10cdd	Recogido elaborado y altamente personalizable diseñado especialmente para novias, que puede incluir trenzas, ondas, torsiones y accesorios florales o de cristal. Cada updo se adapta al vestido, al velo y al estilo de la novia, y suele requerir una prueba previa para garantizar el resultado.	{}
5c47bf9f-f847-4912-896c-0eb12e776f40	Recogido bajo en forma de rosca o caracol enrollado en la nuca, de origen francés y altamente refinado. Es uno de los peinados más elegantes y atemporales que existen, ideal para bodas, galas y ceremonias formales. Se mantiene firme con horquillas invisibles y una buena fijación.	{}
0830d8c6-0877-4498-bbd2-3ebe882f1f67	Dos moños altos ubicados simétricamente a cada lado de la cabeza, con un aire juvenil, festivalero y muy fotogénico. Es un peinado popular en festivales de música, fiestas temáticas y entre adolescentes y niñas. Puede combinarse con trenzas pegadas a los lados para mayor estilo.	{}
3d7fc3c2-ba58-45eb-8ba9-06a6d558e268	Peinado retro inspirado en las pin-ups de los años 40 y 50, con flequillo enrollado tipo victory roll, ondas marcadas y, frecuentemente, un pañuelo de tela como accesorio. Es muy usado en bodas vintage, sesiones temáticas y eventos rockabilly por su carácter y feminidad clásica.	{}
5d078db6-b44d-4ac1-a06b-a8b7e43bdffd	Recogido elegante en el que el cabello se enrolla verticalmente sobre sí mismo en la parte trasera de la cabeza, formando una columna pulida. Es uno de los peinados más sofisticados del repertorio clásico francés, ideal para eventos formales y vestidos con escote en la espalda.	{}
f1a2921c-10bc-4e64-9975-0cc5b27dfd29	Cola de caballo trabajada con cardado en la coronilla para añadir altura y cuerpo, dando una sensación de mayor densidad y un efecto visual más glamoroso. Es muy usada en eventos y sesiones fotográficas, y suele acabarse con un mechón cubriendo la liga para un look más pulido.	{}
0bb565c4-c949-4088-aba2-f0481f06c07b	La mitad superior del cabello se recoge en un pequeño moño alto, dejando el resto suelto. Es un peinado moderno, casual y muy práctico que ha ganado popularidad en redes sociales por su facilidad de ejecución y su capacidad de dar estilo sin complicaciones.	{}
aeca4b66-7d3c-44e9-a19c-5fa809f844c8	Peinado infantil semirrecogido inspirado en princesas de cuentos: media coleta con ondas, decorada con tiaras, lazos, flores o pequeños broches. Es muy solicitado para fiestas de cumpleaños, primeras comuniones y sesiones fotográficas de niñas, y se adapta al vestido y a la temática del evento.	{}
8d40e2c5-8095-4853-bd22-1556f19d089a	Coleta dividida en secciones con ligas a lo largo de toda su longitud, formando 'burbujas' o esferas decorativas. Es un peinado muy popular en niñas porque es divertido, colorido cuando se usan ligas de colores, y mantiene el cabello sujeto durante todo el día escolar o de juegos.	{}
fa2ed55b-4922-4d8e-b56b-cc6912a49ebf	Tratamiento de alisado semipermanente en el que se aplica queratina y se sella con plancha caliente. Reduce notoriamente el frizz, aporta brillo y deja el cabello manejable durante varios meses. Es ideal para cabellos crespos o gruesos que se desean conservar lisos sin perder vida.	{}
a9c37afa-e627-4c87-a839-e946e51f9da4	Tratamiento alisador libre de formol y químicos agresivos, basado en aminoácidos vegetales y aceites naturales. Es la opción preferida por clientas embarazadas, en lactancia o con cuero cabelludo sensible. Su efecto es más suave y dura entre dos y cuatro meses.	{}
ec858c4d-a82f-4e13-811d-d05b00ba8700	Cepillado con secador y cepillo redondo que deja el cabello completamente liso, brillante y con las puntas hacia adentro. Es el servicio express más solicitado para eventos, reuniones de trabajo y citas, y suele complementarse con un sérum de brillo o un protector térmico ligero.	{}
282ac5d0-452a-461d-8bc6-0d404a924776	Técnica de cepillado que utiliza cepillos redondos y secador para añadir cuerpo y altura en la coronilla, ideal para cabellos finos o sin movimiento natural. Aporta una sensación de mayor densidad y un acabado glamoroso que evoca el estilo de las top models.	{}
1011af02-1fea-4214-bfe2-21fddce53a17	Cepillado en el que las puntas se enrollan hacia adentro formando una suave curva en C, evocando los peinados clásicos de los años 60. Es un acabado pulido y elegante muy usado en entornos profesionales y en clientas que prefieren un look femenino tradicional.	{}
c37c83f6-7747-4a60-ae30-cb5938393156	Variación del brushing tradicional en la que las puntas se voltean hacia afuera, dando un aire retro juvenil inspirado en los años 60 y 70. Es divertido, fresco y muy fotogénico, especialmente en cortes a la altura del hombro o long bob.	{}
2dc2901f-b36d-41a4-8659-685f8d3db3aa	Cepillado que combina secador y cepillo redondo grande para crear ondas naturales y movimiento, sin marcas ni rizos definidos. Es perfecto para clientas que quieren un acabado relajado pero pulido, y queda muy bien en cabellos largos y de longitud media.	{}
b9066536-cbd6-48b8-aa5b-72c0bafd89a8	Brushing personalizado que se adapta a la forma del rostro y al estilo de la clienta, combinando técnicas de volumen, ondas y movimiento según se necesite. Es un servicio estrella en peluquerías de barrio y atiende tanto a usuarias del día a día como a clientas de eventos especiales.	{}
45722c95-8305-4011-b6b0-05e2faeef19c	Trenza tejida desde la coronilla hacia la nuca en la que se van añadiendo mechones laterales en cada cruce. Es elegante, ordenada y muy versátil, ideal tanto para entornos casuales como formales. Es además una excelente opción para mantener el cabello recogido durante actividades físicas.	{}
46f54f6a-07f9-49ad-b060-89df452e9da7	Trenza realizada con dos mechones que se van entrelazando en pequeñas secciones, formando un patrón visual parecido a una espina de pescado. Es delicada, romántica y muy fotogénica, perfecta para bodas estilo boho, festivales y eventos al aire libre.	{}
6e5a4477-568e-4c70-87eb-bf7add681798	Variante de la trenza francesa en la que los mechones se cruzan por debajo en lugar de por encima, lo que hace que la trenza sobresalga del cuero cabelludo. Da un efecto tridimensional muy llamativo y se usa frecuentemente como base de peinados elaborados y recogidos.	{}
de1bea24-3c90-4576-b27f-54bb554fb477	Trenzas individuales de sección cuadrada hechas con extensiones, que pueden ir desde el largo medio hasta la cintura. Son protectoras del cabello natural, duran semanas y representan una herencia cultural africana muy presente en mujeres afrolatinas y afrodescendientes.	{}
ce50ed7c-5767-4b28-908a-10d7d919fd72	Trenzas planas y pegadas al cuero cabelludo en líneas rectas o patrones curvos, técnica originaria de África Occidental con miles de años de historia. Son protectoras, duraderas y permiten una infinidad de diseños creativos. Funcionan tanto como peinado completo como base de otros estilos.	{}
9a02362c-38e2-4764-94fc-545bb07d3858	Trenza francesa modificada en la que algunos mechones se dejan caer libremente en lugar de incorporarse a la trenza, formando una 'cascada' de cabello suelto. Es uno de los peinados semirrecogidos más románticos y se utiliza con frecuencia en bodas y graduaciones.	{}
46afd869-70a2-4ee0-a871-ea07d256e74b	Trenza que rodea la cabeza como una diadema natural, dando un aspecto regio y bohemio al mismo tiempo. Puede hacerse con una sola trenza larga enrollada o con dos trenzas más pequeñas unidas. Es un peinado favorito en bodas campestres y festivales por su feminidad atemporal.	{}
413dfba1-2a6a-4575-aca2-00b9242c5503	Dos trenzas francesas simétricas que parten desde la frente y caen por la espalda, dando un aire deportivo, juvenil y muy práctico. Son muy populares en deportistas, niñas en edad escolar y mujeres que buscan mantener el cabello fuera del rostro durante todo el día.	{}
6de72f0e-87eb-4f83-9522-9be898dcc837	Trenzas grandes y pegadas al cuero cabelludo, similares a los cornrows pero con mayor grosor y, frecuentemente, con mechones rizados o sueltos enmarcando el rostro. Tienen un aire majestuoso y se asocian a la imagen de una diosa, de ahí su nombre. Son un símbolo de poder y belleza afro.	{}
dcd27c5e-29b9-4b40-8eed-79cd2a8c5980	Conjunto de trenzas pequeñas o medianas decoradas con ligas de colores, broches, perlas o cintas, pensadas especialmente para niñas. Son protectoras del cabello, duran varios días y son una excelente opción para fiestas, presentaciones escolares o el día a día.	{}
4bd70574-3e7c-46fc-a021-598c788c8d60	Aplicación de esmalte completamente transparente que sella la uña, le aporta un brillo sutil y la protege del desgaste cotidiano. Es la opción favorita para quienes desean unas uñas pulidas y elegantes sin que se note maquillaje, muy elegida tanto por hombres como por mujeres.	{}
014532e8-aca0-4be1-aa9e-b0f707d3c366	Aplicación de productos especializados con queratina, calcio o biotina que refuerzan la lámina ungueal y previenen la fragilidad, descamación o quiebre. Se recomienda como tratamiento de varias sesiones y es ideal para uñas debilitadas por el uso prolongado de acrílicos o gel.	{}
48361bf1-51e4-4bc2-b979-566167c9ec1a	Aplicación de esmalte de gel que se cura con lámpara UV o LED y dura entre dos y tres semanas sin desconcharse. Aporta un brillo intenso y resiste el desgaste diario mucho mejor que el esmalte tradicional. Es la opción más vendida por su durabilidad y variedad de colores.	{}
9a9c11d5-babb-4d5a-9f9c-e3ff05b03bc5	Extensiones realizadas con polvo y monómero acrílico que permiten alargar y reforzar la uña natural. Son extremadamente resistentes, admiten cualquier forma (almendra, stiletto, ballerina, cuadrada) y duran semanas con el debido mantenimiento. Es la técnica más popular en salones latinoamericanos.	{}
89ee55de-8376-4d15-a276-75f7e40e449b	Extensiones o esculpidos realizados con gel constructor que se cura con lámpara UV o LED. Son más flexibles y livianas que las acrílicas, ofrecen un acabado muy natural y permiten todo tipo de decoraciones. Ideales para quienes buscan resultados elegantes y duraderos.	{}
4a08a00d-5147-4ec4-9158-0cb27fa84cae	Técnica de manicure realizada con tornos eléctricos y fresas profesionales que permite trabajar la cutícula con extrema precisión, dejando un acabado impecable y de larga duración. Requiere un nivel técnico avanzado y es muy demandada por su perfección visual y duración prolongada.	{}
6e6aabd7-3cc0-4883-99be-cc72313b7909	Decoración manual de las uñas con motivos florales pintados a mano alzada o aplicados con sellos y pinceles finos. Puede ir desde flores discretas en una sola uña hasta diseños botánicos completos en todas. Es muy popular en primavera, verano y para bodas con temática natural.	{}
6a1aabc4-ea9b-4b0c-b09e-267167e49f3c	Decoración basada en líneas, triángulos, cuadrículas y formas geométricas conseguidas con cinta adhesiva, pinceles finos o stickers. Tiene un aire moderno, minimalista y editorial, y es la opción favorita de quienes buscan un diseño contemporáneo sin recargar las uñas.	{}
98c025e4-b286-4d2d-b630-fb121554248c	Diseño que imita las vetas naturales del mármol mediante la mezcla de varios esmaltes con técnicas de agua, alcohol o pincel fino. Cada uña es única y aporta un acabado lujoso y sofisticado, especialmente popular en tonos blancos, negros y nude con detalles dorados.	{}
ce414e94-0ee1-4394-a5c0-95b5c6deb524	Uñas postizas prefabricadas y decoradas a medida que se aplican con pegamento o pestañas adhesivas y duran varios días. Son una alternativa rápida y reutilizable a las uñas esculpidas, ideales para eventos puntuales o para quienes no quieren comprometerse con un servicio largo.	{}
3d8b45d4-aa5a-4c84-a47e-3df70ad11109	Versión del clásico francés aplicada en los pies, con la uña en tono natural y la punta blanca. Es una opción elegante y muy solicitada para temporadas cálidas, viajes a la playa, vacaciones y bodas en sandalias. Combina con cualquier color de piel y tipo de uña.	{}
490e3778-6131-4f23-8168-b1c473784922	Servicio integral que incluye remojo aromaterapéutico, exfoliación con sales o azúcar, mascarilla hidratante, masaje relajante de pierna y aplicación de esmalte. Es la experiencia premium del cuidado del pie y se recomienda al menos una vez al mes para mantener la salud y suavidad de la piel.	{}
943b624b-894f-4947-b6c4-ffe008fcac2a	Aplicación de esmalte de gel en las uñas de los pies, con un acabado brillante y resistente que dura entre cuatro y seis semanas. Es ideal para quienes viajan, hacen deporte o simplemente quieren olvidarse del retoque del esmalte por más de un mes.	{}
0f4e2581-5b59-4d02-9e77-cd6b97e0d4be	Pedicure tradicional acompañado de decoraciones artísticas en una o varias uñas: flores, líneas, piedras, glitter o diseños temáticos. Es muy popular en temporada de playa, vacaciones y bodas, donde los pies son protagonistas con sandalias abiertas.	{}
7ab39c04-5714-452b-a69e-89ba74aa5a86	Servicio infantil con esmaltes hipoalergénicos en colores vibrantes y diseños divertidos: brillos, stickers de personajes, corazones o estrellas. Es ideal para fiestas de cumpleaños, sesiones madre-hija y celebraciones especiales. Se realiza con productos seguros y técnicas suaves.	{}
31df720c-8362-42a2-bdb6-0fc659ba0ada	Maquillaje base para artes escénicas que iguala el tono y resalta los rasgos para que sean visibles desde el público bajo luces de escenario. Es la base sobre la que se construyen caracterizaciones de personaje y se utiliza en obras teatrales, coros, ballet y presentaciones musicales.	{}
40c5c182-58ea-4d1a-abe4-a744507d6550	Maquillaje aparentemente inexistente que disimula imperfecciones, ilumina la piel y resalta sutilmente los rasgos para que se vean naturales. Requiere mucha técnica para lograr ese efecto 'sin maquillaje pero mejor', y es uno de los acabados más solicitados gracias a redes sociales y la estética minimalista.	{}
b4bac490-d32c-481b-a8a5-942170356746	Maquillaje con piel iluminada y dewy, pómulos resaltados con iluminador líquido y un acabado fresco y juvenil. Es ideal para días soleados, brunchs, paseos y sesiones casuales en exteriores donde la luz natural acompaña el efecto luminoso.	{}
02f34c0a-7a05-4178-b267-66fcb8a52b59	Maquillaje cuya piel se mantiene en estilo natural pero los ojos reciben mayor protagonismo con sombras suaves, pestañas postizas individuales y delineado discreto. Es la combinación favorita de quienes quieren resaltar la mirada sin recargar el resto del rostro.	{}
842ae4a7-c684-4649-a81f-7c7dcab4fcae	Maquillaje icónico de noche con sombras negras y grises difuminadas alrededor del ojo, creando un efecto ahumado e intenso. Es el favorito para salidas nocturnas, conciertos y citas, y se acompaña de una piel impecable y labios neutros para no competir con la mirada.	{}
bf0461ac-5671-496d-ac82-cfa5e61aed3a	Variación más cálida del smokey clásico que utiliza tonos dorados, cobrizos y bronce para iluminar la mirada. Favorece especialmente a ojos verdes, miel y marrones, y aporta un acabado glam ideal para cenas, eventos formales y salidas elegantes.	{}
a9233af6-5395-45f0-a48e-3fb11adc7b89	Maquillaje centrado en un delineado negro alargado tipo 'ojo de gato' con final puntiagudo, inspirado en las divas de los años 60. Es estilizado, sofisticado y se complementa con pestañas postizas y labios en tonos neutros o vino para un efecto retro-moderno.	{}
8b5520b3-8b38-42c1-8555-bec16dfc5bdc	Maquillaje completo de alto impacto con base de cobertura completa, contouring marcado, iluminador intenso, ojos ahumados con glitter y labios definidos. Está pensado para resistir toda la noche en celebraciones de gala, premiaciones y fiestas donde el glamour es protagonista.	{}
40ad87e9-cd6c-41e5-b3b9-c592a632888c	Look nupcial atemporal con piel luminosa, ojos en tonos neutros y un labio rosado o nude que no compita con el vestido. Es resistente al llanto, sudor y horas de ceremonia, y queda perfecto en fotografías profesionales gracias a su balance entre cobertura y naturalidad.	{}
5c563237-7d47-4118-bffe-fa197ad248ac	Técnica que define con precisión el pliegue del párpado utilizando un color contrastante, creando un efecto visual de mayor profundidad y dramatismo. Es muy técnica, requiere paciencia y resulta muy fotogénica, especialmente popular en bodas, fiestas y sesiones de retrato glam.	{}
8bfa22a4-8e69-4c9b-9003-152c650c7a3c	Propuesta artística para festivales de música, carnavales y fiestas temáticas, con uso de glitter facial, gemas adhesivas, líneas de color en pómulos y delineados creativos. Es lúdica, libre y se ajusta totalmente al concepto de la fiesta o el outfit elegido.	{}
baeda0bd-b086-4be6-b6af-4893718fd2db	Maquillaje preparado específicamente para resistir las luces de estudio y verse impecable a través del lente de cámaras profesionales. Tiene un nivel de cobertura mayor de lo habitual, contouring marcado y productos antibrillo de alta gama para evitar reflejos no deseados.	{}
2d7d8009-1f5a-49a3-ad7d-227253445a04	Look pensado para ceremonias académicas, donde la egresada quiere verse radiante para fotos familiares, redes sociales y la entrega de diploma. Combina piel luminosa, ojos resaltados y labios en tonos rosa, durazno o vino discreto, según el código de la institución.	{}
10093234-2038-4d3d-bbfc-e9c59ea39c98	Maquillaje clásico para los quince años con piel luminosa, sombras en rosados o durazno, pestañas postizas naturales y labios en tono rosa suave. Realza la juventud sin envejecer el rostro, y queda perfecto con el vestido tradicional y la sesión fotográfica del evento.	{}
cda1f97e-b867-4d25-9afb-cf35bcf1b420	Tratamiento que alisa y reorganiza los pelos de la ceja en una dirección uniforme hacia arriba, mediante una solución reestructurante. El resultado es una ceja peinada, voluminosa y con efecto laminado tipo soap brows, que dura entre cuatro y seis semanas.	{}
67a414dc-d329-4599-bd35-d68663e604b6	Técnica semipermanente de pigmentación que crea un efecto de ceja maquillada con sombra suave y degradado natural. Dura entre uno y dos años y es ideal para quienes desean despertarse con la ceja siempre lista, sin recurrir a tatuajes con líneas pelo a pelo más agresivas.	{}
2f6ec742-fab8-4fd1-b7f8-dad81a440776	Tinte de alta intensidad que define profundamente la ceja, ideal para clientas con cabello oscuro y rasgos marcados. Es perfecto para sesiones fotográficas, eventos formales y como complemento del maquillaje de noche o de novia que requiere mayor presencia en la mirada.	{}
34e273fb-4b01-4f65-ad68-8234ae54291e	Aplicación de henna formulada con tonos más profundos y técnicas adaptadas para pieles morenas y oscuras, en las que los tintes claros no contrastan adecuadamente. El resultado es una ceja perfectamente visible, definida y armónica con el subtono natural de la piel.	{}
baf6e9bf-2b17-4d6f-af61-01d1f2f4c79d	Técnica de depilación que utiliza cera tibia o fría para retirar los pelos sobrantes de la ceja en una sola pasada, dejando un acabado limpio y duradero. Es rápido, eficaz y permite definir líneas precisas, aunque puede ser ligeramente irritante para pieles sensibles.	{}
b1864cd8-3cb9-41bb-82d1-11c0c72095e8	Depilación pelo por pelo realizada exclusivamente con pinza profesional, garantizando un control total sobre cada pelo retirado. Es la técnica más recomendada para mantenimientos periódicos entre diseños y para clientas que prefieren evitar la cera o el hilo.	{}
88943673-4d77-48a6-9533-09be35ccd966	Limpieza discreta de cejas en hombres, retirando únicamente los pelos del entrecejo y los que crecen claramente fuera de la línea natural, sin alterar la forma ni el grosor original. Es un servicio cada vez más demandado por hombres que cuidan su imagen sin querer un acabado obviamente diseñado.	{}
ea98e387-f9db-4bbf-bdbf-52256515e3ce	Versión avanzada del lifting que incorpora keratina hidrolizada en el proceso para nutrir y reparar la pestaña mientras se riza. Es ideal para pestañas debilitadas, finas o dañadas por el uso prolongado de extensiones, y deja un acabado suave y saludable.	{}
0b371afb-c3fe-4b08-9373-e99234eee377	Técnica avanzada que aplica abanicos hechos a mano de varias extensiones ultrafinas sobre cada pestaña natural, creando un efecto de gran volumen y densidad. Es ideal para clientas que buscan una mirada impactante y muy fotogénica para eventos o redes sociales.	{}
2e4fdb22-9719-47e3-bff7-bc1f33ae75b8	Aplicación de tinte oscuro sobre las pestañas naturales para intensificar su color, simulando el efecto de máscara de pestañas permanente. Dura entre cuatro y seis semanas y es ideal para clientas con pestañas claras que se sienten desnudas sin maquillaje.	{}
103662be-c20e-40c0-b653-2bd20e21eb3d	Servicio combinado que aplica primero el lifting para rizar la pestaña desde la raíz y posteriormente el tinte para intensificar su color. Es la combinación más vendida porque potencia ambos efectos: pestañas más largas, curvadas y oscuras en una sola sesión.	{}
3c89288e-b119-4e3c-bccd-f372521c63bc	Aplicación de tinte profesional en toda la cabellera para conseguir un castaño uniforme y luminoso. Es el color más solicitado por su versatilidad: favorece prácticamente a cualquier tipo de piel y sirve como base sobre la que se pueden realizar futuros trabajos de mechas o balayage.	{}
b225d3fd-1858-478e-9359-1fed8683655a	Tintura intensa que cubre el cabello completo con un negro profundo y brillante, ideal para clientas con rasgos marcados o que buscan un look elegante y dramático. Se recomienda valorar bien el tono natural de la piel antes de aplicarlo, pues es uno de los colores más difíciles de retirar.	{}
58f6057d-93fc-4a2e-9e53-4355da4b1f18	Coloración integral en tonos rubios cálidos con reflejos dorados que aportan luminosidad y un aspecto solar al cabello. Generalmente requiere una decoloración previa si se parte de una base oscura, y se complementa con tratamiento hidratante para preservar la salud del cabello.	{}
81f5f8f3-9daa-4f6e-bee1-cc6b8e8a5d0a	Coloración vibrante en tonos rojos cobrizos o caoba que aporta carácter y personalidad a la imagen. Es uno de los colores más demandados en otoño e invierno por su calidez visual, y favorece especialmente a pieles claras y a clientas con ojos verdes o miel.	{}
189d4957-bfe5-495c-8d59-58e80bf38678	Color de tendencia que combina la base castaña con reflejos cálidos en tonos cacao, caramelo y avellana. Aporta dimensión y movimiento al cabello sin necesidad de mechas tradicionales, y es uno de los favoritos para temporadas frías por su aire goloso y reconfortante.	{}
dacd96f3-f2d9-4d1e-a5e9-ea28fb9210e8	Técnica de coloración a mano alzada en la que se pintan mechones seleccionados de forma irregular para imitar el aclarado natural del sol. Genera un efecto degradado muy natural, exige menos mantenimiento que las mechas tradicionales y permite espaciar los retoques varios meses.	{}
d577fce8-f45c-4517-85aa-e2481444f941	Mechas que arrancan a media altura del cabello y se intensifican hacia las puntas, simulando el aclarado producido por el sol y el agua de mar. Son ideales para verano, dan un efecto natural y soleado y combinan especialmente bien con bases castañas claras y rubias oscuras.	{}
bca42bbf-5c5b-4866-880c-40b721d806b6	Mechas ultra finas y muy próximas a la raíz que imitan los aclarados naturales del cabello infantil. Aportan luminosidad uniforme y un acabado delicado, sin contrastes pronunciados. Es la técnica favorita para iluminar el rostro y dar vida a cabelleras opacas.	{}
82f57c99-56f2-455c-a71a-c5627bc8a618	Mechas tradicionales realizadas con papel aluminio que permiten levantar varios niveles de tono con precisión y uniformidad. Son ideales para clientas que buscan un cambio notorio y mucho contraste entre la base y las mechas, con un acabado más estructurado que el balayage.	{}
0c1d6e79-1e04-4707-a75b-f0c73bcb89f6	Técnica que aclara únicamente los mechones que enmarcan el rostro, generando un efecto luminoso similar al de un iluminador facial. Es ideal como complemento de un balayage o para clientas que buscan un cambio sutil pero impactante sin alterar el resto del cabello.	{}
a75a373c-ff71-49eb-8d47-097efc230ed8	Híbrido entre el balayage tradicional y los highlights con foil: las mechas se pintan a mano alzada al estilo balayage y luego se envuelven en papel aluminio para conseguir un aclarado más intenso. Es ideal para clientas con cabello oscuro que desean balayage con mayor luminosidad.	{}
a1b794d2-d9a6-40c5-9bef-ecc3b6c82210	Aplicación de tinte únicamente en la zona de la raíz para igualar el color con el resto del cabello previamente teñido. Se realiza cada cuatro a seis semanas según la velocidad de crecimiento, y mantiene la coloración integral siempre uniforme y prolija.	{}
e00d957a-cfa0-4a6c-af2f-29c2c7073e40	Servicio enfocado en cubrir las canas que aparecen en la zona de la raíz entre coloraciones completas. Utiliza tinte de máxima concentración con tiempo de pose calibrado y es uno de los servicios más recurrentes tanto en clientas como en clientes con cabello cano.	{}
17367e72-bf24-4481-967b-1b52348a2065	Técnica que difumina suavemente el límite entre la raíz natural y las mechas o coloración previa, generando una transición orgánica que prolonga la vida útil del color. Es ideal entre balayages y reduce notoriamente la frecuencia de retoques.	{}
37da3892-1b7a-4b1e-9acc-11257da93bb5	Coloración en tonos rosados pasteles aplicada sobre cabello previamente decolorado a una base muy clara. Es uno de los colores fantasía más solicitados por su feminidad y aire soñador, y suele combinarse con baños de color para refrescar el tono cada pocas semanas.	{}
3ed1830d-0702-49d9-99db-e4a01a2855fe	Tonalidad fría y romántica en tonos lila y lavanda que aporta un aire mágico y editorial al cabello. Es uno de los colores fantasía más fotogénicos y favorece especialmente a clientas con piel clara y rasgos delicados.	{}
8af51ef0-29a0-49d3-9b51-56a72d560565	Mechas de color fantasía ocultas debajo de las capas superiores del cabello, que solo se revelan al recogerlo o moverlo. Es perfecto para clientas que quieren explorar el color sin comprometer la apariencia profesional o conservadora del look principal.	{}
7698f1a0-88b4-4f47-a4fa-d9ea7afb7690	Aclarado integral del cabello mediante polvo decolorante con el objetivo de levantar varios niveles de tono. Es el paso previo necesario para coloraciones rubias muy claras o color fantasía, y debe realizarse con técnica precisa para preservar la fibra capilar.	{}
9e005b7a-476e-446f-ab21-61cd28f57ec1	Decoloración intensiva que lleva el cabello al nivel más alto de aclarado posible, dejando una base ultra clara para conseguir el codiciado rubio platino. Es uno de los servicios más exigentes técnicamente y requiere cabello en buenas condiciones para obtener un resultado sano.	{}
20ce2b1a-4db9-47de-80f0-0c88fc43d366	Matiz que aporta tonos cenizos y grisáceos al cabello previamente aclarado, generando un acabado frío y moderno muy demandado en tendencias actuales. Es ideal para clientas con piel neutra o fría y para combinaciones con balayage frío.	{}
ca2627bb-f561-43ac-b3b0-4270b72a5467	Matiz en tonos cobrizos o cálidos que potencia los reflejos rojos y caramelo del cabello, especialmente en bases castañas o rubias oscuras. Aporta dimensión y un aire luminoso, ideal para temporadas frías o para refrescar coloraciones cálidas existentes.	{}
c2fd4d48-413e-439a-87bb-8eee012185e1	Fusión entre el shag setentero y el mullet moderno, con capas cortas y voluminosas en la parte superior y largos desfilados en las puntas. Es uno de los cortes más virales en redes sociales gracias a su estética desenfadada y editorial. Realza la textura natural del cabello sin necesidad de mucho producto.	{"df": ""}
d448ddd7-9923-4914-8552-762427499f1e	Corte en capas largas y desordenadas que mezcla el shag de los años 70 con el mullet moderno. Tiene mucho volumen en la parte superior y capas largas y sueltas abajo. Es la tendencia más viral de los últimos años en redes sociales, adoptada por hombres y mujeres por igual.	{"df": ""}
10930c4c-52a5-49cb-91ee-36eee5f80cae	Recogido elaborado y altamente personalizable diseñado especialmente para novias, que puede incluir trenzas, ondas, torsiones y accesorios florales o de cristal. Cada updo se adapta al vestido, al velo y al estilo de la novia, y suele requerir una prueba previa para garantizar el resultado.	{"df": ""}
916ce225-f36a-49be-9dfd-eb6f73b0a4e9	Los laterales y la nuca van rapados o muy cortos, mientras que la parte superior conserva mucho largo, creando un contraste fuerte de volumen. Es uno de los estilos más populares de la última década por su adaptabilidad: el pelo de arriba puede peinarse hacia atrás, a un lado, en moño o con textura.	{"df": ""}
1b47ed09-71a3-491a-ba28-c874a96ef714	Uñas postizas prefabricadas y decoradas a medida que se aplican con pegamento o pestañas adhesivas y duran varios días. Son una alternativa rápida y reutilizable a las uñas esculpidas, ideales para eventos puntuales o para quienes no quieren comprometerse con un servicio largo.	{"df": ""}
3a3a5f5e-758c-4670-b018-92f60816b9bb	Diseño que imita las vetas naturales del mármol mediante la mezcla de varios esmaltes con técnicas de agua, alcohol o pincel fino. Cada uña es única y aporta un acabado lujoso y sofisticado, especialmente popular en tonos blancos, negros y nude con detalles dorados.	{"df": ""}
53d4c544-62e4-4063-8a75-931b4e4cbc98	Técnica en la que el cabello se divide en secciones y se tuerce en dos hebras; al soltarse, revela rizos muy definidos y con volumen. El resultado varía según el grosor de los twists y el producto usado. Es uno de los estilos de cabello natural más usados por su resultado impresionante sin calor.	{"df": ""}
80ed543e-2e35-435a-91b0-9b86a475f5b8	Técnica en la que el cabello se divide en secciones y se tuerce en dos hebras; al soltarse, revela rizos muy definidos y con volumen. El resultado varía según el grosor de los twists y el producto usado. Es uno de los estilos de cabello natural más usados por su resultado impresionante sin calor.	{"df": ""}
7a7915ef-8560-47b2-ab4d-11c20159d1d0	Dos trenzas francesas simétricas que parten desde la frente y caen por la espalda, dando un aire deportivo, juvenil y muy práctico. Son muy populares en deportistas, niñas en edad escolar y mujeres que buscan mantener el cabello fuera del rostro durante todo el día.	{"df": ""}
5343cdfc-5e68-4611-863b-42118cda1418	Conjunto de trenzas pequeñas o medianas decoradas con ligas de colores, broches, perlas o cintas, pensadas especialmente para niñas. Son protectoras del cabello, duran varios días y son una excelente opción para fiestas, presentaciones escolares o el día a día.	{"df": ""}
f35a1922-7bc4-404d-a0e6-5ab50da00297	Variante de la trenza francesa en la que los mechones se cruzan por debajo en lugar de por encima, lo que hace que la trenza sobresalga del cuero cabelludo. Da un efecto tridimensional muy llamativo y se usa frecuentemente como base de peinados elaborados y recogidos.	{"df": ""}
e5cbc29d-a208-4b5a-9428-ee6be3c09876	Trenza tejida desde la coronilla hacia la nuca en la que se van añadiendo mechones laterales en cada cruce. Es elegante, ordenada y muy versátil, ideal tanto para entornos casuales como formales. Es además una excelente opción para mantener el cabello recogido durante actividades físicas.	{"df": ""}
90b48a59-509f-4738-b5f0-644c89f32c84	Trenza realizada con dos mechones que se van entrelazando en pequeñas secciones, formando un patrón visual parecido a una espina de pescado. Es delicada, romántica y muy fotogénica, perfecta para bodas estilo boho, festivales y eventos al aire libre.	{"df": ""}
50b71da3-e09f-4a62-90d5-209de755d90a	Trenza realizada con dos mechones que se van entrelazando en pequeñas secciones, formando un patrón visual parecido a una espina de pescado. Es delicada, romántica y muy fotogénica, perfecta para bodas estilo boho, festivales y eventos al aire libre.	{"df": ""}
5b1d193f-af1d-46bf-978f-cd4e63b489fd	Trenza que rodea la cabeza como una diadema natural, dando un aspecto regio y bohemio al mismo tiempo. Puede hacerse con una sola trenza larga enrollada o con dos trenzas más pequeñas unidas. Es un peinado favorito en bodas campestres y festivales por su feminidad atemporal.	{"df": ""}
ae241173-32b8-495b-bbbc-b61dae6e6870	Trenza francesa modificada en la que algunos mechones se dejan caer libremente en lugar de incorporarse a la trenza, formando una 'cascada' de cabello suelto. Es uno de los peinados semirrecogidos más románticos y se utiliza con frecuencia en bodas y graduaciones.	{"df": ""}
57556f61-38a8-45c6-a555-c5eb19dbfe8f	Aplicación de productos especializados con queratina, calcio o biotina que refuerzan la lámina ungueal y previenen la fragilidad, descamación o quiebre. Se recomienda como tratamiento de varias sesiones y es ideal para uñas debilitadas por el uso prolongado de acrílicos o gel.	{"df": ""}
372fae57-3e5c-455a-8f03-35af12e9ed8d	Matiz en tonos cobrizos o cálidos que potencia los reflejos rojos y caramelo del cabello, especialmente en bases castañas o rubias oscuras. Aporta dimensión y un aire luminoso, ideal para temporadas frías o para refrescar coloraciones cálidas existentes.	{"df": ""}
c87b7c6c-1f4d-4fcc-98bc-4e893716cb9e	Aplicación de tinte oscuro sobre las pestañas naturales para intensificar su color, simulando el efecto de máscara de pestañas permanente. Dura entre cuatro y seis semanas y es ideal para clientas con pestañas claras que se sienten desnudas sin maquillaje.	{"df": ""}
cb5dd3b3-e6f8-4fd0-99c0-18b5074e70e6	Aplicación de tinte oscuro sobre las pestañas naturales para intensificar su color, simulando el efecto de máscara de pestañas permanente. Dura entre cuatro y seis semanas y es ideal para clientas con pestañas claras que se sienten desnudas sin maquillaje.	{"df": ""}
ef9c9de5-18df-442a-a2e4-18d32848278f	Aplicación de tinte oscuro sobre las pestañas naturales para intensificar su color, simulando el efecto de máscara de pestañas permanente. Dura entre cuatro y seis semanas y es ideal para clientas con pestañas claras que se sienten desnudas sin maquillaje.	{"df": ""}
b79bd8e4-d8d9-43ef-b779-c11bdc1d53c5	Servicio combinado que aplica primero el lifting para rizar la pestaña desde la raíz y posteriormente el tinte para intensificar su color. Es la combinación más vendida porque potencia ambos efectos: pestañas más largas, curvadas y oscuras en una sola sesión.	{"df": ""}
583d3415-1133-43be-8d2a-41d74a010d67	Flequillo natural y texturizado que cae sobre la frente sin usar gel ni productos fuertes. Es un corte moderno pensado para niños entre 3 y 10 años, con apariencia desenfadada y juvenil. Los laterales van ligeramente cortos y la parte superior conserva movimiento y volumen.	{"df": ""}
4f609b92-e33f-41e5-a53b-f71f665c45cd	Corte corto con la parte superior texturizada y con movimiento, generalmente con flequillo hacia adelante y lados con fade o taper. Es el corte de tendencia más pedido actualmente en Europa y Latinoamérica. Muy fácil de mantener y estilizar con un poco de cera o sal marina.	{"df": ""}
b579399b-6b04-403a-8f5f-4be1bc18bcd4	Degradado en las sienes acompañado de una línea grabada con la máquina que define con precisión el borde del cabello. Es el sello de identidad de la barbería urbana latina y caribeña. La línea puede ser recta o tener diseños geométricos más elaborados según el cliente.	{"df": ""}
76b3593d-55df-4368-985a-c8640d013a87	Taper suave en nuca y sienes con largo natural en la parte superior, sin fade pronunciado. Es el corte más solicitado por padres que quieren algo limpio, fácil de mantener y apropiado para el colegio. Funciona muy bien en niños con cabello liso o ligeramente ondulado de cualquier tono.	{"df": ""}
97408357-2996-46c3-a3da-650701cf37cc	Degradado enfocado exclusivamente en las sienes (temples), que limpia y define el perímetro facial sin alterar demasiado los laterales. Es un complemento frecuente de otros cortes para dar un acabado más cuidado y elegante al contorno del rostro.	{"df": ""}
9f692a5f-b28a-4ad3-afb8-9d762111f127	Degradado progresivo y suave que sigue la línea natural del cuello y las sienes. A diferencia del fade tradicional, el taper es más gradual y conservador, ideal para cabellos finos y lisos y ambientes de trabajo formales donde se necesita un look prolijo pero no exagerado.	{"df": ""}
0d28b2bf-a900-47d8-8f32-bb22d160bceb	Degradado progresivo y suave que sigue la línea natural del cuello y las sienes. A diferencia del fade tradicional, el taper es más gradual y conservador, ideal para cabellos finos y lisos y ambientes de trabajo formales donde se necesita un look prolijo pero no exagerado.	{"df": ""}
4b0d898c-f3ff-411d-9b4a-317cd4f0e301	Técnica rápida para definir rizos en cabello afro usando una esponja con agujeros que al frotarse sobre el pelo húmedo genera pequeños coils compactos y uniformes. Es muy popular para cuidado diario del cabello natural y funciona tanto en adultos como en niños desde los primeros años.	{"df": ""}
aa89b411-6a4f-4c57-9ffe-cb93b0470051	Dos moños altos ubicados simétricamente a cada lado de la cabeza, con un aire juvenil, festivalero y muy fotogénico. Es un peinado popular en festivales de música, fiestas temáticas y entre adolescentes y niñas. Puede combinarse con trenzas pegadas a los lados para mayor estilo.	{"df": ""}
4011fa6f-9632-493e-ac41-7f94032e722a	Moño tirante y alto ubicado en la coronilla, inspirado en el chonmage tradicional japonés de los samuráis. Transmite disciplina, fuerza y estética oriental. Funciona mejor con cabello liso y grueso, y ha ganado popularidad global gracias al anime y la cultura japonesa contemporánea.	{"df": ""}
8b3e16fc-7d02-450a-8542-afa12e616900	Técnica que difumina suavemente el límite entre la raíz natural y las mechas o coloración previa, generando una transición orgánica que prolonga la vida útil del color. Es ideal entre balayages y reduce notoriamente la frecuencia de retoques.	{"df": ""}
34d7f72b-7bf9-4cfb-9372-d68cc64b937b	Técnica de peinado para cabellos rizados naturales que utiliza productos específicos (cremas, geles, mousses) y un difusor para definir cada rizo sin generar frizz. Realza la textura natural y es la base del movimiento curly girl, que promueve el cuidado y aceptación del cabello rizado.	{"df": ""}
9a139576-393b-4ffc-a4ff-59f8b35a9335	Corte por capas muy desfiladas con flequillo abierto y mucho movimiento, originario de los años 70. Aporta volumen en la coronilla y aligera las puntas, dando un look bohemio y rockero. Funciona especialmente bien en cabellos con onda natural y favorece a rostros ovalados y alargados.	{"df": ""}
e37a49c7-43c8-41c6-956b-d0e4a7714f0f	El cabello se peina con una raya marcada a un lado, creando un look clásico, ordenado y elegante. Puede hacerse con el cabello liso, ondulado o con rizo leve. Es el estilo más recurrente en ambientes corporativos y formales, y combina perfectamente con barba bien arreglada.	{"df": ""}
2a602c71-3584-47dd-9d34-d6353eb7890c	Aplicación de tinte únicamente en la zona de la raíz para igualar el color con el resto del cabello previamente teñido. Se realiza cada cuatro a seis semanas según la velocidad de crecimiento, y mantiene la coloración integral siempre uniforme y prolija.	{"df": ""}
96234dc1-97f5-444a-bd14-2afc6d497214	Variación más cálida del smokey clásico que utiliza tonos dorados, cobrizos y bronce para iluminar la mirada. Favorece especialmente a ojos verdes, miel y marrones, y aporta un acabado glam ideal para cenas, eventos formales y salidas elegantes.	{"df": ""}
f74e8fac-f734-476b-bbb7-447fee1af046	Maquillaje icónico de noche con sombras negras y grises difuminadas alrededor del ojo, creando un efecto ahumado e intenso. Es el favorito para salidas nocturnas, conciertos y citas, y se acompaña de una piel impecable y labios neutros para no competir con la mirada.	{"df": ""}
1196ed14-407f-4867-9a65-bf6eb0d133e5	Todo el cabello se peina hacia atrás usando gel, pomada o aceite, dejando la frente completamente despejada. Da un look sofisticado, dominante y cinematográfico. Funciona especialmente bien con cabello grueso y con ondas naturales, y es un clásico del estilo italiano y latino.	{"df": ""}
ded54866-15d4-48cf-9872-4f0f3262956f	El degradado llega hasta la piel, dejando los laterales completamente rapados sin ningún pelo visible. Es el acabado más limpio y radical de los fades, muy popular en barberías urbanas y en combinación con cualquier estilo en la parte superior.	{"df": ""}
395de468-db5a-45cd-b144-25b1f69339db	Servicio enfocado en cubrir las canas que aparecen en la zona de la raíz entre coloraciones completas. Utiliza tinte de máxima concentración con tiempo de pose calibrado y es uno de los servicios más recurrentes tanto en clientas como en clientes con cabello cano.	{"df": ""}
8fe4517a-8542-401f-8a51-d326947959c6	Peinado infantil semirrecogido inspirado en princesas de cuentos: media coleta con ondas, decorada con tiaras, lazos, flores o pequeños broches. Es muy solicitado para fiestas de cumpleaños, primeras comuniones y sesiones fotográficas de niñas, y se adapta al vestido y a la temática del evento.	{"df": ""}
3e0509e1-4c56-473d-82dc-f3048ce6b04a	Recogido suave en la parte de atrás de la cabeza con mechones ondulados sueltos y volumen estratégico en la coronilla. Es uno de los peinados nupciales más solicitados porque aporta un aire romántico, vintage y femenino que combina con velos, tiaras y todo tipo de accesorios.	{"df": ""}
b4c21127-3b1c-4f4e-a617-19a410c6e605	Corte con mucho volumen en la parte frontal peinado hacia arriba y atrás, con lados más cortos. Es una fusión entre el pompadour y el crop moderno. Aporta altura al rostro y es muy popular en el estilo rockabilly contemporáneo y en la moda masculina europea.	{"df": ""}
dd3bb4b0-969c-4d55-b6ab-98f1ef3b89b7	El cabello superior es largo y se peina completamente hacia atrás y arriba logrando gran volumen y altura, mientras los lados van cortos o con fade. Símbolo del rock and roll de los años 50, hoy es un clásico reinventado que transmite carácter y estilo retro-moderno.	{"df": ""}
ac8c5a21-174b-470a-a085-13e512945078	Versión más suave del pixie tradicional, con suficiente largo en la parte superior para peinarse a un lado o hacia atrás. Es ideal para quienes quieren animarse a un corte corto sin un cambio tan radical, y se adapta a entornos profesionales con un look moderno y femenino.	{"df": ""}
81c51ab5-2b05-4014-973e-35863cf42f2e	Corte corto y desenfadado que deja la nuca y los costados muy cortos, con algo más de largo y textura en la coronilla y el flequillo. Es un corte de alto impacto que resalta los rasgos del rostro, especialmente los ojos y los pómulos. Requiere visitas frecuentes a la peluquería para mantener la forma.	{"df": ""}
2927f93d-8acd-4c6d-a225-ded180c10b1a	Ondas suaves y naturales conseguidas con permanente de bajo impacto, técnica popularizada en Corea del Sur. A diferencia del rizo marcado occidental, el perm coreano da movimiento y volumen orgánico al cabello liso. Muy solicitado en hombres asiáticos y latinos con cabello fino.	{"df": ""}
8c81fa94-7490-4819-91db-86f9231cc05c	Limpieza discreta de cejas en hombres, retirando únicamente los pelos del entrecejo y los que crecen claramente fuera de la línea natural, sin alterar la forma ni el grosor original. Es un servicio cada vez más demandado por hombres que cuidan su imagen sin querer un acabado obviamente diseñado.	{"df": ""}
ef1ea1ba-37a8-4e5b-a8f8-1fd74d7d9854	Depilación pelo por pelo realizada exclusivamente con pinza profesional, garantizando un control total sobre cada pelo retirado. Es la técnica más recomendada para mantenimientos periódicos entre diseños y para clientas que prefieren evitar la cera o el hilo.	{"df": ""}
ce3f1722-725a-4bfc-9498-25813488fd7b	Técnica de depilación que utiliza cera tibia o fría para retirar los pelos sobrantes de la ceja en una sola pasada, dejando un acabado limpio y duradero. Es rápido, eficaz y permite definir líneas precisas, aunque puede ser ligeramente irritante para pieles sensibles.	{"df": ""}
44561bd8-cf1d-4417-a274-c64edae73492	Peinado retro inspirado en las pin-ups de los años 40 y 50, con flequillo enrollado tipo victory roll, ondas marcadas y, frecuentemente, un pañuelo de tela como accesorio. Es muy usado en bodas vintage, sesiones temáticas y eventos rockabilly por su carácter y feminidad clásica.	{"df": ""}
24c513b4-a0d5-4d53-8121-f96ca29a465c	Servicio integral que incluye remojo aromaterapéutico, exfoliación con sales o azúcar, mascarilla hidratante, masaje relajante de pierna y aplicación de esmalte. Es la experiencia premium del cuidado del pie y se recomienda al menos una vez al mes para mantener la salud y suavidad de la piel.	{"df": ""}
2503871a-cdd2-4372-b30f-aec4c0cb2f98	Aplicación de esmalte de gel en las uñas de los pies, con un acabado brillante y resistente que dura entre cuatro y seis semanas. Es ideal para quienes viajan, hacen deporte o simplemente quieren olvidarse del retoque del esmalte por más de un mes.	{"df": ""}
f69a97a8-0fed-4ced-8cf2-2dfe4e69da44	Versión del clásico francés aplicada en los pies, con la uña en tono natural y la punta blanca. Es una opción elegante y muy solicitada para temporadas cálidas, viajes a la playa, vacaciones y bodas en sandalias. Combina con cualquier color de piel y tipo de uña.	{"df": ""}
8796158b-f3e9-49f5-a73d-d677f099b60c	Pedicure tradicional acompañado de decoraciones artísticas en una o varias uñas: flores, líneas, piedras, glitter o diseños temáticos. Es muy popular en temporada de playa, vacaciones y bodas, donde los pies son protagonistas con sandalias abiertas.	{"df": ""}
6ac6c691-b42f-4f21-b46e-5733793e3096	Ondas grandes, definidas y muy brillantes peinadas hacia un solo lado, inspiradas en las divas del cine clásico de Hollywood. Es un peinado de alfombra roja por excelencia, y exige una técnica precisa de plancha o rulos para lograr la uniformidad de las ondas y el acabado glossy.	{"df": ""}
d3041603-51ae-4f86-a7fa-eaddd42e81b1	Técnica que utiliza la plancha para crear ondas marcadas en forma de S a lo largo del cabello, con un acabado moderno y geométrico. Es muy popular gracias a las redes sociales y favorece especialmente cabellos largos y de densidad media, dando un efecto editorial sin necesidad de tenacilla.	{"df": ""}
321317a7-2e59-4b46-8acd-d17d28aad58c	Maquillaje aparentemente inexistente que disimula imperfecciones, ilumina la piel y resalta sutilmente los rasgos para que se vean naturales. Requiere mucha técnica para lograr ese efecto 'sin maquillaje pero mejor', y es uno de los acabados más solicitados gracias a redes sociales y la estética minimalista.	{"df": ""}
c3cef21d-d2a4-4f52-90bb-70d0ba4f99a3	Decoración basada en líneas, triángulos, cuadrículas y formas geométricas conseguidas con cinta adhesiva, pinceles finos o stickers. Tiene un aire moderno, minimalista y editorial, y es la opción favorita de quienes buscan un diseño contemporáneo sin recargar las uñas.	{"df": ""}
f36cc402-d175-4036-8375-b4eff730e6eb	Los lados de la cabeza van completamente rapados y se deja una banda central de pelo que puede pararse en punta con fijador. Originado en la cultura nativa americana y popularizado por el punk en los años 70. Hoy existen versiones más suaves y estilizadas para uso cotidiano.	{"df": ""}
5d77b968-2326-467d-ae04-f4321583816e	Los lados de la cabeza van completamente rapados y se deja una banda central de pelo que puede pararse en punta con fijador. Originado en la cultura nativa americana y popularizado por el punk en los años 70. Hoy existen versiones más suaves y estilizadas para uso cotidiano.	{"df": ""}
79127b8b-437f-49cb-9ce4-71ae6f719fa0	El degradado arranca a la mitad lateral de la cabeza, creando un contraste moderado entre los lados y la parte superior. Es la opción preferida en el estilo urbano y streetwear, y combina perfectamente con diseños grabados o cortes texturizados arriba.	{"df": ""}
77b586a1-25bd-41b9-9f71-cdd7591f4554	Decoración manual de las uñas con motivos florales pintados a mano alzada o aplicados con sellos y pinceles finos. Puede ir desde flores discretas en una sola uña hasta diseños botánicos completos en todas. Es muy popular en primavera, verano y para bodas con temática natural.	{"df": ""}
8cae9d22-d3c1-41a4-b3e3-58f440d6c0d9	El cabello cae uniforme alrededor de la cabeza con un flequillo recto que rodea toda la frente, dando forma de hongo. Es un corte que surgió en los 60s, pasó por los 90s y hoy está en plena tendencia gracias a la moda Y2K y la influencia asiática. Favorece rostros ovalados y pequeños.	{"df": ""}
36b538c1-658f-42f5-8cb2-6599fd415389	Reinterpretación femenina del mullet ochentero: corto en la parte superior y los lados, con largo desfilado en la nuca. Hoy se usa con mucho carácter editorial y se ha convertido en favorito de la generación Z por su actitud disruptiva y andrógina.	{"df": ""}
b7453af2-c54e-4265-98ef-680fcfdeec97	Recogido pulido a la altura de la nuca, con el cabello peinado completamente hacia atrás o con raya al medio. Es uno de los peinados más solicitados para bodas, galas y eventos protocolares por su sobriedad y limpieza visual. Combina con cualquier escote y favorece todos los rostros.	{"df": ""}
2c3405ec-695d-424d-ad65-46cf321352b4	Recogido tirante y perfectamente pulido en lo alto de la cabeza, inspirado en la disciplina del ballet. Aporta un aire elegante, sofisticado y atlético, y es muy usado en eventos formales, sesiones fotográficas y clases de danza. Suele acompañarse de fijador para garantizar firmeza durante horas.	{"df": ""}
86a34830-f8c5-4141-8752-9581e4e6b2c3	La cresta central del mohawk va trenzada en lugar de parada, fusionando la estética punk con técnicas africanas de trenzado. Los lados pueden ir con fade, cornrows o también trenzados. Es un estilo con mucha identidad cultural y creatividad, muy visto en comunidades afrolatinas.	{"df": ""}
ba05982a-d7e5-4e09-8f8a-bad0a4fa45fb	Técnica semipermanente de pigmentación que crea un efecto de ceja maquillada con sombra suave y degradado natural. Dura entre uno y dos años y es ideal para quienes desean despertarse con la ceja siempre lista, sin recurrir a tatuajes con líneas pelo a pelo más agresivas.	{"df": ""}
c8b40eee-c6a9-4880-b986-b491fa00aeae	Moño desordenado con mechones sueltos enmarcando el rostro, que da una apariencia relajada pero estudiada. Es el peinado favorito para el día a día porque se logra en pocos minutos, pero también se adapta a bodas estilo boho cuando se acompaña de flores o accesorios florales.	{"df": ""}
b2529b64-2c42-45e7-965a-91bc5a3bfc24	Maquillaje preparado específicamente para resistir las luces de estudio y verse impecable a través del lente de cámaras profesionales. Tiene un nivel de cobertura mayor de lo habitual, contouring marcado y productos antibrillo de alta gama para evitar reflejos no deseados.	{"df": ""}
3a6083ab-fd66-4101-a79a-94ec73497314	Look pensado para ceremonias académicas, donde la egresada quiere verse radiante para fotos familiares, redes sociales y la entrega de diploma. Combina piel luminosa, ojos resaltados y labios en tonos rosa, durazno o vino discreto, según el código de la institución.	{"df": ""}
ff19f587-d34a-4c92-921f-09cd8c7e3663	Maquillaje cuya piel se mantiene en estilo natural pero los ojos reciben mayor protagonismo con sombras suaves, pestañas postizas individuales y delineado discreto. Es la combinación favorita de quienes quieren resaltar la mirada sin recargar el resto del rostro.	{"df": ""}
3bbce633-c96a-4abb-a056-2a7a9ec5e254	Maquillaje completo de alto impacto con base de cobertura completa, contouring marcado, iluminador intenso, ojos ahumados con glitter y labios definidos. Está pensado para resistir toda la noche en celebraciones de gala, premiaciones y fiestas donde el glamour es protagonista.	{"df": ""}
a414576d-ee28-437f-9d7f-3585d5a84d5c	Mechas de color fantasía ocultas debajo de las capas superiores del cabello, que solo se revelan al recogerlo o moverlo. Es perfecto para clientas que quieren explorar el color sin comprometer la apariencia profesional o conservadora del look principal.	{"df": ""}
1317c213-d655-419a-b9ae-cf50ddcef0b9	Mechas que arrancan a media altura del cabello y se intensifican hacia las puntas, simulando el aclarado producido por el sol y el agua de mar. Son ideales para verano, dan un efecto natural y soleado y combinan especialmente bien con bases castañas claras y rubias oscuras.	{"df": ""}
43fab03f-3cdb-422e-9fdb-1a7bb2c3c256	Maquillaje clásico para los quince años con piel luminosa, sombras en rosados o durazno, pestañas postizas naturales y labios en tono rosa suave. Realza la juventud sin envejecer el rostro, y queda perfecto con el vestido tradicional y la sesión fotográfica del evento.	{"df": ""}
bbd4f37d-b306-4805-954c-34909bbbff73	Look nupcial atemporal con piel luminosa, ojos en tonos neutros y un labio rosado o nude que no compita con el vestido. Es resistente al llanto, sudor y horas de ceremonia, y queda perfecto en fotografías profesionales gracias a su balance entre cobertura y naturalidad.	{"df": ""}
b4d69b61-2fd3-4118-a9b7-3db4d8397140	Maquillaje base para artes escénicas que iguala el tono y resalta los rasgos para que sean visibles desde el público bajo luces de escenario. Es la base sobre la que se construyen caracterizaciones de personaje y se utiliza en obras teatrales, coros, ballet y presentaciones musicales.	{"df": ""}
e108b1a8-c1fc-4359-911e-108fd8bb0219	Matiz que aporta tonos cenizos y grisáceos al cabello previamente aclarado, generando un acabado frío y moderno muy demandado en tendencias actuales. Es ideal para clientas con piel neutra o fría y para combinaciones con balayage frío.	{"df": ""}
26c53196-9cfa-48fb-99d8-4f084f5d4721	Técnica de manicure realizada con tornos eléctricos y fresas profesionales que permite trabajar la cutícula con extrema precisión, dejando un acabado impecable y de larga duración. Requiere un nivel técnico avanzado y es muy demandada por su perfección visual y duración prolongada.	{"df": ""}
dacf3797-67ec-44f1-9809-98892258c106	Propuesta artística para festivales de música, carnavales y fiestas temáticas, con uso de glitter facial, gemas adhesivas, líneas de color en pómulos y delineados creativos. Es lúdica, libre y se ajusta totalmente al concepto de la fiesta o el outfit elegido.	{"df": ""}
aefdfe04-ce7c-43f6-aa7f-2747d203529a	Técnica que define con precisión el pliegue del párpado utilizando un color contrastante, creando un efecto visual de mayor profundidad y dramatismo. Es muy técnica, requiere paciencia y resulta muy fotogénica, especialmente popular en bodas, fiestas y sesiones de retrato glam.	{"df": ""}
714f5737-5beb-481b-897b-641f97d675c7	Servicio infantil con esmaltes hipoalergénicos en colores vibrantes y diseños divertidos: brillos, stickers de personajes, corazones o estrellas. Es ideal para fiestas de cumpleaños, sesiones madre-hija y celebraciones especiales. Se realiza con productos seguros y técnicas suaves.	{"df": ""}
b2c730c6-82e4-40ba-97f3-1c066d02b4f0	Servicio infantil con esmaltes hipoalergénicos en colores vibrantes y diseños divertidos: brillos, stickers de personajes, corazones o estrellas. Es ideal para fiestas de cumpleaños, sesiones madre-hija y celebraciones especiales. Se realiza con productos seguros y técnicas suaves.	{"df": ""}
f6c3ea63-beb4-4ebf-a553-a8d144a5c4f6	Extensiones o esculpidos realizados con gel constructor que se cura con lámpara UV o LED. Son más flexibles y livianas que las acrílicas, ofrecen un acabado muy natural y permiten todo tipo de decoraciones. Ideales para quienes buscan resultados elegantes y duraderos.	{"df": ""}
fbe56dc5-0efb-4311-af05-fb5014af7a8d	Extensiones realizadas con polvo y monómero acrílico que permiten alargar y reforzar la uña natural. Son extremadamente resistentes, admiten cualquier forma (almendra, stiletto, ballerina, cuadrada) y duran semanas con el debido mantenimiento. Es la técnica más popular en salones latinoamericanos.	{"df": ""}
4f9737c9-1515-4a2c-9fef-492bd4a5f437	Dos mechones de cabello se retuercen entre sí a lo largo de toda su extensión. Son más fáciles de hacer que las trenzas, duran varios días y pueden deshacerse para crear un twist out. Muy usados como estilo de transición o de protección en hombres que están creciendo su cabello natural.	{"df": ""}
f5a76ff0-a09d-4ebb-92ba-1ea349b9871d	Los laterales y la nuca se cortan muy cortos o al rape, mientras la parte superior conserva su largo natural sin degradado de transición. Es el corte dominante en Corea del Sur desde mediados de los 2010 y ha trascendido globalmente gracias al K-pop y los dramas coreanos.	{"df": ""}
b4b030c3-7a71-47dc-ba92-db004fcf5f2d	El cabello largo se recoge en un moño alto en la coronilla, dejando el cuello y la nuca despejados. Es práctico, cómodo y tiene un atractivo bohemio-moderno. Puede usarse con cabello totalmente recogido o con algunos mechones sueltos enmarcando el rostro para un look más relajado.	{"df": ""}
d43e114d-6955-47dd-b0c0-2ba3ea6b4463	Versión más larga del bob, llega entre el mentón y los hombros con un corte recto o ligeramente desfilado. Es el punto medio perfecto entre lo corto y lo largo: aporta movimiento, es fácil de mantener y combina con todo tipo de rostros. Una de las tendencias más estables de la última década.	{"df": ""}
22a2ade0-bb42-46bb-afd8-dccc7f02ad30	Dreadlocks completamente maduros y bien definidos que pueden llegar a la espalda o más. Son el resultado de años de crecimiento y mantenimiento. Tienen un peso cultural enorme en tradiciones africanas, jamaicanas y espirituales, y hoy también forman parte del mainstream de la moda global.	{"df": ""}
b0989301-39e1-4774-a538-34b11568e0e3	Dreadlocks en su etapa inicial o media, de longitud por encima de los hombros. El cabello se secciona y se deja compactar de forma natural o con ayuda del crochet. Representan el inicio de un camino de largo plazo con profundo significado cultural, especialmente en comunidades rastafari y africanas.	{"df": ""}
b467f23b-dc57-4205-90f3-e46aefb8837b	Versión avanzada del lifting que incorpora keratina hidrolizada en el proceso para nutrir y reparar la pestaña mientras se riza. Es ideal para pestañas debilitadas, finas o dañadas por el uso prolongado de extensiones, y deja un acabado suave y saludable.	{"df": ""}
47bf114b-e0c7-4d40-98c7-63fc7b4ce5eb	Variante más refinada del crew cut, con suficiente largo al frente para peinarse con una raya lateral. Evoca el ambiente universitario de élite estadounidense y es perfecto para entornos formales o profesionales. Requiere algo de peinado pero se mantiene toda la jornada.	{"df": ""}
d3e1eb25-28c2-4d41-a027-b378bebb27d8	Corte icónico de los años 80 y 90 con un bloque plano de cabello afro en la parte superior y un fade limpio en los costados. Fue popularizado por artistas del hip-hop y jugadores de la NBA. Hoy vive un resurgimiento en la moda retro afroamericana.	{"df": ""}
42279676-2144-4ec7-8cd6-f22765886f70	Mechas tradicionales realizadas con papel aluminio que permiten levantar varios niveles de tono con precisión y uniformidad. Son ideales para clientas que buscan un cambio notorio y mucho contraste entre la base y las mechas, con un acabado más estructurado que el balayage.	{"df": ""}
781dd838-8ae4-4519-a8a4-ac1d7f39f3be	El degradado comienza muy arriba, casi en la coronilla, generando un contraste dramático y un aspecto muy limpio. Es ideal para quienes quieren un look llamativo y moderno; resalta especialmente bien con afros, quiffs o pompadours en la parte superior.	{"df": ""}
74050bea-6875-4baf-888a-5874f8e691a9	Aplicación de henna formulada con tonos más profundos y técnicas adaptadas para pieles morenas y oscuras, en las que los tintes claros no contrastan adecuadamente. El resultado es una ceja perfectamente visible, definida y armónica con el subtono natural de la piel.	{"df": ""}
fd39e426-0a6e-4a2a-bea3-599dfa39e5ac	La mitad superior del cabello se recoge en un pequeño moño alto, dejando el resto suelto. Es un peinado moderno, casual y muy práctico que ha ganado popularidad en redes sociales por su facilidad de ejecución y su capacidad de dar estilo sin complicaciones.	{"df": ""}
2ed6bcba-7585-4941-8b28-89c547724aed	Solo la mitad superior del cabello se recoge en una coleta o moño, dejando el resto suelto cayendo sobre los hombros. Es un peinado romántico y juvenil que combina lo recogido con lo natural. Ideal para citas, graduaciones y celebraciones que no exigen un recogido total.	{"df": ""}
b4a4c3df-0e12-484f-84a8-8f002d44dd0a	Solo la mitad superior del cabello se recoge en un moño, mientras el resto cae libre sobre los hombros. Es un estilo relajado y casual que combina lo recogido con lo suelto, muy popular en artistas, músicos y el mundo del surf y snowboard.	{"df": ""}
db479033-990e-4b47-9b08-dbf3192e4b14	Trenzas grandes y pegadas al cuero cabelludo, similares a los cornrows pero con mayor grosor y, frecuentemente, con mechones rizados o sueltos enmarcando el rostro. Tienen un aire majestuoso y se asocian a la imagen de una diosa, de ahí su nombre. Son un símbolo de poder y belleza afro.	{"df": ""}
1fdbafa0-aa2e-4f5c-a961-dd59021365c9	Maquillaje con piel iluminada y dewy, pómulos resaltados con iluminador líquido y un acabado fresco y juvenil. Es ideal para días soleados, brunchs, paseos y sesiones casuales en exteriores donde la luz natural acompaña el efecto luminoso.	{"df": ""}
1976ba58-2126-4df8-9695-39df7d841935	Recogido elegante en el que el cabello se enrolla verticalmente sobre sí mismo en la parte trasera de la cabeza, formando una columna pulida. Es uno de los peinados más sofisticados del repertorio clásico francés, ideal para eventos formales y vestidos con escote en la espalda.	{"df": ""}
c6cfa76f-11fa-4c41-bf29-24487e74c23d	Flequillo recto y definido con los laterales cortos y una leve textura arriba. Originado en la moda francesa, tiene un aire europeo elegante y moderno. Es especialmente favorecedor para rostros ovalados o rectangulares y para cabellos lisos o con onda leve.	{"df": ""}
9bb8ad79-8417-4dc3-a38b-eb837dd21266	Híbrido entre el balayage tradicional y los highlights con foil: las mechas se pintan a mano alzada al estilo balayage y luego se envuelven en papel aluminio para conseguir un aclarado más intenso. Es ideal para clientas con cabello oscuro que desean balayage con mayor luminosidad.	{"df": ""}
6bfda5b5-81de-4e3e-84e8-e340e7601338	Cabello largo y liso o ligeramente ondulado que se divide con una raya al centro y cae hacia ambos lados enmarcando el rostro como una cortina. Ícono de los años 90 popularizado por actores y músicos de la época, actualmente en pleno resurgimiento en la generación Z.	{"df": ""}
6a6499e9-8207-42df-9604-cd1bd73973d0	Simula un mohawk sin necesidad de rapar los lados completamente: el cabello central se eleva con gel o pomada mientras los costados van con fade o peinados hacia adentro. Es el término medio entre lo atrevido y lo aceptable en entornos laborales. Muy popular entre niños y adolescentes.	{"df": ""}
e8025887-2d78-4cb7-8cbc-e3df7fc47cd1	El degradado comienza justo por encima de la línea de las orejas y desciende suavemente hacia la nuca. Es el corte de barbería más solicitado del mundo por su versatilidad: luce igual de bien con cabello liso, ondulado o rizado, y se adapta tanto a ambientes casuales como formales.	{"df": ""}
8b27c3a5-73a2-4449-89db-79de99ac7a44	Técnica que aclara únicamente los mechones que enmarcan el rostro, generando un efecto luminoso similar al de un iluminador facial. Es ideal como complemento de un balayage o para clientas que buscan un cambio sutil pero impactante sin alterar el resto del cabello.	{"df": ""}
ebef006f-fb00-431b-96b1-844eeb8b9bd0	Técnica avanzada que aplica abanicos hechos a mano de varias extensiones ultrafinas sobre cada pestaña natural, creando un efecto de gran volumen y densidad. Es ideal para clientas que buscan una mirada impactante y muy fotogénica para eventos o redes sociales.	{"df": ""}
a50a8e12-a737-446e-9418-0f14bdeab570	Aplicación de esmalte completamente transparente que sella la uña, le aporta un brillo sutil y la protege del desgaste cotidiano. Es la opción favorita para quienes desean unas uñas pulidas y elegantes sin que se note maquillaje, muy elegida tanto por hombres como por mujeres.	{"df": ""}
e09f2c65-efdd-4c46-b7f0-751595558516	Aplicación de esmalte de gel que se cura con lámpara UV o LED y dura entre dos y tres semanas sin desconcharse. Aporta un brillo intenso y resiste el desgaste diario mucho mejor que el esmalte tradicional. Es la opción más vendida por su durabilidad y variedad de colores.	{"df": ""}
65f4dcb4-95c9-40d9-b9c4-7536048f7969	Flequillo recto, horizontal y perfectamente definido combinado con fade en los laterales. Es el corte más representativo de la cultura barrial latina en EE.UU. y México, y ha conquistado barbershops en toda Latinoamérica. Puede hacerse con línea grabada para mayor definición del perímetro.	{"df": ""}
c3ed5b03-9f03-40fc-b73f-3ce540333251	El degradado sigue una línea curva que 'cae' detrás de la oreja, creando un contorno redondeado y estético en lugar de la línea horizontal estándar. Aporta un aspecto más artístico y dinámico, y funciona muy bien con diseños grabados en la zona de la sien.	{"df": ""}
39907a99-5534-4eaf-b25a-f190cda02d49	Similar al undercut clásico pero con una línea perfectamente definida entre la parte rapada y el largo superior, sin degradado de transición. La separación abrupta genera un efecto visual muy impactante. Es popular en moda asiática, barbería nórdica y estética punk-moderna.	{"df": ""}
81f46b2d-3919-443d-a7c5-eab8c24d3917	Aclarado integral del cabello mediante polvo decolorante con el objetivo de levantar varios niveles de tono. Es el paso previo necesario para coloraciones rubias muy claras o color fantasía, y debe realizarse con técnica precisa para preservar la fibra capilar.	{"df": ""}
abfac08a-9e17-4697-9314-40b713e284d5	Decoloración intensiva que lleva el cabello al nivel más alto de aclarado posible, dejando una base ultra clara para conseguir el codiciado rubio platino. Es uno de los servicios más exigentes técnicamente y requiere cabello en buenas condiciones para obtener un resultado sano.	{"df": ""}
db6ec53b-f532-4145-9068-7576986a0cd0	Corte corto por los lados y la nuca con algo más de largo en la parte superior, peinado hacia adelante o con ligera textura. Es uno de los estilos más masculinos y versátiles que existen, asociado históricamente con lo militar y deportivo. Funciona en cualquier tipo de cabello.	{"df": ""}
1a185513-6246-4817-8042-1bcec51c8feb	Corte a la altura del hombro acompañado de un flequillo cortina abierto al centro que enmarca el rostro. Es uno de los cortes más pedidos actualmente porque combina practicidad y estilo, y favorece especialmente rostros ovalados, redondos y con forma de corazón.	{"df": ""}
49fca278-9d75-4e2d-9963-35268ec34f7e	Trenzas planas y pegadas al cuero cabelludo en líneas rectas o patrones curvos, técnica originaria de África Occidental con miles de años de historia. Son protectoras, duraderas y permiten una infinidad de diseños creativos. Funcionan tanto como peinado completo como base de otros estilos.	{"df": ""}
1ea4e70c-93ff-4be2-964b-f2df4c380b32	Combinación de cornrows en la parte superior con un degradado fade limpio en los laterales. Esta fusión de técnicas tradicionales africanas y barbería moderna es extremadamente popular en barbershops urbanos de todo el mundo y aporta un look contemporáneo con profunda identidad cultural.	{"df": ""}
8987fcc7-0b23-47fc-9053-a15656094f2c	Combinación de cornrows en la parte superior con un degradado fade limpio en los laterales. Esta fusión de técnicas tradicionales africanas y barbería moderna es extremadamente popular en barbershops urbanos de todo el mundo y aporta un look contemporáneo con profunda identidad cultural.	{"df": ""}
87358096-aed4-4a42-a567-959c06f3824b	Trenzas planas y pegadas directamente al cuero cabelludo, tejidas en líneas rectas o patrones curvos. Es una de las técnicas de peinado más antiguas del mundo, con raíces en África Occidental. Son protectoras del cabello natural, duran semanas y admiten innumerables diseños y patrones.	{"df": ""}
498fb566-4a61-418d-aa56-d58af6ee8350	Coloración en tonos rosados pasteles aplicada sobre cabello previamente decolorado a una base muy clara. Es uno de los colores fantasía más solicitados por su feminidad y aire soñador, y suele combinarse con baños de color para refrescar el tono cada pocas semanas.	{"df": ""}
ed2452b8-14e9-42df-8a85-f280d917b124	Tonalidad fría y romántica en tonos lila y lavanda que aporta un aire mágico y editorial al cabello. Es uno de los colores fantasía más fotogénicos y favorece especialmente a clientas con piel clara y rasgos delicados.	{"df": ""}
62fb2e58-c638-4799-91f7-2c75f27dd32a	Coloración integral en tonos rubios cálidos con reflejos dorados que aportan luminosidad y un aspecto solar al cabello. Generalmente requiere una decoloración previa si se parte de una base oscura, y se complementa con tratamiento hidratante para preservar la salud del cabello.	{"df": ""}
e018c09b-2a25-416c-a46d-87a0c345c796	Coloración vibrante en tonos rojos cobrizos o caoba que aporta carácter y personalidad a la imagen. Es uno de los colores más demandados en otoño e invierno por su calidez visual, y favorece especialmente a pieles claras y a clientas con ojos verdes o miel.	{"df": ""}
37060eea-adf1-4db0-9f9a-711e03e02b15	Tintura intensa que cubre el cabello completo con un negro profundo y brillante, ideal para clientas con rasgos marcados o que buscan un look elegante y dramático. Se recomienda valorar bien el tono natural de la piel antes de aplicarlo, pues es uno de los colores más difíciles de retirar.	{"df": ""}
7f287f14-dd76-41d1-b96b-6ee7ce6b3872	Color de tendencia que combina la base castaña con reflejos cálidos en tonos cacao, caramelo y avellana. Aporta dimensión y movimiento al cabello sin necesidad de mechas tradicionales, y es uno de los favoritos para temporadas frías por su aire goloso y reconfortante.	{"df": ""}
d415c0da-8604-4b73-98f4-111cf099ee9e	Aplicación de tinte profesional en toda la cabellera para conseguir un castaño uniforme y luminoso. Es el color más solicitado por su versatilidad: favorece prácticamente a cualquier tipo de piel y sirve como base sobre la que se pueden realizar futuros trabajos de mechas o balayage.	{"df": ""}
70538532-3762-434c-8f44-a4acadf9cbaa	Coleta dividida en secciones con ligas a lo largo de toda su longitud, formando 'burbujas' o esferas decorativas. Es un peinado muy popular en niñas porque es divertido, colorido cuando se usan ligas de colores, y mantiene el cabello sujeto durante todo el día escolar o de juegos.	{"df": ""}
64861cdd-8e45-4691-a26e-75effab7e735	Cola de caballo trabajada con cardado en la coronilla para añadir altura y cuerpo, dando una sensación de mayor densidad y un efecto visual más glamoroso. Es muy usada en eventos y sesiones fotográficas, y suele acabarse con un mechón cubriendo la liga para un look más pulido.	{"df": ""}
0243aa5b-632c-46aa-8bd2-5241947959f6	El cabello se recoge a la altura de la nuca de manera elegante y discreta. Es ideal para entornos formales, oficina y eventos sobrios, y combina muy bien con un mechón envolviendo la liga para esconderla y dar un acabado más pulido y profesional.	{"df": ""}
6dc3a5f1-ff10-4390-96ec-f204c5b7bf33	El cabello se recoge a la altura de la nuca de manera elegante y discreta. Es ideal para entornos formales, oficina y eventos sobrios, y combina muy bien con un mechón envolviendo la liga para esconderla y dar un acabado más pulido y profesional.	{"df": ""}
fa7716ea-e06c-467c-8d90-95711e33e7fb	Todo el cabello se recoge en lo alto de la coronilla con una liga, dejando el rostro despejado y aportando un efecto lifting natural. Es un peinado versátil que sirve tanto para el día a día como para eventos cuando se acompaña de ondas o accesorios. Favorece cualquier tipo de rostro.	{"df": ""}
1858d2ca-ba67-4a4d-b49f-d6d15d1bb82c	El cabello conserva su largo y se trabajan capas suaves y graduales que aportan movimiento y aligeran las puntas sin sacrificar densidad. Es uno de los cortes más solicitados porque favorece prácticamente cualquier rostro y permite peinar el cabello con ondas, liso o en recogidos. Funciona muy bien tanto en cabellos finos como gruesos.	{"df": ""}
8c005c7b-7965-4585-bc29-db78a0523166	Las capas se cortan formando una V pronunciada en la parte trasera, dejando las puntas centrales más largas que los costados. Es ideal para cabellos largos porque añade movimiento y profundidad sin perder longitud, y crea un efecto visual muy elegante cuando se peina con ondas suaves.	{"df": ""}
1bbe8e67-96ea-4ccd-9871-1cc30f017bb3	Recogido bajo en forma de rosca o caracol enrollado en la nuca, de origen francés y altamente refinado. Es uno de los peinados más elegantes y atemporales que existen, ideal para bodas, galas y ceremonias formales. Se mantiene firme con horquillas invisibles y una buena fijación.	{"df": ""}
10af39ae-217e-49b1-b73c-53b89f844c1c	Brushing personalizado que se adapta a la forma del rostro y al estilo de la clienta, combinando técnicas de volumen, ondas y movimiento según se necesite. Es un servicio estrella en peluquerías de barrio y atiende tanto a usuarias del día a día como a clientas de eventos especiales.	{"df": ""}
b8821248-e224-4a56-9415-bb1a5e3b7dd1	Cepillado que combina secador y cepillo redondo grande para crear ondas naturales y movimiento, sin marcas ni rizos definidos. Es perfecto para clientas que quieren un acabado relajado pero pulido, y queda muy bien en cabellos largos y de longitud media.	{"df": ""}
9b5d4367-38f5-43a1-a884-74c6286e4420	Maquillaje centrado en un delineado negro alargado tipo 'ojo de gato' con final puntiagudo, inspirado en las divas de los años 60. Es estilizado, sofisticado y se complementa con pestañas postizas y labios en tonos neutros o vino para un efecto retro-moderno.	{"df": ""}
10ed927c-2184-4407-a533-7beced4237dd	Similar a las capas en V pero con una curva más suave y redondeada en la parte trasera, lo que produce una caída uniforme y natural. Es el corte por capas más conservador y favorecedor para casi cualquier tipo de rostro. Aporta movimiento sin alterar la forma general del peinado.	{"df": ""}
4e6f007b-c41c-4c39-b9b7-45df4bb771f0	Inspirado en el peinado de Julio César, este corte tiene un largo uniforme en toda la cabeza con un flequillo recto peinado hacia adelante. Es sencillo, fácil de mantener y atemporal. Funciona bien en cabellos lisos o ligeramente ondulados y es muy popular entre niños por su facilidad de cuidado.	{"df": ""}
b6a95d20-ed81-4273-aa32-0917b94c6130	El degradado tiene forma de arco o sol alrededor de la oreja, irradiando hacia afuera. Se usa especialmente en combinación con mohawks o afros para enmarcar el estilo central. Es un corte con mucha personalidad, muy popular en la cultura afrolatina y urbana.	{"df": ""}
d1cea260-671d-4571-94e1-129c2edab2cb	Cepillado con secador y cepillo redondo que deja el cabello completamente liso, brillante y con las puntas hacia adentro. Es el servicio express más solicitado para eventos, reuniones de trabajo y citas, y suele complementarse con un sérum de brillo o un protector térmico ligero.	{"df": ""}
7a23d51d-58c0-4b9f-a525-d49194c76175	Variación del brushing tradicional en la que las puntas se voltean hacia afuera, dando un aire retro juvenil inspirado en los años 60 y 70. Es divertido, fresco y muy fotogénico, especialmente en cortes a la altura del hombro o long bob.	{"df": ""}
807883be-ca18-4665-982d-a8f6f5071e57	Cepillado en el que las puntas se enrollan hacia adentro formando una suave curva en C, evocando los peinados clásicos de los años 60. Es un acabado pulido y elegante muy usado en entornos profesionales y en clientas que prefieren un look femenino tradicional.	{"df": ""}
f55a4df4-4d4c-41da-ab09-a5deb8acd0bc	Técnica de cepillado que utiliza cepillos redondos y secador para añadir cuerpo y altura en la coronilla, ideal para cabellos finos o sin movimiento natural. Aporta una sensación de mayor densidad y un acabado glamoroso que evoca el estilo de las top models.	{"df": ""}
42575046-e8dc-4f98-8b01-25dffe9728d6	Tratamiento que alisa y reorganiza los pelos de la ceja en una dirección uniforme hacia arriba, mediante una solución reestructurante. El resultado es una ceja peinada, voluminosa y con efecto laminado tipo soap brows, que dura entre cuatro y seis semanas.	{"df": ""}
34635168-e558-4805-95a1-f5ee7fbb3fdb	Trenzas individuales de sección cuadrada hechas con extensiones, que pueden ir desde el largo medio hasta la cintura. Son protectoras del cabello natural, duran semanas y representan una herencia cultural africana muy presente en mujeres afrolatinas y afrodescendientes.	{"df": ""}
5a145dfc-ce5a-45cb-a4fe-59b572166167	Trenzas de sección cuadrada que van de longitud corta al mentón o al hombro. Se pueden hacer con cabello natural o con extensiones y ofrecen mucha versatilidad para peinar de distintas maneras. Son una opción de protección del cabello muy practicada en hombres con identidad afro.	{"df": ""}
4c08e189-144d-4b92-ab3f-82741248d274	El corte más reconocible en niños pequeños: el pelo se corta recto alrededor de la cabeza a nivel de las orejas siguiendo una línea circular, como si se hubiera puesto un tazón encima. Es fácil de ejecutar, de mantener y muy resistente al movimiento de los niños en su día a día.	{"df": ""}
f31fac41-b7cb-4a67-b0c9-3c8747b13b8a	Bob corto a la altura del mentón con flequillo recto y aire parisino. Transmite chic, naturalidad y una sensualidad sutil muy característica del estilo francés. Funciona mejor en cabello liso o ligeramente ondulado y queda increíble con tonos castaños o rubios cenizos.	{"df": ""}
271122d6-fa91-47d9-a336-5efaffda2de2	Corte recto a la altura de la mandíbula con líneas limpias y geométricas, inspirado en el icónico bob de los años 20. Estiliza el rostro, resalta el cuello y transmite elegancia atemporal. Es ideal para cabellos lisos o con onda leve y se mantiene impecable con un brushing rápido en casa.	{"df": ""}
d1958036-1638-4150-96ca-c4880f0cb636	Variación moderna del bob donde un lado es notoriamente más largo que el otro, generando un efecto visual dinámico y vanguardista. Es perfecto para clientas que quieren un corte clásico con un toque diferente. Estiliza el rostro y aporta una personalidad fuerte a la imagen.	{"df": ""}
7720a8b4-8cbe-489b-b276-6a12ea234ff9	Corte completamente recto, sin capas ni desfilado, que da la sensación de un cabello más denso y pesado. Es un look muy limpio y moderno, popular en la moda asiática y en pasarelas internacionales. Funciona mejor en cabello liso de densidad media a alta.	{"df": ""}
e87d9097-5668-41ff-bd80-2bcefeeaeb03	El cabello afro o rizado se peina hacia afuera con difusor y secador, creando una corona esponjada y con volumen uniforme alrededor de la cabeza. Es un estilo icónico de Miami y las comunidades cubanas y puertorriqueñas en EE.UU., y representa la identidad afrolatina con mucho orgullo.	{"df": ""}
db0392a7-4fb1-4bba-9215-e4d206de2941	Ondas naturales y desenfadadas que imitan el efecto del mar y la sal sobre el cabello, con textura suelta y aspecto playero. Es un peinado relajado y juvenil, perfecto para el día a día, planes informales y looks de verano. Se logra con plancha, tenacilla ancha o spray salino.	{"df": ""}
f17b91d3-6288-4084-82bf-6f5ad7641d46	Técnica de coloración a mano alzada en la que se pintan mechones seleccionados de forma irregular para imitar el aclarado natural del sol. Genera un efecto degradado muy natural, exige menos mantenimiento que las mechas tradicionales y permite espaciar los retoques varios meses.	{"df": ""}
261a4e3a-b91b-4a85-b459-77745f0ce364	Mechas ultra finas y muy próximas a la raíz que imitan los aclarados naturales del cabello infantil. Aportan luminosidad uniforme y un acabado delicado, sin contrastes pronunciados. Es la técnica favorita para iluminar el rostro y dar vida a cabelleras opacas.	{"df": ""}
10565592-a04e-471e-9218-69b83e5e0085	Tratamiento alisador libre de formol y químicos agresivos, basado en aminoácidos vegetales y aceites naturales. Es la opción preferida por clientas embarazadas, en lactancia o con cuero cabelludo sensible. Su efecto es más suave y dura entre dos y cuatro meses.	{"df": ""}
a8b79b92-b6aa-495f-ac9a-5909a7dc4a53	Tratamiento de alisado semipermanente en el que se aplica queratina y se sella con plancha caliente. Reduce notoriamente el frizz, aporta brillo y deja el cabello manejable durante varios meses. Es ideal para cabellos crespos o gruesos que se desean conservar lisos sin perder vida.	{"df": ""}
e905aa16-94b8-4b0b-858d-f3fa1249588d	Cabello afro natural bien hidratado y cuidado en niños, peinado con aceite de coco o manteca de karité para mantener la forma y evitar el frizz. Es una declaración de identidad desde la infancia, promovida por padres comprometidos con la herencia cultural afro. Se acompaña de educación sobre el amor propio y el cabello natural.	{"df": ""}
5d24d5b7-4e76-42ba-9fe9-1dbe8e8b47a6	El cabello afro crece en su forma natural sin alisados ni alteraciones químicas, formando una corona densa y redondeada. Símbolo de identidad, orgullo y resistencia cultural desde el movimiento Black Power de los años 60. Se mantiene con hidratación, aceites naturales y peinado con peine de púas anchas.	{"df": ""}
83856239-15b3-4332-a4da-bd6b49990b27	Patrón de ondas continuas que rodean toda la cabeza en 360 grados, conseguido mediante cepillado constante con brocha, uso de durag y productos de fijación. Es un estilo que requiere disciplina y rutina diaria, muy popular entre hombres negros jóvenes en Estados Unidos.	{"df": ""}
\.


--
-- Data for Name: faqs; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.faqs (id, question, answer, "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: image_manager; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.image_manager (id, "publicId", version, url, "isPrincipal", "serviceId", "planneId") FROM stdin;
6166a047-f984-4ab8-a641-7f6b91d4def8	uploads/yfcswgbxmiywmccjyale	1779058364	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058364/uploads/yfcswgbxmiywmccjyale.jpg	t	99aead0d-e75d-4b10-b94a-3375f2590cfc	\N
3f9e5399-fb38-4b08-8591-59991ce02f6e	uploads/qmoe2cmpnkmakcssspre	1778981033	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981033/uploads/qmoe2cmpnkmakcssspre.jpg	t	694008c2-35e0-463b-9f2b-e5fd6e152299	\N
1284afbd-aee6-47ad-b421-d29d8e3dee29	uploads/oql1dvaxtod0pmdirvnj	1778981306	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981306/uploads/oql1dvaxtod0pmdirvnj.jpg	t	1659d8f7-cd81-44dd-8df2-b453bdf6a6de	\N
f4281126-4482-491d-8a84-c6fe41ad1741	uploads/qadigs7yrd3dxppbtick	1779058691	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058691/uploads/qadigs7yrd3dxppbtick.webp	t	fd01192e-4f22-4aa3-99d3-64b8f8110395	\N
ab73fdda-3d9c-422b-82bb-92e5a480beb4	uploads/kpjbll5fg2zkxjvxwdzy	1779056208	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056208/uploads/kpjbll5fg2zkxjvxwdzy.webp	t	454cad83-55df-42c8-a4dd-fe2caf355ced	\N
b98890f3-caa3-4497-a11b-cb2c3bb08b07	uploads/bysvq6sr1stojipe0bv3	1779056602	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056602/uploads/bysvq6sr1stojipe0bv3.jpg	t	a742e9a5-2400-4183-a881-f8823c72754d	\N
9d20ee96-391d-41d1-b47d-c2cd69befa7c	uploads/tdbilrof2uv9fo5fisrr	1779059007	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059007/uploads/tdbilrof2uv9fo5fisrr.webp	t	1275efbe-0fd8-4bce-b088-caff6c92e962	\N
44a18d3e-653f-420f-8fb6-ec5873f54853	uploads/gel28vhp4jiklwhu65fw	1779056930	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056930/uploads/gel28vhp4jiklwhu65fw.jpg	t	0537629c-4d68-4b39-bee9-6e1b71b64e2c	\N
cc799465-95b6-449f-9703-a531d371cde3	uploads/xahqpdxumdlliphsnq2a	1779059365	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059365/uploads/xahqpdxumdlliphsnq2a.jpg	t	76c566e3-2ef2-4cc6-9e50-942932045ec3	\N
3e6ad31b-0e87-43fe-926a-8f88db2d0826	uploads/y7tdsak0r0vyjc7ime2i	1779059653	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059653/uploads/y7tdsak0r0vyjc7ime2i.webp	t	93e90395-cd7b-4bdf-8eca-9dc3252fda66	\N
e512c40a-fc9b-4c64-a5bf-c40e1eefe352	uploads/r7hqu8vrrfgciczblsj7	1779057370	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057370/uploads/r7hqu8vrrfgciczblsj7.jpg	t	bb67ff2d-92ec-4a36-8809-fcf69ac9122f	\N
01fab793-2cf8-45ee-a2b8-a06ba38609cc	uploads/df5onygs6uaefmdatxce	1779057725	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057725/uploads/df5onygs6uaefmdatxce.webp	t	af4a61b3-832c-4bb0-9f09-4f2fe994fe33	\N
9b8bcaa0-752a-4508-80e0-3d3448fc6419	uploads/hek5llvfsiutqxio5ml5	1779058244	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058244/uploads/hek5llvfsiutqxio5ml5.jpg	t	827c64dd-ac34-4ddc-9214-5c4ea20bc010	\N
49719975-04ab-4603-a658-70363ed1f2ee	uploads/kupn1uhycb1pwws7gein	1779060086	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060086/uploads/kupn1uhycb1pwws7gein.png	t	7a2ed5cd-df02-41f5-a5e0-ef050c66cbeb	\N
6bfc17ef-2003-48c1-a303-fb9b9d840594	uploads/hfgj22ioxukqdkqwgudz	1779060417	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060417/uploads/hfgj22ioxukqdkqwgudz.avif	t	b6438b33-ad1f-4662-b5d9-1cc431502eee	\N
8f032e88-b8bb-4f46-9afb-bc7b8fac8f09	uploads/lc6iq5tdhw2q4y3ygdcf	1778981083	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981083/uploads/lc6iq5tdhw2q4y3ygdcf.jpg	t	52ce1eaa-844d-40c7-8404-bf8ce8f0b514	\N
dd608d6b-4142-407d-a749-22de8f02162e	uploads/vmhskiiv32chzb8fxyzg	1778981334	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981334/uploads/vmhskiiv32chzb8fxyzg.jpg	t	7406245f-5c90-4832-9f8c-52686f4342c6	\N
54df1c4a-e057-4bc4-9b3d-ed189e8fe830	uploads/blmdbwuc2f863ycoaizo	1779055810	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779055810/uploads/blmdbwuc2f863ycoaizo.jpg	t	41001ec5-51bf-42f9-b81d-afb5e1a3f997	\N
c4a75938-6faf-45d8-a1fa-6a002792e50e	uploads/bskyfdartudbuuka7gwg	1779056261	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056261/uploads/bskyfdartudbuuka7gwg.jpg	t	fd9df923-7750-4da3-8c81-7e084712a96b	\N
32501a85-6199-48c6-8134-91073b93067d	uploads/dunjvyxtmbhcpe1vnqk4	1779056661	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056661/uploads/dunjvyxtmbhcpe1vnqk4.jpg	t	16436deb-c127-4054-bd46-62614d1190b9	\N
b0d699f5-7e40-4bf1-acb9-18fbd51dfd87	uploads/zrngburhmnau4lr1a6v2	1779058414	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058414/uploads/zrngburhmnau4lr1a6v2.jpg	t	14d7cfc8-3518-4d12-be2e-1d1cac5c162e	\N
cc39c82e-4d68-45b7-bbd0-ad6391cc081b	uploads/zztohmuhzzgpbpbo2pig	1779058723	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058723/uploads/zztohmuhzzgpbpbo2pig.avif	t	8c00bdb2-faa9-42ea-ac5d-274f57f72e2b	\N
ac03647b-9465-4680-9960-b9b721b89e54	uploads/yhtnp1zl79cvxppgmyrf	1779056964	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056964/uploads/yhtnp1zl79cvxppgmyrf.png	t	c567dcf4-465d-4517-a168-84ef6acafc45	\N
7e63b980-36ca-448f-8efc-fbecfb899801	uploads/dzjtkfjmkcbnrsyh1ki1	1779057403	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057403/uploads/dzjtkfjmkcbnrsyh1ki1.jpg	t	be490d9a-9090-4f82-b078-8b414019fc07	\N
769969ab-d1f0-4315-8e16-4da9142d8ff6	uploads/vwauk6ocikuzzuuklzad	1779057807	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057807/uploads/vwauk6ocikuzzuuklzad.webp	t	225d9895-0d96-43aa-b510-58e0db0105aa	\N
d03606dd-c775-4466-9fe2-cdd205a8f734	uploads/qdmnjhyjashajzeutm6a	1779059054	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059054/uploads/qdmnjhyjashajzeutm6a.jpg	t	adb023ca-714a-4492-9b9c-e87d495495f5	\N
15ce1cec-384c-4e02-bfef-a53a553d22b3	uploads/mjizh2fheoudjnp7cvub	1779058286	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058286/uploads/mjizh2fheoudjnp7cvub.jpg	t	637da0b8-6f33-4827-924e-bfaf63ac1c95	\N
da833fce-42fc-498a-9072-38c7170ebf47	uploads/goyo5huwktgtwzopxexe	1779059402	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059402/uploads/goyo5huwktgtwzopxexe.jpg	t	4b7a04aa-d072-4302-8130-8c32c0bc3c3d	\N
ed70d3ce-3c5d-4976-b322-4ab628202abb	uploads/ufnjx7unus6r6jqjigdf	1779059706	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059706/uploads/ufnjx7unus6r6jqjigdf.webp	t	184074c0-5358-4d3b-95f3-999b3186cb2a	\N
71cf152e-4c9f-4b32-a099-862ed0d2cf53	uploads/aofdpyx7piwvqy4depjl	1779060120	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060120/uploads/aofdpyx7piwvqy4depjl.jpg	t	80bc3410-1b54-487e-93d0-40c31df84f59	\N
a8eb2481-45b0-4b44-889c-22a775a9a447	uploads/pjvq3jx5hab5f8zpfjal	1779060455	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060455/uploads/pjvq3jx5hab5f8zpfjal.webp	t	d03c558c-6e77-4431-866b-cffabf41e322	\N
48c28504-14d6-4f40-bacf-214320d4c473	uploads/qjs8oeppk9jwrgerxgyw	1779058467	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058467/uploads/qjs8oeppk9jwrgerxgyw.jpg	t	25645ada-7cf4-4cca-96f0-e342a525b0e5	\N
25cb1dfe-0040-4d68-9309-16d73dc3becf	uploads/xpg2ufxszxoh8p9y1xug	1778981163	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981163/uploads/xpg2ufxszxoh8p9y1xug.jpg	t	03edfa63-38ac-4054-b652-1054f00e790e	\N
e4ca3c37-54af-4cf9-80a0-a93c3069c3ef	uploads/otbvkogohixvixmnnmd4	1779058768	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058768/uploads/otbvkogohixvixmnnmd4.webp	t	35b2f33d-73bf-4146-96dd-efe1b2c22cb6	\N
addefe80-1187-4ebd-94d4-42a13733561f	uploads/kc4rcgai8uyaemh3v2pc	1778981380	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981380/uploads/kc4rcgai8uyaemh3v2pc.webp	t	eec7d2bc-8234-42d7-8cec-5fa494c85dd4	\N
01b02f57-b5fa-4d6e-bf01-508cd54e294d	uploads/yb0s90byu9yvgvumenvf	1779059108	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059108/uploads/yb0s90byu9yvgvumenvf.webp	t	70a6cf4e-ed34-480e-b220-b51ed7d6d142	\N
49d7fb1a-5d54-4e2e-948d-eb98600ad4ed	uploads/u6uk4qrcb8dbhhzgemzq	1779055882	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779055882/uploads/u6uk4qrcb8dbhhzgemzq.jpg	t	072c750d-d727-408f-8ab7-336e38d85119	\N
8b149af5-5271-4a24-99b9-3df555a6bbae	uploads/hbvgteebf1jts2vwdpua	1779059451	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059451/uploads/hbvgteebf1jts2vwdpua.jpg	t	de67762b-3e54-45c0-b4b0-c46934833cb7	\N
ceb578f3-bf0c-44ab-a97a-57057f556d54	uploads/ymjqqvlkgonawczs4lft	1779059742	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059742/uploads/ymjqqvlkgonawczs4lft.jpg	t	817577ac-27c5-4441-8151-68c7353dd936	\N
04718caa-c36f-47ee-b769-ce99fb35993b	uploads/bkomfqahlz3nmz7g83oa	1779060162	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060162/uploads/bkomfqahlz3nmz7g83oa.jpg	t	7c99a996-e1d5-4095-a745-0ebc57306315	\N
dee88f5b-5cbc-450d-a200-8e9bf03a7463	uploads/jeei0ilvtewb5ipzl0gu	1779060506	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060506/uploads/jeei0ilvtewb5ipzl0gu.jpg	t	589332bf-dd5e-4e70-b505-f32a9e68aa4d	\N
e03d7505-f106-4296-a565-6f7c671b3f19	uploads/sqnx1d9r9kri2rtxp3ts	1779056333	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056333/uploads/sqnx1d9r9kri2rtxp3ts.jpg	t	b4ad4a66-7863-47ca-a802-c08ec2c525e2	\N
64232f76-ca24-44c5-8668-be88d426004d	uploads/hyczcvk7o7bw1fuxqsxm	1779056700	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056700/uploads/hyczcvk7o7bw1fuxqsxm.jpg	t	65a1f14f-f4b3-41ef-926f-da13a80a3f40	\N
26395899-ab50-4cf3-9f8a-6b4e6b52b0ec	uploads/h6u3higkevmf64aunrmn	1779057051	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057051/uploads/h6u3higkevmf64aunrmn.jpg	t	7453914b-3eae-4608-8968-d84d8cee0b2e	\N
0e9ce423-1382-4c3c-8695-fe55f8a493a5	uploads/xn05urrzutt6bjjmiyqs	1779057427	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057427/uploads/xn05urrzutt6bjjmiyqs.jpg	t	46c044d8-b0ec-4ffc-a81b-0a5cb5baa282	\N
4b490af8-44a1-4fe3-b01c-f0fa9220a70a	uploads/y51xogaatdmd7kjukcwz	1779057951	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057951/uploads/y51xogaatdmd7kjukcwz.webp	t	bba24570-8a29-476a-a48e-e392bf91c856	\N
30b2d191-3ff7-49a6-bb29-ef68abad3044	uploads/ma7thhsqldszisj7ny6r	1779058314	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058314/uploads/ma7thhsqldszisj7ny6r.jpg	t	e097483f-352b-403f-9c91-790e70c6bc12	\N
298c5ef9-4fec-4cbe-99ef-42fad6a58f12	uploads/iikev4xsk1c2gmage2eg	1779058555	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058555/uploads/iikev4xsk1c2gmage2eg.webp	t	30c9fd1c-1fb1-49d5-ae2a-f636e68e0c71	\N
7f614c94-3a9b-4163-be1a-f9745d441a57	uploads/re3m2rxlazsgax6weys8	1779058816	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058816/uploads/re3m2rxlazsgax6weys8.jpg	t	6c145422-ddb4-4e73-b1f5-da902154f8ba	\N
d13c61a4-492c-411b-9875-30eea46a7d7d	uploads/wqo4xrxq3ljejdnsfqs8	1779059162	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059162/uploads/wqo4xrxq3ljejdnsfqs8.avif	t	e1005aec-ce4a-4179-9dca-3d2ea7a59d2b	\N
72c7e31e-4aa7-449e-8f44-03f0cac7c546	uploads/vahh0zlra6tg20lfgsie	1779059484	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059484/uploads/vahh0zlra6tg20lfgsie.jpg	t	6dc7ecae-6ce5-4544-887d-cd2fe22a5cbe	\N
87047085-4591-4165-85e5-80352d1e5cb3	uploads/qk7oqiznb8wgffpdwvxd	1779059823	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059823/uploads/qk7oqiznb8wgffpdwvxd.jpg	t	39a656fd-8b54-4561-857e-f53c99b504c8	\N
c4fbe417-3126-4759-b365-c3999336e012	uploads/qmfbrniwfv6y4fblbm8v	1779060238	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060238/uploads/qmfbrniwfv6y4fblbm8v.webp	t	b61ea5e6-8dfb-4fc0-aaf6-b6fd651e105f	\N
4f805bb8-593e-477d-baad-e6980df78b6a	uploads/o2xna5vzirdfen2udvku	1779060578	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060578/uploads/o2xna5vzirdfen2udvku.jpg	t	9c404372-31f7-4f02-8954-35ae3e8050f9	\N
e881252b-cb70-42c5-8109-b7ad23819426	uploads/k084nh6okmaqldjn70ds	1778981194	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981194/uploads/k084nh6okmaqldjn70ds.jpg	t	3392980d-0fa9-42e0-843d-452658d16065	\N
abc2367d-dd11-43c0-94a8-262c46497ab1	uploads/olzenfvndf6srtd4v0yq	1779056017	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056017/uploads/olzenfvndf6srtd4v0yq.webp	t	de8d8df8-f5b9-4ae3-a468-d9996ffb1a5d	\N
8f371f29-abf2-4b69-b593-4b2dfb79f5df	uploads/iaku1jwxwmajkvqmayho	1779056428	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056428/uploads/iaku1jwxwmajkvqmayho.jpg	t	39d748eb-0deb-4423-9d64-8a6870aadfa5	\N
482f2745-8ecc-46b0-9565-a322d73a82a3	uploads/tmfbj8dppltkx66fkmdw	1779056773	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056773/uploads/tmfbj8dppltkx66fkmdw.webp	t	2a77d30e-cf15-433c-8f35-6f66f742692e	\N
9a1b0b05-e408-4d76-ab56-c7b38733630b	uploads/d8nbgziploml7ozd9iho	1779057299	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057299/uploads/d8nbgziploml7ozd9iho.webp	t	b4d033fd-7786-4b56-acef-197a356bca16	\N
0dd20725-ffed-4d91-a94c-45f09fcd9189	uploads/tublze6irni6wqqdafkz	1779057448	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057448/uploads/tublze6irni6wqqdafkz.jpg	t	b897ae44-dca2-4b52-99d9-658f188f6b4d	\N
59e4a6b1-eade-4935-b49c-9c1fd1e9a5c1	uploads/qpr59ilhxgiat0kx95xu	1779058034	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058034/uploads/qpr59ilhxgiat0kx95xu.png	t	17439ce4-62eb-4bc2-822d-2ca6a77afc52	\N
69ae25c7-ab25-4cb3-b8b5-54a43a4673e5	uploads/rf5krzy3cktchh0tu3hp	1779058595	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058595/uploads/rf5krzy3cktchh0tu3hp.webp	t	ca2bea26-6610-4512-b6b1-69d1a11a9924	\N
a9bdaa0d-1e45-4fa7-ad6e-b910ea79e618	uploads/pebhiwrcf6d4crasgd35	1779058889	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058889/uploads/pebhiwrcf6d4crasgd35.jpg	t	7693e19e-2157-4163-be22-82f1fea4fe4c	\N
33ed6647-5073-42d8-9405-0a2ec8a2cbb4	uploads/ptdycuqjtp1jmzcx3ouw	1779059208	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059208/uploads/ptdycuqjtp1jmzcx3ouw.jpg	t	425be91a-5524-4b91-b61b-0f9fce49fc33	\N
c7200db4-3926-44f0-aa41-c7a18dd8562a	uploads/o1cghbpmctax8dngcb3c	1778981235	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981235/uploads/o1cghbpmctax8dngcb3c.webp	t	61055351-1364-40b6-9ccf-d30190581837	\N
aca76e27-bb91-4d33-a530-912d7f048e5c	uploads/dzx8hye35nzannm2w14m	1779056085	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056085/uploads/dzx8hye35nzannm2w14m.webp	t	64355566-9f21-46c3-9ee2-d8a199c17c1c	\N
b55b4397-1a33-4f89-bc4b-4e578a361c9d	uploads/v3jsoh1svwjukrbqi16q	1779056485	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056485/uploads/v3jsoh1svwjukrbqi16q.webp	t	e1542128-3d5a-4ea1-bf54-9ae028335734	\N
c9516676-90c1-48e8-b31a-774eb3173f25	uploads/to4g3moz4iimkha6uaab	1779056832	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056832/uploads/to4g3moz4iimkha6uaab.jpg	t	c12775de-b932-4c05-be6a-c5cbd937af5e	\N
45d2fa33-0796-44f5-a45c-caa5c170b39f	uploads/lcycfykdt7edsyxym6rn	1779057322	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057322/uploads/lcycfykdt7edsyxym6rn.webp	t	483a6b86-98ee-42a1-826f-adfd2fbf1fdc	\N
74246f47-3428-4b44-adb5-958adb8054d5	uploads/ntycdf2iai4fgqtvl2gx	1779059545	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059545/uploads/ntycdf2iai4fgqtvl2gx.webp	t	9e7997d4-7d96-41f6-b9c2-3ac78a2369c2	\N
01b9675f-b5f2-4518-82af-4586155bf23a	uploads/cegxgj3sii3rdzpcs90j	1779059991	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059991/uploads/cegxgj3sii3rdzpcs90j.jpg	t	f9331477-29cf-435c-9373-5b052356c325	\N
0684b9b8-78db-44f2-9e43-49c84aad4add	uploads/eanlvq2fex5mnyoh34fz	1779060289	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060289/uploads/eanlvq2fex5mnyoh34fz.webp	t	5b736170-94b0-4a89-afbd-cc3e90e51148	\N
322e918d-46a4-49f8-836f-95fb0ec4b16e	uploads/nbklo6bbe13tos8p1g2e	1779057565	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057565/uploads/nbklo6bbe13tos8p1g2e.jpg	t	1ede333b-9e83-49b7-8b57-c75b86cff04b	\N
374f7b03-5760-4a93-a235-a3a52507cbfb	uploads/exrjwgbgswuzbnol5l36	1779060622	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060622/uploads/exrjwgbgswuzbnol5l36.jpg	t	2ad7e362-44ec-4b8c-8947-92f08b181c4d	\N
86cd7172-11b1-49a8-a3ec-32affcbddeb8	uploads/om3oeiqb28vrik2xywhy	1779058098	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058098/uploads/om3oeiqb28vrik2xywhy.jpg	t	933272cf-fa0b-4dbf-be30-39decc19a76b	\N
b62638d2-9b2b-49d1-8fab-234774b93645	uploads/f6phrizn0vgilvhdfzqg	1778974298	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778974298/uploads/f6phrizn0vgilvhdfzqg.jpg	t	e97b3d40-092c-4213-87b7-a2386baa3102	\N
9e6f2b0b-10a5-4495-acad-9291ee1ea181	uploads/a76laymqk9ytvdurp0qa	1778974420	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778974420/uploads/a76laymqk9ytvdurp0qa.webp	t	51d2bae6-7409-44f6-a08e-1a69910cf83a	\N
49512e68-3300-4f74-bb1b-11a0eabd2274	uploads/trxgp0nbrrb2eyeqgp9t	1778974457	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778974457/uploads/trxgp0nbrrb2eyeqgp9t.jpg	t	b8bb68c6-c006-4dcf-8733-9039c6b47f79	\N
0125c275-105c-4a8e-8de1-697400942ab1	uploads/rjqwekrnsmbvxu2bgqbd	1778974787	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778974787/uploads/rjqwekrnsmbvxu2bgqbd.jpg	t	0f64fc07-a713-454a-aa0f-185bf0b64e4d	\N
7a6b9a67-60a0-4c8b-8d0b-87040d2c8a09	uploads/abg3nzu0gcli64min3w3	1778974930	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778974930/uploads/abg3nzu0gcli64min3w3.webp	t	c583d394-6df2-4c7d-a6d7-1a37e98bcc43	\N
f063bffe-1b6e-4ccc-9143-9e3b38091f17	uploads/nnegs9ta9ibhhsfb3aqa	1778974948	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778974948/uploads/nnegs9ta9ibhhsfb3aqa.jpg	t	6fdf001f-f9fa-4161-9542-fd73946cc5f4	\N
6c5c743d-1469-4427-aee1-eb6be65110f1	uploads/ap4vixb7gv2zjkuxpwpx	1778975699	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778975699/uploads/ap4vixb7gv2zjkuxpwpx.jpg	t	398ec708-c421-42c6-b5f8-f06d802d3f2d	\N
71d50ad2-bb31-404d-ba24-88bcb948f45d	uploads/n2zw7ppklhpwhxrj9mhg	1778975718	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778975718/uploads/n2zw7ppklhpwhxrj9mhg.jpg	t	d5dd7498-ce04-4db2-924f-859cd4429d99	\N
35303498-f566-4bb9-a60b-3944b7c7924f	uploads/hix9v2zbqmgxw2poiubv	1778975736	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778975736/uploads/hix9v2zbqmgxw2poiubv.jpg	t	fbccdd86-6a66-4f56-b094-9c3d60123a44	\N
f7940b48-3718-4f90-b6b8-f03b8c953c5d	uploads/iy6n8vaw1ma6ootyluk0	1778975754	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778975754/uploads/iy6n8vaw1ma6ootyluk0.jpg	t	e0b3cba1-87f9-4e40-9716-f75d2a4ba7b4	\N
cce84012-4b68-4407-8402-f269cccb78f3	uploads/cfedectwzxq3wkhlu4pm	1778975781	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778975781/uploads/cfedectwzxq3wkhlu4pm.jpg	t	bd8f826a-dd0a-45cb-aaf9-dfa10d8ede0f	\N
16ab6590-9beb-4122-82c6-9631337c75f5	uploads/xm9xaprcpocroccbyfbt	1778975853	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778975853/uploads/xm9xaprcpocroccbyfbt.jpg	t	cc4498f1-0b50-4ff5-9fdd-04668cbf3115	\N
5ff77c5a-fff0-4bb4-ae23-b935ee89a4b4	uploads/nq85l3yplg7h5cviez5m	1778976193	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778976193/uploads/nq85l3yplg7h5cviez5m.jpg	t	80da21d1-b220-4d7e-bf00-978168e1f18d	\N
f8215b66-43f4-4835-b93c-6cc94ee10623	uploads/fmisxut6ncb0cltwtlfq	1778976214	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778976214/uploads/fmisxut6ncb0cltwtlfq.webp	t	8f8adf79-27d5-454a-9eeb-c961f693110b	\N
367a78ad-bef3-45a3-8be2-0c6ed0ce2d26	uploads/dtv4comsdqtuusfjasey	1778976245	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778976245/uploads/dtv4comsdqtuusfjasey.webp	t	4bdfd811-3d52-44e9-9007-082cf5beea50	\N
bdc262b4-8561-4a5b-9145-a00fd5880bee	uploads/ilhgd5tqektnipov0qg6	1778976262	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778976262/uploads/ilhgd5tqektnipov0qg6.webp	t	762ef5fd-5980-40cd-848a-3d2e69c208b7	\N
ef945fcf-3f79-4335-9cf0-50903c84d269	uploads/dswb4g3amnz9ybt1bgr5	1778977431	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977431/uploads/dswb4g3amnz9ybt1bgr5.webp	t	8df881ad-347f-4b5e-a9cc-f2e06d94d9f0	\N
57ffec76-2948-4891-bece-44d00ba713f4	uploads/xonrgvnb0vkxvknbtoyf	1778977494	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977494/uploads/xonrgvnb0vkxvknbtoyf.jpg	t	0aa4e862-a64e-40a4-b4be-8f3b28707fcd	\N
ba8ff6c9-e6bb-4fcb-a74a-1a7229f86a40	uploads/siujbmrcoiexc3gsdvyw	1778977552	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977552/uploads/siujbmrcoiexc3gsdvyw.jpg	t	b06edd96-4ff2-4aa1-927d-9e279927564c	\N
56caa71d-fa43-4d90-820d-9e18b54a2e50	uploads/jqg4mqwcf69dzomgynai	1778977590	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977590/uploads/jqg4mqwcf69dzomgynai.jpg	t	24976dd9-0923-4ab5-8537-a32ddbf2305d	\N
79089631-b8bb-48bf-8cb1-f0815217b7e9	uploads/zg5oabouj0mawa6hdc6m	1778977616	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977616/uploads/zg5oabouj0mawa6hdc6m.jpg	t	52594a94-5183-4ef5-bd78-87364ae107e9	\N
549f2d21-da09-4bb1-a4cb-552ac5716ebe	uploads/nn6osbp57ha3fezvopfh	1778977678	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977678/uploads/nn6osbp57ha3fezvopfh.avif	t	c3e3547f-b151-4d71-8375-0d78f70fbb94	\N
534cd181-9426-468f-a4c6-0ad504fea915	uploads/cccsq3ctw2tcjqazh6mo	1778977713	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977713/uploads/cccsq3ctw2tcjqazh6mo.webp	t	3db63450-b5f7-44c3-8fbe-b4b457ed524f	\N
50b83d2b-7741-4af3-85e7-d31d1f6befbd	uploads/nvuehtmr60yfnlp1xy0v	1778977785	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977785/uploads/nvuehtmr60yfnlp1xy0v.webp	t	309376aa-0ef9-4783-89db-4efd5ec1d8dc	\N
51680179-59b8-4a69-a91c-6f23097e75d8	uploads/dlawbf6ikfz5uguat9ai	1778977831	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977831/uploads/dlawbf6ikfz5uguat9ai.jpg	t	f53384d6-d46a-4d26-99ca-061bb50c466f	\N
3505267c-c497-488b-a126-70b9165de286	uploads/z1zmrhrtoupmsnurlhc1	1778977880	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977880/uploads/z1zmrhrtoupmsnurlhc1.jpg	t	211e86cf-3310-493e-9473-01b72a460d69	\N
7d9c8f61-73a5-486d-897c-f6df4c0fba50	uploads/v0wgdspd3vy7d3ctbi5t	1778977975	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778977975/uploads/v0wgdspd3vy7d3ctbi5t.jpg	t	b1a94724-6dbf-42c1-bcda-3bc0b28c2467	\N
932b64b1-8bf0-4aca-bf49-8c8956aa55a8	uploads/em40khxgcfbj2zubanvb	1778978061	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978061/uploads/em40khxgcfbj2zubanvb.jpg	t	ba91c993-c5eb-4c7f-bbb3-f0a6c959a1ad	\N
f95e7e66-ea35-493a-81d8-64e83274d503	uploads/ad2ow8wgsw0zdqis2kv8	1778978256	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978256/uploads/ad2ow8wgsw0zdqis2kv8.jpg	t	23bfa01b-0db7-4ed0-b4a3-72141d3613b6	\N
6758d5b8-bed2-456b-828a-d08a8df66c50	uploads/ufmqyx2hs8rr8gqswpna	1778978325	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978325/uploads/ufmqyx2hs8rr8gqswpna.jpg	t	2c1b426d-0caa-4d96-99e1-452627acf37c	\N
2fb39e22-b541-4e30-841a-40e7de077e6d	uploads/xguoedf0ayt0sbvedbnt	1778978379	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978379/uploads/xguoedf0ayt0sbvedbnt.webp	t	636b7ab9-80a2-4a0e-ab47-0b8984ea7019	\N
0eb0facb-47aa-4ad7-af53-c07a7c4e6006	uploads/bszls4kb5nt7yllhwgyx	1778978468	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978468/uploads/bszls4kb5nt7yllhwgyx.jpg	t	bbba3699-0de5-4fe4-9690-773e9d3e9a54	\N
784e39af-3aff-435b-9144-b8252da47dd2	uploads/chq2hiby8pumxgpmvqyn	1778978591	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978591/uploads/chq2hiby8pumxgpmvqyn.jpg	t	5742a546-9755-46ca-90c4-345f39526e04	\N
0571a821-9f7f-4bac-9a0a-b43b9f318a54	uploads/czgvwmxldwutt0zrryc0	1778978605	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978605/uploads/czgvwmxldwutt0zrryc0.jpg	t	5c7938cc-d4fc-4052-b043-549cb3875346	\N
dc62a1e0-5f62-423d-93b8-108c9786c1c3	uploads/veupramqai83o9tno2zm	1778978634	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978634/uploads/veupramqai83o9tno2zm.webp	t	ab5b147a-91f7-4626-9b1d-12de3ba69060	\N
8edbe350-681d-4384-a151-b50c701b3c84	uploads/kswldfbl3dhbpwihqqmv	1778978653	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978653/uploads/kswldfbl3dhbpwihqqmv.webp	t	6c7e11ac-508f-4c30-b4ef-918a6c64d5fb	\N
e5b550f0-ae7b-4c36-a3a9-d116d55c573d	uploads/xr6aacp1jpnk3zc2r3be	1778978712	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978712/uploads/xr6aacp1jpnk3zc2r3be.avif	t	4e70f2f1-23d0-4607-a1a3-d16ac24f7496	\N
d1f29ef1-9650-4808-ad1d-3fbff758bd40	uploads/y0llcpwyosa4tt07akah	1778978999	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778978999/uploads/y0llcpwyosa4tt07akah.jpg	t	5538c5f4-75cd-47b9-a783-fba5a5b82312	\N
792b55fd-b493-47da-8fcb-50a912391f9d	uploads/tkbelqzvkddoaq6un4v7	1778979311	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979311/uploads/tkbelqzvkddoaq6un4v7.jpg	t	e0b11435-3e8b-4759-820a-1e20f5ed90d0	\N
885296b3-d505-4359-a094-866e89a3e9f1	uploads/z81mnamlz5w657lufrum	1778979357	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979357/uploads/z81mnamlz5w657lufrum.webp	t	54725f67-69d4-4656-a833-b0ce6cf80f74	\N
b0cdb0b5-01e7-480e-bbff-66e9f2faef8e	uploads/awa60n4jd5p7z75jcl7l	1778979503	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979503/uploads/awa60n4jd5p7z75jcl7l.webp	t	4086ed7e-9d0b-4a71-ae98-3eaaa9b59aff	\N
fd7a6cfe-d183-4a4c-815d-cd5c944810b9	uploads/btgoaygfhfb2kqemjyjq	1778979566	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979566/uploads/btgoaygfhfb2kqemjyjq.webp	t	d6af0cb9-2b37-433b-a15a-007dc200ab60	\N
a2ee5367-104c-49c5-9c71-b9405e9896c3	uploads/noty5id9oc9hujjkzlzo	1778979601	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979601/uploads/noty5id9oc9hujjkzlzo.jpg	t	739508d6-0ff3-42ce-9617-c0040ac10158	\N
f687e90c-9be5-4be4-9206-56af6b4e44d2	uploads/qrlbphpwbibwuoozxfeh	1778979632	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979632/uploads/qrlbphpwbibwuoozxfeh.jpg	t	a9e26951-8e75-405d-8032-5fd33a9374cd	\N
52a1cf12-4fd9-4f0d-8c7a-c66ff97793c9	uploads/vscufcwakghmvwffyuhb	1778979677	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979677/uploads/vscufcwakghmvwffyuhb.jpg	t	a208776a-6ac5-491e-9889-e9d1d2212114	\N
2dcfbddf-c83d-41fe-8c6c-3ec897281824	uploads/zfvrgzzj3f3jhl9g4o87	1778979709	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979709/uploads/zfvrgzzj3f3jhl9g4o87.jpg	t	b9009bcd-f940-4649-8a3c-ba5556675dc5	\N
2bf5d802-a663-4fe2-b72a-8ddf3205fe95	uploads/pudbzxyzump8tkypmaz4	1778979784	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979784/uploads/pudbzxyzump8tkypmaz4.jpg	t	8612f738-c71c-491d-a0db-b3433bd6cb1d	\N
2f298119-15bd-4121-9106-e786aefb961f	uploads/b0dzijth3hsh7q5ny8tk	1778979830	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979830/uploads/b0dzijth3hsh7q5ny8tk.jpg	t	fcfa14eb-ce15-42ef-a11a-c8809a7e2d08	\N
cd6d030a-1f66-4e52-97c3-e827ec3eee60	uploads/maixw7dnikf5ewzrzayg	1778979898	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979898/uploads/maixw7dnikf5ewzrzayg.avif	t	9a9a0b5d-14e6-46cb-8c37-7738ddc10ef1	\N
f0b7fddf-f499-4542-ac24-8114a4be9b59	uploads/gnwz1kti2yvciuh39hj6	1778979997	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778979997/uploads/gnwz1kti2yvciuh39hj6.png	t	79bed153-30da-4536-8f6e-ddb7e0b32186	\N
8b5171cd-d04c-4d1e-b0db-074b94630188	uploads/dhu4mlb1qeiheu53dsum	1778980064	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980064/uploads/dhu4mlb1qeiheu53dsum.jpg	t	b2e74b49-cc23-43ab-ba45-507b6885b9e5	\N
58a4d173-c532-43aa-af33-9b701cd212e1	uploads/gbt4my7cvvsmexlcil12	1778980155	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980155/uploads/gbt4my7cvvsmexlcil12.jpg	t	1f7b28bd-1909-469b-8fbe-f1278d8d9eab	\N
745f4b4d-5c85-4f0c-9005-3f083ef7fe64	uploads/qgd0qt04r6ywyrlktwq4	1778980212	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980212/uploads/qgd0qt04r6ywyrlktwq4.webp	t	a391eb6d-0535-42cc-a68a-bdc1ad356a89	\N
f8995f7d-7115-49e0-9b9c-bdf0d1b4fcb9	uploads/pg5g615ptj4gm1iflo9k	1778980250	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980250/uploads/pg5g615ptj4gm1iflo9k.png	t	41f3dc3d-11df-4391-a0ae-20894292ed8c	\N
c1869aba-171b-4928-9b45-ac978715345a	uploads/uvs0s0ibcpynv9nzpona	1778980297	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980297/uploads/uvs0s0ibcpynv9nzpona.webp	t	64f18550-2abb-4d88-b335-60f3fdd02fda	\N
94e0af4d-57a4-4a86-bfdf-b51c10a2d919	uploads/f3nz1coddah2m9qpnvau	1778980330	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980330/uploads/f3nz1coddah2m9qpnvau.jpg	t	6089edff-768a-4cef-b6a4-bca952125d99	\N
dbd9d168-ac0e-466c-9b2e-0da015d98689	uploads/fhxiwpwdede1wq9rct82	1778980368	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980368/uploads/fhxiwpwdede1wq9rct82.webp	t	6977c14f-6d31-41ed-885f-b0476b696c57	\N
9e5a56a2-e34c-4fba-bd85-1a8c621e8626	uploads/awrehlvsil2hhe9ectjr	1778980420	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980420/uploads/awrehlvsil2hhe9ectjr.webp	t	ea362b41-8e60-43ee-ad1a-8594677f08ba	\N
c6b6f3b6-bfc8-4f75-9ac8-7141aaada02a	uploads/kt3wd44mxixaecyjfwsx	1778980461	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980461/uploads/kt3wd44mxixaecyjfwsx.jpg	t	306b40a4-7d32-4c0a-b810-7c8608bb3919	\N
61b1fbee-e128-47c6-b77b-ff633b970dc5	uploads/bmk55ualvtjno9xbajfv	1778980562	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980562/uploads/bmk55ualvtjno9xbajfv.jpg	t	eb68d1a9-6b4a-47a3-ad4c-7b79df2a8ed8	\N
13f3b1c7-344f-4a32-803d-9338d361e9e0	uploads/ghegqexbmmkjejoilp9t	1778980605	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980605/uploads/ghegqexbmmkjejoilp9t.avif	t	d65b988f-0407-452f-9baa-4c70e2b85f5a	\N
c2e66ec2-715c-4712-b10a-74c0975f4a55	uploads/iofesdayelvmenssytny	1778980645	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980645/uploads/iofesdayelvmenssytny.jpg	t	410f1f61-4595-435b-8e05-a1e79207701d	\N
feeff4a7-1169-4485-9ec8-589bd5922f89	uploads/diimqdpfqnvhy0uwgk16	1778980680	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980680/uploads/diimqdpfqnvhy0uwgk16.jpg	t	42e23112-e8ab-4a03-89ce-6956603d4cf2	\N
8b8769c5-6fc0-41cd-9071-5ae52d8aba0a	uploads/bfoomnmnilrbnqkecim6	1778980741	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980741/uploads/bfoomnmnilrbnqkecim6.jpg	t	cb55c572-1f1c-48f7-be4d-e1f9d7f3f2a6	\N
142582bd-0e62-451c-abe9-f6f7f723ecfd	uploads/cgceckfvthufpjd5ltdw	1778980773	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980773/uploads/cgceckfvthufpjd5ltdw.jpg	t	a71e8f1a-7ff1-446a-9358-c64a315e5d4a	\N
0350954a-61d4-46bc-b5d3-be842b2ec29c	uploads/uriil0tqsn9danlux1s1	1778980809	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980809/uploads/uriil0tqsn9danlux1s1.jpg	t	71089e25-4254-4f5d-aedb-3fa6e8f5c1ef	\N
135557a7-683d-4e60-a1b2-699a49aefb50	uploads/shaxehfdjutxgsbe4az4	1778980855	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980855/uploads/shaxehfdjutxgsbe4az4.jpg	t	edf7f254-c617-4337-b930-864cea291683	\N
1f1d8aff-7f52-4c7d-b55b-2bf3aecf4c59	uploads/v9qeuaxtfsl2deahzmjl	1778980898	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980898/uploads/v9qeuaxtfsl2deahzmjl.jpg	t	3f70589b-372d-4472-91a5-97e73dd051b0	\N
c6287d92-f380-4093-8d82-7900573c7100	uploads/tvofer1dnmup6xhpvhpd	1778980942	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980942/uploads/tvofer1dnmup6xhpvhpd.jpg	t	a2fcc276-b539-402e-955b-daa6accaedec	\N
1e691881-1f8b-482d-b509-05500c05a812	uploads/dvugvmskuhtppikhgbeo	1778980969	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778980969/uploads/dvugvmskuhtppikhgbeo.webp	t	cfbb49b0-7d23-4fcf-af2b-7572046dbc8d	\N
35f90f0f-4a59-4394-bd29-3a219087d51e	uploads/kjgyboqvlk9qg0scury7	1778981005	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981005/uploads/kjgyboqvlk9qg0scury7.jpg	t	f0ceea3d-6500-4dba-b608-52376d328a22	\N
6c2c53d5-51ae-4cbe-8ceb-7257dfc5ffca	uploads/dxwcpglmpaufrutwlwrn	1778981272	https://res.cloudinary.com/dh51gmn6i/image/upload/v1778981272/uploads/dxwcpglmpaufrutwlwrn.webp	t	66c7155a-cbc7-4129-9b6e-c5a3057cd8cb	\N
f2c676cd-094f-4ed9-b5cd-5a4cf1dabfc5	uploads/yqqyhloewi1zgpiiz78h	1779056146	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056146/uploads/yqqyhloewi1zgpiiz78h.jpg	t	1ec144a8-b80d-41ab-aa90-a0355571659f	\N
0ed5974b-14a3-4d86-b4b1-a5abf13e1119	uploads/ccc7gj0g0keuo3vmvibq	1779056534	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056534/uploads/ccc7gj0g0keuo3vmvibq.jpg	t	58ce235e-5b30-45d5-88fe-bfb605a1084e	\N
65d174db-7ae6-44d0-b06e-bbfb50f5113e	uploads/g2jpngy2bmpkgvj2hnzi	1779056897	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779056897/uploads/g2jpngy2bmpkgvj2hnzi.jpg	t	64ad0e50-baeb-45e1-9754-b058ecf49483	\N
35296361-cda0-4663-b070-63d902d372c9	uploads/ckyqpnr0vyip3s4opf2i	1779057343	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057343/uploads/ckyqpnr0vyip3s4opf2i.webp	t	2b0dc7b8-df4a-4f4f-9a68-63347c69d16f	\N
c8cb4fe4-2cc9-4df3-8589-377cd1d30cc8	uploads/npfvlmnylglua5rwzdpz	1779057606	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779057606/uploads/npfvlmnylglua5rwzdpz.jpg	t	773125c9-a280-4644-a6c6-eb6ad1e79706	\N
7a737811-96b0-4ffb-8b0c-9a8e20c1aa0e	uploads/vkeuvtirzlqmmq0iwxkd	1779058196	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058196/uploads/vkeuvtirzlqmmq0iwxkd.jpg	t	1af892d3-c596-458d-bccb-4a0fe2c2c686	\N
d9e5a22f-6b28-44d2-aae2-0d2e6c460bab	uploads/n6ygxinbvngr8vvax6rx	1779058664	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058664/uploads/n6ygxinbvngr8vvax6rx.jpg	t	4f92f70a-0be3-4b90-b4cf-43bd68b51d7c	\N
5e9c909d-60e1-4783-9a91-615f0b28ee70	uploads/wizu4y0opulqqzn649ek	1779058948	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779058948/uploads/wizu4y0opulqqzn649ek.webp	t	453fc16b-3645-4175-9363-091181794810	\N
fa6894da-ae30-40d9-8853-5320781f385a	uploads/jgptgbh4pkfb1cp81t7b	1779059298	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059298/uploads/jgptgbh4pkfb1cp81t7b.jpg	t	96c80958-1ff5-457c-a5cc-afc97423f5d4	\N
1361e1f3-f20e-4459-a209-64854c6f4338	uploads/xy0qy7copjkotlvadnio	1779059621	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779059621/uploads/xy0qy7copjkotlvadnio.avif	t	85557bdd-db28-4f14-9518-59d08c659f37	\N
94ff2cec-244a-42a4-9c48-4cbf90f31d9b	uploads/kp9lw8qokhrbwfs2gl5x	1779060048	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060048/uploads/kp9lw8qokhrbwfs2gl5x.avif	t	98d51627-a44f-44eb-8792-3e29fb599791	\N
7859814c-f6e3-4e16-9125-08683601b66a	uploads/xvtuyrmdqipqp8be8mmg	1779060387	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060387/uploads/xvtuyrmdqipqp8be8mmg.jpg	t	9c1d7250-b948-4562-aa74-45775cebb050	\N
aa325f78-b40a-44dc-8d31-de7bcf6676cc	uploads/ahlibjtrphrdcwa3a8fe	1779060676	https://res.cloudinary.com/dh51gmn6i/image/upload/v1779060676/uploads/ahlibjtrphrdcwa3a8fe.webp	t	a051cf23-118a-4712-82fa-acdcb5323482	\N
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1784681420779	InitialSchema1784681420779
2	1784682556505	UserDataPolicyConsent1784682556505
3	1786630617758	MatureReservationDomain1786630617758
4	1786841983000	AuthEmailVerificationAndTokens1786841983000
5	1787001234000	WorkerOverlapExclusion1787001234000
6	1787088031875	SessionRefreshTokensAndGoogle1787088031875
\.


--
-- Data for Name: planne; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.planne (id, name, "servicesIds", gender, "detailId") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.refresh_tokens (id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_hash, created_at) FROM stdin;
436f1476-72d7-42a7-8be7-c54eb427985a	1c9297c9-c6c9-4abc-af9d-3bc79bbc8837	78afd51d-c7ef-413a-ba6d-dce6f5f30152	769e4cd777b751b380c4a0a9f244b47154d99cd0cbcfcfecd11e0f01d6f89615	2026-09-17 21:31:12.073+00	2026-08-18 21:31:12.193+00	21385d474fad5b4cd7eb04976fa46b788edbe712a5e8f573e03946000fe493ec	2026-08-18 21:31:12.15503+00
6b7d8b0c-e53d-4822-bd26-4152d7da654c	1c9297c9-c6c9-4abc-af9d-3bc79bbc8837	78afd51d-c7ef-413a-ba6d-dce6f5f30152	21385d474fad5b4cd7eb04976fa46b788edbe712a5e8f573e03946000fe493ec	2026-09-17 21:31:12.073+00	2026-08-18 21:31:12.222+00	\N	2026-08-18 21:31:12.196968+00
51e2ee92-bac6-4013-a7a2-f5a26dc9693c	46c9aec8-97fc-4f22-b994-dd91a3dd6eb0	8b42605e-99bd-4c7e-b35d-7e3190b0b675	b7ecd5c5a5d37c53b7c1523b6d4706a1c9772d81293644ba25012d73909cde19	2026-09-17 21:55:32.927+00	2026-08-18 21:55:33.033+00	8e6eb4819e0341c1736686c718cd969ac5303916a0f0a3cd68565b049df37ddb	2026-08-18 21:55:33.001354+00
83c997c5-4191-451a-8838-dfb225d8e7f7	46c9aec8-97fc-4f22-b994-dd91a3dd6eb0	8b42605e-99bd-4c7e-b35d-7e3190b0b675	8e6eb4819e0341c1736686c718cd969ac5303916a0f0a3cd68565b049df37ddb	2026-09-17 21:55:32.927+00	\N	\N	2026-08-18 21:55:33.035192+00
\.


--
-- Data for Name: reservation_services; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.reservation_services (id, reservation_id, service_id, name, price, duration_minutes) FROM stdin;
\.


--
-- Data for Name: reservations; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.reservations (id, scheduled_at, worker_id, total_duration_minutes, ended_at, status, user_id, customer_name, customer_phone, customer_email, created_at, updated_at) FROM stdin;
71ce72b1-b9d0-4d9b-a013-d7bb1f54d5aa	2026-04-15 01:20:00+00	8c980ba2-3074-4dab-a8c3-8f80ed4b87be	90	2026-04-15 02:50:00+00	cancelada	\N	\N	\N	\N	2026-08-18 21:30:27.604599+00	2026-08-18 22:00:00.064258+00
20677a66-769b-4ed7-9eea-167c74ae1157	2026-05-18 16:05:00+00	8c980ba2-3074-4dab-a8c3-8f80ed4b87be	180	2026-05-18 19:05:00+00	cancelada	\N	\N	\N	\N	2026-08-18 21:30:27.604599+00	2026-08-18 22:00:00.064258+00
cae178ab-31a5-491a-98aa-bd6dbc563583	2026-05-18 19:11:00+00	8c980ba2-3074-4dab-a8c3-8f80ed4b87be	255	2026-05-18 23:26:00+00	cancelada	\N	\N	\N	\N	2026-08-18 21:30:27.604599+00	2026-08-18 22:00:00.064258+00
cdf4e8aa-563e-4adf-be32-bdf7fbb48656	2026-06-12 17:05:00+00	13ab182c-d2fc-4706-b7b5-d1539d1caadf	75	2026-06-12 18:20:00+00	cancelada	\N	\N	\N	\N	2026-08-18 21:30:27.604599+00	2026-08-18 22:00:00.064258+00
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.reviews (id, name, description, score, "createdAt") FROM stdin;
35162883-97b0-4727-9f4a-378ebf12dbd8	Omar Daniel	Buen servicio de barberia, muchas gracias	5	2026-04-08 23:21:20.668388
79985ee6-740c-4d1a-a77d-a58e3de5e4c2	Marta Medrano	El manicure quedo lindo, pero demoro un poco mas de lo esperado 🙈	4	2026-05-18 20:29:25.010918
bebab764-2cd7-4be6-9545-78ec80ff8258	Julian Acosta	Buen servicio, gracias	4	2026-05-18 20:29:25.010918
647dd15a-ffb6-4cd6-aaff-58f89843bb68	Adriana Banegas	El cepillado me quedó muy bonito, buena atención	5	2026-05-18 20:29:25.010918
\.


--
-- Data for Name: reviewsByUser; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public."reviewsByUser" (id, "createdAt", "userId", "reviewId") FROM stdin;
eec09c1a-79a8-41ec-8660-509fcdcc8fda	2026-04-08 23:21:20.676274	12884e8a-633e-46d2-bd2c-17d3cfade293	35162883-97b0-4727-9f4a-378ebf12dbd8
\.


--
-- Data for Name: service; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.service (id, name, type, price, "isSpecial", slug, detail_id, have_promotion, porcentage_disscount, duration) FROM stdin;
1af892d3-c596-458d-bccb-4a0fe2c2c686	Crew cut	hair-men	54000	f	crew_cut	db6ec53b-f532-4145-9068-7576986a0cd0	f	0	30
de8d8df8-f5b9-4ae3-a468-d9996ffb1a5d	Two-strand twists	hair-men	39000	f	two-strand_twists	4f9737c9-1515-4a2c-9fef-492bd4a5f437	f	0	30
827c64dd-ac34-4ddc-9214-5c4ea20bc010	Corte midi con cortina	hair-women	62000	f	corte_midi_con_cortina	1a185513-6246-4817-8042-1bcec51c8feb	f	0	30
64355566-9f21-46c3-9ee2-d8a199c17c1c	Two-block cut	hair-men	36000	f	two-block_cut	f5a76ff0-a09d-4ebb-92ba-1ea349b9871d	f	0	30
1ec144a8-b80d-41ab-aa90-a0355571659f	Man bun	hair-men	29000	f	man_bun	b4b030c3-7a71-47dc-ba92-db004fcf5f2d	f	0	30
454cad83-55df-42c8-a4dd-fe2caf355ced	Long bob (Lob)	hair-women	41000	f	long_bob_(lob)	d43e114d-6955-47dd-b0c0-2ba3ea6b4463	f	0	30
e097483f-352b-403f-9c91-790e70c6bc12	Cornrows con fade	hair-men	36000	f	cornrows_con_fade	8987fcc7-0b23-47fc-9053-a15656094f2c	f	0	30
fd9df923-7750-4da3-8c81-7e084712a96b	Locs largos	hair-men	51000	f	locs_largos	22a2ade0-bb42-46bb-afd8-dccc7f02ad30	f	0	30
b4ad4a66-7863-47ca-a802-c08ec2c525e2	Locs cortos	hair-men	36000	f	locs_cortos	b0989301-39e1-4774-a538-34b11568e0e3	f	0	30
e1542128-3d5a-4ea1-bf54-9ae028335734	Ivy League	hair-men	35000	f	ivy_league	47bf114b-e0c7-4d40-98c7-63fc7b4ce5eb	f	0	30
99aead0d-e75d-4b10-b94a-3375f2590cfc	Cornrows	hair-men	44000	f	cornrows	87358096-aed4-4a42-a567-959c06f3824b	f	0	30
58ce235e-5b30-45d5-88fe-bfb605a1084e	High top fade	hair-men	20000	f	high_top_fade	d3e1eb25-28c2-4d41-a027-b378bebb27d8	f	0	30
16436deb-c127-4054-bd46-62614d1190b9	High fade	hair-men	57000	f	high_fade	781dd838-8ae4-4519-a8a4-ac1d7f39f3be	f	0	30
64ad0e50-baeb-45e1-9754-b058ecf49483	Half bun	hair-men	44000	f	half_bun	b4a4c3df-0e12-484f-84a8-8f002d44dd0a	f	0	30
b4d033fd-7786-4b56-acef-197a356bca16	French crop	hair-men	40000	f	french_crop	c6cfa76f-11fa-4c41-bf29-24487e74c23d	f	0	30
7693e19e-2157-4163-be22-82f1fea4fe4c	Cola de caballo baja	hair-women	20000	f	cola_de_caballo_baja	6dc3a5f1-ff10-4390-96ec-f204c5b7bf33	f	0	30
2b0dc7b8-df4a-4f4f-9a68-63347c69d16f	Flow / curtains	hair-men	45000	f	flow_/_curtains	6bfda5b5-81de-4e3e-84e8-e340e7601338	f	0	30
bb67ff2d-92ec-4a36-8809-fcf69ac9122f	Faux hawk	hair-men	50000	f	faux_hawk	6a6499e9-8207-42df-9604-cd1bd73973d0	f	0	30
be490d9a-9090-4f82-b078-8b414019fc07	Fade bajo clásico	hair-men	32000	f	fade_bajo_clásico	e8025887-2d78-4cb7-8cbc-e3df7fc47cd1	f	0	30
453fc16b-3645-4175-9363-091181794810	Cola de caballo alta	hair-women	33000	f	cola_de_caballo_alta	fa7716ea-e06c-467c-8d90-95711e33e7fb	f	0	30
1275efbe-0fd8-4bce-b088-caff6c92e962	Capas largas	hair-women	31000	f	capas_largas	1858d2ca-ba67-4a4d-b49f-d6d15d1bb82c	f	0	30
adb023ca-714a-4492-9b9c-e87d495495f5	Capas en V	hair-women	75000	f	capas_en_v	8c005c7b-7965-4585-bc29-db78a0523166	f	0	30
af4a61b3-832c-4bb0-9f09-4f2fe994fe33	Edgar cut	hair-men	60000	f	edgar_cut	65f4dcb4-95c9-40d9-b9c4-7536048f7969	f	0	30
76c566e3-2ef2-4cc6-9e50-942932045ec3	Capas en U	hair-women	30000	f	capas_en_u	10ed927c-2184-4407-a533-7beced4237dd	f	0	30
4b7a04aa-d072-4302-8130-8c32c0bc3c3d	Caesar cut	hair-men	45000	f	caesar_cut	4e6f007b-c41c-4c39-b9b7-45df4bb771f0	f	0	30
de67762b-3e54-45c0-b4b0-c46934833cb7	Burst fade	hair-men	23000	f	burst_fade	b6a95d20-ed81-4273-aa32-0917b94c6130	f	0	30
39a656fd-8b54-4561-857e-f53c99b504c8	Box braids cortas	hair-men	45000	f	box_braids_cortas	5a145dfc-ce5a-45cb-a4fe-59b572166167	f	0	30
225d9895-0d96-43aa-b510-58e0db0105aa	Drop fade	hair-men	35000	f	drop_fade	c3ed5b03-9f03-40fc-b73f-3ce540333251	f	0	30
bba24570-8a29-476a-a48e-e392bf91c856	Disconnected undercut	hair-men	30000	f	disconnected_undercut	39907a99-5534-4eaf-b25a-f190cda02d49	f	0	30
f9331477-29cf-435c-9373-5b052356c325	Bowl cut / niño clásico	hair-men	29000	f	bowl_cut_/_niño_clásico	4c08e189-144d-4b92-ab3f-82741248d274	f	0	30
98d51627-a44f-44eb-8792-3e29fb599791	Bob francés	hair-women	29000	f	bob_francés	f31fac41-b7cb-4a67-b0c9-3c8747b13b8a	f	0	30
7a2ed5cd-df02-41f5-a5e0-ef050c66cbeb	Bob clásico	hair-women	33000	f	bob_clásico	271122d6-fa91-47d9-a336-5efaffda2de2	f	0	30
80bc3410-1b54-487e-93d0-40c31df84f59	Bob asimétrico	hair-women	36000	f	bob_asimétrico	d1958036-1638-4150-96ca-c4880f0cb636	f	0	30
7c99a996-e1d5-4095-a745-0ebc57306315	Blunt cut	hair-women	54000	f	blunt_cut	7720a8b4-8cbe-489b-b276-6a12ea234ff9	f	0	30
b61ea5e6-8dfb-4fc0-aaf6-b6fd651e105f	Blowout	hair-men	36000	f	blowout	e87d9097-5668-41ff-bd80-2bcefeeaeb03	f	0	30
9c404372-31f7-4f02-8954-35ae3e8050f9	Afro niño peinado	hair-men	40000	f	afro_niño_peinado	e905aa16-94b8-4b0b-858d-f3fa1249588d	f	0	30
2ad7e362-44ec-4b8c-8947-92f08b181c4d	Afro natural	hair-men	56000	f	afro_natural	5d24d5b7-4e76-42ba-9fe9-1dbe8e8b47a6	f	0	30
a051cf23-118a-4712-82fa-acdcb5323482	360 waves	hair-men	55000	f	360_waves	83856239-15b3-4332-a4da-bd6b49990b27	f	0	30
51d2bae6-7409-44f6-a08e-1a69910cf83a	Wolf cut	hair-men	25000	f	wolf_cut	d448ddd7-9923-4914-8552-762427499f1e	f	0	30
0f64fc07-a713-454a-aa0f-185bf0b64e4d	Undercut	hair-men	19000	f	undercut	916ce225-f36a-49be-9dfd-eb6f73b0a4e9	f	0	30
398ec708-c421-42c6-b5f8-f06d802d3f2d	Twist out masculino	hair-men	25000	f	twist_out	80ed543e-2e35-435a-91b0-9b86a475f5b8	f	0	30
b06edd96-4ff2-4aa1-927d-9e279927564c	Textured fringe niño	hair-men	41000	f	textured_fringe_niño	583d3415-1133-43be-8d2a-41d74a010d67	f	0	30
24976dd9-0923-4ab5-8537-a32ddbf2305d	Textured crop	hair-men	32000	f	textured_crop	4f609b92-e33f-41e5-a53b-f71f665c45cd	f	0	30
52594a94-5183-4ef5-bd78-87364ae107e9	Temple fade con línea	hair-men	30000	f	temple_fade_con_línea	b579399b-6b04-403a-8f5f-4be1bc18bcd4	f	0	30
3db63450-b5f7-44c3-8fbe-b4b457ed524f	Temp fade	hair-men	28000	f	temp_fade	97408357-2996-46c3-a3da-650701cf37cc	f	0	30
309376aa-0ef9-4783-89db-4efd5ec1d8dc	Taper fade	hair-men	29000	f	taper_fade	0d28b2bf-a900-47d8-8f32-bb22d160bceb	f	0	30
f53384d6-d46a-4d26-99ca-061bb50c466f	Sponge curls	hair-men	45000	f	sponge_curls	4b0d898c-f3ff-411d-9b4a-317cd4f0e301	f	0	30
b1a94724-6dbf-42c1-bcda-3bc0b28c2467	Samurai bun	hair-men	16000	f	samurai_bun	4011fa6f-9632-493e-ac41-7f94032e722a	f	0	30
2c1b426d-0caa-4d96-99e1-452627acf37c	Shag cut	hair-women	67000	f	shag_cut	9a139576-393b-4ffc-a4ff-59f8b35a9335	f	0	30
636b7ab9-80a2-4a0e-ab47-0b8984ea7019	Side part (raya lateral)	hair-men	17000	f	side_part_(raya_lateral)	e37a49c7-43c8-41c6-956b-d0e4a7714f0f	f	0	30
ab5b147a-91f7-4626-9b1d-12de3ba69060	Slick back	hair-men	35000	f	slick_back	1196ed14-407f-4867-9a65-bf6eb0d133e5	f	0	30
6c7e11ac-508f-4c30-b4ef-918a6c64d5fb	Skin fade (bald fade)	hair-men	36000	f	skin_fade_(bald_fade)	ded54866-15d4-48cf-9872-4f0f3262956f	f	0	30
54725f67-69d4-4656-a833-b0ce6cf80f74	Quiff	hair-men	38000	f	quiff	b4c21127-3b1c-4f4e-a617-19a410c6e605	f	0	30
4086ed7e-9d0b-4a71-ae98-3eaaa9b59aff	Pompadour	hair-men	20000	f	pompadour	dd3bb4b0-969c-4d55-b6ab-98f1ef3b89b7	f	0	30
d6af0cb9-2b37-433b-a15a-007dc200ab60	Pixie largo	hair-women	68000	f	pixie_largo	ac8c5a21-174b-470a-a085-13e512945078	f	0	30
739508d6-0ff3-42ce-9617-c0040ac10158	Pixie cut	hair-women	79000	f	pixie_cut	81c51ab5-2b05-4014-973e-35863cf42f2e	f	0	30
a9e26951-8e75-405d-8032-5fd33a9374cd	Perm suave (coreano)	hair-men	15000	f	perm_suave_(coreano)	2927f93d-8acd-4c6d-a225-ded180c10b1a	f	0	30
6977c14f-6d31-41ed-885f-b0476b696c57	Mohawk	hair-men	30000	f	mohawk	5d77b968-2326-467d-ae04-f4321583816e	f	0	30
ea362b41-8e60-43ee-ad1a-8594677f08ba	Mid fade	hair-men	26000	f	mid_fade	79127b8b-437f-49cb-9ce4-71ae6f719fa0	f	0	30
eb68d1a9-6b4a-47a3-ad4c-7b79df2a8ed8	Mushroom cut	hair-men	28000	f	mushroom_cut	8cae9d22-d3c1-41a4-b3e3-58f440d6c0d9	f	0	30
d65b988f-0407-452f-9baa-4c70e2b85f5a	Mullet moderno mujer	hair-women	38000	f	mullet_moderno_mujer	36b538c1-658f-42f5-8cb2-6599fd415389	f	0	30
42e23112-e8ab-4a03-89ce-6956603d4cf2	Moño alto de bailarina	hair-women	52000	f	moño_alto_de_bailarina	2c3405ec-695d-424d-ad65-46cf321352b4	f	0	30
cb55c572-1f1c-48f7-be4d-e1f9d7f3f2a6	Mohawk con trenzas	hair-men	57000	f	mohawk_con_trenzas	86a34830-f8c5-4141-8752-9581e4e6b2c3	f	0	30
66c7155a-cbc7-4129-9b6e-c5a3057cd8cb	Manicure rusa	nails	43000	f	manicure_rusa	26c53196-9cfa-48fb-99d8-4f084f5d4721	f	0	30
41001ec5-51bf-42f9-b81d-afb5e1a3f997	Uñas de gel	nails	48000	f	uñas_de_gel	f6c3ea63-beb4-4ebf-a553-a8d144a5c4f6	f	0	30
637da0b8-6f33-4827-924e-bfaf63ac1c95	Cornrows mujer	hair-women	50000	f	cornrows_mujer	49fca278-9d75-4e2d-9963-35268ec34f7e	f	0	30
072c750d-d727-408f-8ab7-336e38d85119	Uñas acrílicas	nails	78000	f	uñas_acrílicas	fbe56dc5-0efb-4311-af05-fb5014af7a8d	f	0	30
2a77d30e-cf15-433c-8f35-6f66f742692e	Half-up top knot	hair-women	50000	f	half-up_top_knot	fd39e426-0a6e-4a2a-bea3-599dfa39e5ac	f	0	30
c12775de-b932-4c05-be6a-c5cbd937af5e	Half up half down	hair-women	89000	f	half_up_half_down	2ed6bcba-7585-4941-8b28-89c547724aed	f	0	30
0537629c-4d68-4b39-bee9-6e1b71b64e2c	Goddess braids	hair-women	68000	f	goddess_braids	db479033-990e-4b47-9b08-dbf3192e4b14	f	0	30
7453914b-3eae-4608-8968-d84d8cee0b2e	French twist	hair-women	39000	f	french_twist	1976ba58-2126-4df8-9695-39df7d841935	f	0	30
1ede333b-9e83-49b7-8b57-c75b86cff04b	Esmaltado transparente brillante	nails	32000	f	esmaltado_transparente_brillante	a50a8e12-a737-446e-9418-0f14bdeab570	f	0	30
773125c9-a280-4644-a6c6-eb6ad1e79706	Esmaltado semipermanente	nails	20000	f	esmaltado_semipermanente	e09f2c65-efdd-4c46-b7f0-751595558516	f	0	30
35b2f33d-73bf-4146-96dd-efe1b2c22cb6	Coletas con burbujas	hair-women	65000	f	coletas_con_burbujas	70538532-3762-434c-8f44-a4acadf9cbaa	f	0	30
6c145422-ddb4-4e73-b1f5-da902154f8ba	Coleta con volumen	hair-women	47000	f	coleta_con_volumen	64861cdd-8e45-4691-a26e-75effab7e735	f	0	30
70a6cf4e-ed34-480e-b220-b51ed7d6d142	Chignon clásico	hair-women	78000	f	chignon_clásico	1bbe8e67-96ea-4ccd-9871-1cc30f017bb3	f	0	30
e1005aec-ce4a-4179-9dca-3d2ea7a59d2b	Cepillado modelado	hair-women	36000	f	cepillado_modelado	10af39ae-217e-49b1-b73c-53b89f844c1c	f	0	30
425be91a-5524-4b91-b61b-0f9fce49fc33	Cepillado con ondas suaves	hair-women	52000	f	cepillado_con_ondas_suaves	b8821248-e224-4a56-9415-bb1a5e3b7dd1	f	0	30
6dc7ecae-6ce5-4544-887d-cd2fe22a5cbe	Brushing liso clásico	hair-women	53000	f	brushing_liso_clásico	d1cea260-671d-4571-94e1-129c2edab2cb	f	0	30
9e7997d4-7d96-41f6-b9c2-3ac78a2369c2	Brushing flip (puntas hacia afuera)	hair-women	88000	f	brushing_flip_(puntas_hacia_afuera)	7a23d51d-58c0-4b9f-a525-d49194c76175	f	0	30
85557bdd-db28-4f14-9518-59d08c659f37	Brushing en C (puntas hacia adentro)	hair-women	60000	f	brushing_en_c_(puntas_hacia_adentro)	807883be-ca18-4665-982d-a8f6f5071e57	f	0	30
93e90395-cd7b-4bdf-8eca-9dc3252fda66	Brushing con volumen	hair-women	28000	f	brushing_con_volumen	f55a4df4-4d4c-41da-ab09-a5deb8acd0bc	f	0	30
817577ac-27c5-4441-8151-68c7353dd936	Box braids mujer	hair-women	89000	f	box_braids_mujer	34635168-e558-4805-95a1-f5ee7fbb3fdb	f	0	30
5b736170-94b0-4a89-afbd-cc3e90e51148	Beach waves	hair-women	70000	f	beach_waves	db0392a7-4fb1-4bba-9215-e4d206de2941	f	0	30
d03c558c-6e77-4431-866b-cffabf41e322	Alisado orgánico	hair-women	42000	f	alisado_orgánico	10565592-a04e-471e-9218-69b83e5e0085	f	0	30
589332bf-dd5e-4e70-b505-f32a9e68aa4d	Alisado con queratina	hair-women	84000	f	alisado_con_queratina	a8b79b92-b6aa-495f-ac9a-5909a7dc4a53	f	0	30
c583d394-6df2-4c7d-a6d7-1a37e98bcc43	Uñas press-on personalizadas	nails	51000	f	uñas_press-on_personalizadas	1b47ed09-71a3-491a-ba28-c874a96ef714	f	0	30
6fdf001f-f9fa-4161-9542-fd73946cc5f4	Uñas marmoleadas	nails	59000	f	uñas_marmoleadas	3a3a5f5e-758c-4670-b018-92f60816b9bb	f	0	30
fbccdd86-6a66-4f56-b094-9c3d60123a44	Trenzas niña con accesorios	hair-women	85000	f	trenzas_niña_con_accesorios	5343cdfc-5e68-4611-863b-42118cda1418	f	0	30
e0b3cba1-87f9-4e40-9716-f75d2a4ba7b4	Trenza holandesa	hair-women	80000	f	trenza_holandesa	f35a1922-7bc4-404d-a0e6-5ab50da00297	f	0	30
bd8f826a-dd0a-45cb-aaf9-dfa10d8ede0f	Trenza francesa clásica	hair-women	26000	f	trenza_francesa_clásica	e5cbc29d-a208-4b5a-9428-ee6be3c09876	f	0	30
cc4498f1-0b50-4ff5-9fdd-04668cbf3115	Trenza espiga (fishtail)	hair-women	44000	f	trenza_espiga_(fishtail)	50b71da3-e09f-4a62-90d5-209de755d90a	f	0	30
80da21d1-b220-4d7e-bf00-978168e1f18d	Trenza corona	hair-women	27000	f	trenza_corona	5b1d193f-af1d-46bf-978f-cd4e63b489fd	f	0	30
8f8adf79-27d5-454a-9eeb-c961f693110b	Trenza cascada	hair-women	69000	f	trenza_cascada	ae241173-32b8-495b-bbbc-b61dae6e6870	f	0	30
4bdfd811-3d52-44e9-9007-082cf5beea50	Tratamiento fortalecedor de uñas	nails	36000	f	tratamiento_fortalecedor_de_uñas	57556f61-38a8-45c6-a555-c5eb19dbfe8f	f	0	30
211e86cf-3310-493e-9473-01b72a460d69	Space buns	hair-women	87000	f	space_buns	aa89b411-6a4f-4c57-9ffe-cb93b0470051	f	0	30
23bfa01b-0db7-4ed0-b4a3-72141d3613b6	Rizos definidos con difusor	hair-women	85000	f	rizos_definidos_con_difusor	34d7f72b-7bf9-4cfb-9372-d68cc64b937b	f	0	30
5538c5f4-75cd-47b9-a783-fba5a5b82312	Recogido de princesa con accesorios	hair-women	31000	f	recogido_de_princesa_con_accesorios	8fe4517a-8542-401f-8a51-d326947959c6	f	0	30
e0b11435-3e8b-4759-820a-1e20f5ed90d0	Recogido con ondas	hair-women	45000	f	recogido_con_ondas	3e0509e1-4c56-473d-82dc-f3048ce6b04a	f	0	30
fcfa14eb-ce15-42ef-a11a-c8809a7e2d08	Peinado pin-up vintage	hair-women	56000	f	peinado_pin-up_vintage	44561bd8-cf1d-4417-a274-c64edae73492	f	0	30
b2e74b49-cc23-43ab-ba45-507b6885b9e5	Pedicure francés	nails	73000	f	pedicure_francés	f69a97a8-0fed-4ced-8cf2-2dfe4e69da44	f	0	30
a391eb6d-0535-42cc-a68a-bdc1ad356a89	Ondas Hollywood	hair-women	85000	f	ondas_hollywood	6ac6c691-b42f-4f21-b46e-5733793e3096	f	0	30
41f3dc3d-11df-4391-a0ae-20894292ed8c	Ondas con plancha en S	hair-women	51000	f	ondas_con_plancha_en_s	d3041603-51ae-4f86-a7fa-eaddd42e81b1	f	0	30
6089edff-768a-4cef-b6a4-bca952125d99	Nail art geométrico	nails	35000	f	nail_art_geométrico	c3cef21d-d2a4-4f52-90bb-70d0ba4f99a3	f	0	30
306b40a4-7d32-4c0a-b810-7c8608bb3919	Nail art floral	nails	75000	f	nail_art_floral	77b586a1-25bd-41b9-9f71-cdd7591f4554	f	0	30
410f1f61-4595-435b-8e05-a1e79207701d	Moño bajo elegante	hair-women	78000	f	moño_bajo_elegante	b7453af2-c54e-4265-98ef-680fcfdeec97	f	0	30
71089e25-4254-4f5d-aedb-3fa6e8f5c1ef	Messy bun	hair-women	54000	f	messy_bun	c8b40eee-c6a9-4880-b986-b491fa00aeae	f	0	30
a2fcc276-b539-402e-955b-daa6accaedec	Maquillaje natural con énfasis en ojos	makeup	138000	f	maquillaje_natural_con_énfasis_en_ojos	ff19f587-d34a-4c92-921f-09cd8c7e3663	f	0	30
cfbb49b0-7d23-4fcf-af2b-7572046dbc8d	Maquillaje glam de noche	makeup	95000	f	maquillaje_glam_de_noche	3bbce633-c96a-4abb-a056-2a7a9ec5e254	f	0	30
52ce1eaa-844d-40c7-8404-bf8ce8f0b514	Maquillaje de quinceañera tradicional	makeup	84000	f	maquillaje_de_quinceañera_tradicional	43fab03f-3cdb-422e-9fdb-1a7bb2c3c256	f	0	30
03edfa63-38ac-4054-b652-1054f00e790e	Maquillaje de novia clásico	makeup	52000	f	maquillaje_de_novia_clásico	bbd4f37d-b306-4805-954c-34909bbbff73	f	0	30
3392980d-0fa9-42e0-843d-452658d16065	Maquillaje teatral neutro	makeup	99000	f	maquillaje_teatral_neutro	b4d69b61-2fd3-4118-a9b7-3db4d8397140	f	0	30
1659d8f7-cd81-44dd-8df2-b453bdf6a6de	Maquillaje de carnaval / festival	makeup	119000	f	maquillaje_de_carnaval_/_festival	dacf3797-67ec-44f1-9809-98892258c106	f	0	30
7406245f-5c90-4832-9f8c-52686f4342c6	Maquillaje cut crease	makeup	45000	f	maquillaje_cut_crease	aefdfe04-ce7c-43f6-aa7f-2747d203529a	f	0	30
96c80958-1ff5-457c-a5cc-afc97423f5d4	Cat eye delineado dramático	makeup	141000	f	cat_eye_delineado_dramático	9b5d4367-38f5-43a1-a884-74c6286e4420	f	0	30
eec7d2bc-8234-42d7-8cec-5fa494c85dd4	Manicure y pedicure de niña con diseños	nails	46000	f	manicure_y_pedicure_de_niña_con_diseños	b2c730c6-82e4-40ba-97f3-1c066d02b4f0	f	0	30
c567dcf4-465d-4517-a168-84ef6acafc45	Glow natural luminoso	makeup	37000	f	glow_natural_luminoso	1fdbafa0-aa2e-4f5c-a961-dd59021365c9	f	0	30
184074c0-5358-4d3b-95f3-999b3186cb2a	Brow lamination	brows-lashes	68000	f	brow_lamination	42575046-e8dc-4f98-8b01-25dffe9728d6	f	0	30
5c7938cc-d4fc-4052-b043-549cb3875346	Smokey eye clásico negro	makeup	75000	f	smokey_eye_clásico_negro	f74e8fac-f734-476b-bbb7-447fee1af046	f	0	30
9a9a0b5d-14e6-46cb-8c37-7738ddc10ef1	Pedicure spa con exfoliación	nails	31000	f	pedicure_spa_con_exfoliación	24c513b4-a0d5-4d53-8121-f96ca29a465c	f	0	30
79bed153-30da-4536-8f6e-ddb7e0b32186	Pedicure semipermanente	nails	32000	f	pedicure_semipermanente	2503871a-cdd2-4372-b30f-aec4c0cb2f98	f	0	30
1f7b28bd-1909-469b-8fbe-f1278d8d9eab	Pedicure con diseño nail art	nails	46000	f	pedicure_con_diseño_nail_art	8796158b-f3e9-49f5-a73d-d677f099b60c	f	0	30
64f18550-2abb-4d88-b335-60f3fdd02fda	No makeup look	makeup	61000	f	no_makeup_look	321317a7-2e59-4b46-8acd-d17d28aad58c	f	0	30
edf7f254-c617-4337-b930-864cea291683	Maquillaje para sesión de fotos profesional	makeup	86000	f	maquillaje_para_sesión_de_fotos_profesional	b2529b64-2c42-45e7-965a-91bc5a3bfc24	f	0	30
3f70589b-372d-4472-91a5-97e73dd051b0	Maquillaje para graduación	makeup	101000	f	maquillaje_para_graduación	3a6083ab-fd66-4101-a79a-94ec73497314	f	0	30
f0ceea3d-6500-4dba-b608-52376d328a22	Mechas peekaboo de color	tinting	188000	f	mechas_peekaboo_de_color	a414576d-ee28-437f-9d7f-3585d5a84d5c	f	0	30
14d7cfc8-3518-4d12-be2e-1d1cac5c162e	Color fantasía rosa pastel	tinting	111000	f	color_fantasía_rosa_pastel	498fb566-4a61-418d-aa56-d58af6ee8350	f	0	30
694008c2-35e0-463b-9f2b-e5fd6e152299	Mechas californianas	tinting	239000	f	mechas_californianas	1317c213-d655-419a-b9ae-cf50ddcef0b9	f	0	30
61055351-1364-40b6-9ccf-d30190581837	Matiz cenizo	tinting	109000	f	matiz_cenizo	e108b1a8-c1fc-4359-911e-108fd8bb0219	f	0	30
39d748eb-0deb-4423-9d64-8a6870aadfa5	Lash lift con keratina	brows-lashes	36000	f	lash_lift_con_keratina	b467f23b-dc57-4205-90f3-e46aefb8837b	f	0	30
a742e9a5-2400-4183-a881-f8823c72754d	Highlights con foil	tinting	176000	f	highlights_con_foil	42279676-2144-4ec7-8cd6-f22765886f70	f	0	30
25645ada-7cf4-4cca-96f0-e342a525b0e5	Color fantasía lila / lavanda	tinting	186000	f	color_fantasía_lila_/_lavanda	ed2452b8-14e9-42df-8a85-f280d917b124	f	0	30
30c9fd1c-1fb1-49d5-ae2a-f636e68e0c71	Coloración completa rubio dorado	tinting	194000	f	coloración_completa_rubio_dorado	62fb2e58-c638-4799-91f7-2c75f27dd32a	f	0	30
ca2bea26-6610-4512-b6b1-69d1a11a9924	Coloración completa rojo cobrizo	tinting	232000	f	coloración_completa_rojo_cobrizo	e018c09b-2a25-416c-a46d-87a0c345c796	f	0	30
65a1f14f-f4b3-41ef-926f-da13a80a3f40	Henna brows para pieles oscuras	brows-lashes	28000	f	henna_brows_para_pieles_oscuras	74050bea-6875-4baf-888a-5874f8e691a9	f	0	30
483a6b86-98ee-42a1-826f-adfd2fbf1fdc	Foilyage	tinting	112000	f	foilyage	9bb8ad79-8417-4dc3-a38b-eb837dd21266	f	0	30
46c044d8-b0ec-4ffc-a81b-0a5cb5baa282	Face framing / contouring	tinting	93000	f	face_framing_/_contouring	8b27c3a5-73a2-4449-89db-79de99ac7a44	f	0	30
b897ae44-dca2-4b52-99d9-658f188f6b4d	Extensiones volumen ruso	brows-lashes	19000	f	extensiones_volumen_ruso	ebef006f-fb00-431b-96b1-844eeb8b9bd0	f	0	30
4f92f70a-0be3-4b90-b4cf-43bd68b51d7c	Coloración completa negro azabache	tinting	204000	f	coloración_completa_negro_azabache	37060eea-adf1-4db0-9f9a-711e03e02b15	f	0	30
fd01192e-4f22-4aa3-99d3-64b8f8110395	Coloración completa chocolate caliente	tinting	171000	f	coloración_completa_chocolate_caliente	7f287f14-dd76-41d1-b96b-6ee7ce6b3872	f	0	30
8c00bdb2-faa9-42ea-ac5d-274f57f72e2b	Coloración completa castaño natural	tinting	140000	f	coloración_completa_castaño_natural	d415c0da-8604-4b73-98f4-111cf099ee9e	f	0	30
9c1d7250-b948-4562-aa74-45775cebb050	Balayage clásico	tinting	180000	f	balayage_clásico	f17b91d3-6288-4084-82bf-6f5ad7641d46	f	0	30
b6438b33-ad1f-4662-b5d9-1cc431502eee	Babylights	tinting	134000	f	babylights	261a4e3a-b91b-4a85-b459-77745f0ce364	f	0	30
17439ce4-62eb-4bc2-822d-2ca6a77afc52	Decoloración global	tinting	75000	f	decoloración_global	81f46b2d-3919-443d-a7c5-eab8c24d3917	f	0	30
933272cf-fa0b-4dbf-be30-39decc19a76b	Decoloración a platino	tinting	112000	f	decoloración_a_platino	abfac08a-9e17-4697-9314-40b713e284d5	f	0	30
8df881ad-347f-4b5e-a9cc-f2e06d94d9f0	Tintura de pestañas negro	brows-lashes	28000	f	tinte_de_pestañas_negro	ef9c9de5-18df-442a-a2e4-18d32848278f	f	0	30
0aa4e862-a64e-40a4-b4be-8f3b28707fcd	Tinte combinado con lifting	brows-lashes	45000	f	tinte_combinado_con_lifting	b79bd8e4-d8d9-43ef-b779-c11bdc1d53c5	f	0	30
ba91c993-c5eb-4c7f-bbb3-f0a6c959a1ad	Root smudge / shadow root	tinting	146000	f	root_smudge_/_shadow_root	8b3e16fc-7d02-450a-8542-afa12e616900	f	0	30
bbba3699-0de5-4fe4-9690-773e9d3e9a54	Retoque de raíz tradicional	tinting	162000	f	retoque_de_raíz_tradicional	2a602c71-3584-47dd-9d34-d6353eb7890c	f	0	30
4e70f2f1-23d0-4607-a1a3-d16ac24f7496	Retoque de raíz cobertura de canas	tinting	176000	f	retoque_de_raíz_cobertura_de_canas	395de468-db5a-45cd-b144-25b1f69339db	f	0	30
a208776a-6ac5-491e-9889-e9d1d2212114	Perfilado de cejas	brows-lashes	47000	f	perfilado_masculino	8c81fa94-7490-4819-91db-86f9231cc05c	f	0	30
b9009bcd-f940-4649-8a3c-ba5556675dc5	Perfilado con pinza	brows-lashes	44000	f	perfilado_con_pinza	ef1ea1ba-37a8-4e5b-a8f8-1fd74d7d9854	f	0	30
8612f738-c71c-491d-a0db-b3433bd6cb1d	Perfilado con cera	brows-lashes	81000	f	perfilado_con_cera	ce3f1722-725a-4bfc-9498-25813488fd7b	f	0	30
a71e8f1a-7ff1-446a-9358-c64a315e5d4a	Microshading / soft powder brows	brows-lashes	68000	f	microshading_/_soft_powder_brows	ba05982a-d7e5-4e09-8f8a-bad0a4fa45fb	f	0	30
e97b3d40-092c-4213-87b7-a2386baa3102	Wolf cut mujer	hair-women	37000	f	wolf_cut_mujer	c2fd4d48-413e-439a-87bb-8eee012185e1	f	0	30
b8bb68c6-c006-4dcf-8733-9039c6b47f79	Updo nupcial	hair-women	76000	f	updo_nupcial	10930c4c-52a5-49cb-91ee-36eee5f80cae	f	0	30
d5dd7498-ce04-4db2-924f-859cd4429d99	Twin braids (dos trenzas francesas)	hair-women	66000	f	twin_braids_(dos_trenzas_francesas)	7a7915ef-8560-47b2-ab4d-11c20159d1d0	f	0	30
762ef5fd-5980-40cd-848a-3d2e69c208b7	Toner cobre / cálido	tinting	81000	f	toner_cobre_/_cálido	372fae57-3e5c-455a-8f03-35af12e9ed8d	f	0	30
c3e3547f-b151-4d71-8375-0d78f70fbb94	Taper natural niño	hair-men	32000	f	taper_natural_niño	76b3593d-55df-4368-985a-c8640d013a87	f	0	30
5742a546-9755-46ca-90c4-345f39526e04	Smokey eye dorado / cobre	makeup	115000	f	smokey_eye_dorado_/_cobre	96234dc1-97f5-444a-bd14-2afc6d497214	f	0	30
\.


--
-- Data for Name: service_tags_tag; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.service_tags_tag ("serviceId", "tagId") FROM stdin;
be490d9a-9090-4f82-b078-8b414019fc07	ead486e4-d86e-4481-954c-4b2eb5915be2
ea362b41-8e60-43ee-ad1a-8594677f08ba	ead486e4-d86e-4481-954c-4b2eb5915be2
ea362b41-8e60-43ee-ad1a-8594677f08ba	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
ea362b41-8e60-43ee-ad1a-8594677f08ba	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
16436deb-c127-4054-bd46-62614d1190b9	ead486e4-d86e-4481-954c-4b2eb5915be2
2a77d30e-cf15-433c-8f35-6f66f742692e	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
16436deb-c127-4054-bd46-62614d1190b9	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
6c7e11ac-508f-4c30-b4ef-918a6c64d5fb	ead486e4-d86e-4481-954c-4b2eb5915be2
be490d9a-9090-4f82-b078-8b414019fc07	47b511ec-2288-4a83-aa51-947d81ecc29b
be490d9a-9090-4f82-b078-8b414019fc07	83c6a558-805c-4156-94f6-fa7ea55c7d84
be490d9a-9090-4f82-b078-8b414019fc07	40f0c389-dd02-4d42-8cb0-d717312a0899
6c7e11ac-508f-4c30-b4ef-918a6c64d5fb	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
6c7e11ac-508f-4c30-b4ef-918a6c64d5fb	369df7c1-8477-4b1e-8886-913137036c19
309376aa-0ef9-4783-89db-4efd5ec1d8dc	ead486e4-d86e-4481-954c-4b2eb5915be2
309376aa-0ef9-4783-89db-4efd5ec1d8dc	47b511ec-2288-4a83-aa51-947d81ecc29b
309376aa-0ef9-4783-89db-4efd5ec1d8dc	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
225d9895-0d96-43aa-b510-58e0db0105aa	ead486e4-d86e-4481-954c-4b2eb5915be2
3db63450-b5f7-44c3-8fbe-b4b457ed524f	ead486e4-d86e-4481-954c-4b2eb5915be2
3db63450-b5f7-44c3-8fbe-b4b457ed524f	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
3db63450-b5f7-44c3-8fbe-b4b457ed524f	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
de67762b-3e54-45c0-b4b0-c46934833cb7	ead486e4-d86e-4481-954c-4b2eb5915be2
de67762b-3e54-45c0-b4b0-c46934833cb7	47b511ec-2288-4a83-aa51-947d81ecc29b
4b7a04aa-d072-4302-8130-8c32c0bc3c3d	ead486e4-d86e-4481-954c-4b2eb5915be2
4b7a04aa-d072-4302-8130-8c32c0bc3c3d	47b511ec-2288-4a83-aa51-947d81ecc29b
1af892d3-c596-458d-bccb-4a0fe2c2c686	ead486e4-d86e-4481-954c-4b2eb5915be2
1af892d3-c596-458d-bccb-4a0fe2c2c686	40f0c389-dd02-4d42-8cb0-d717312a0899
e1542128-3d5a-4ea1-bf54-9ae028335734	ead486e4-d86e-4481-954c-4b2eb5915be2
e1542128-3d5a-4ea1-bf54-9ae028335734	47b511ec-2288-4a83-aa51-947d81ecc29b
e1542128-3d5a-4ea1-bf54-9ae028335734	40f0c389-dd02-4d42-8cb0-d717312a0899
636b7ab9-80a2-4a0e-ab47-0b8984ea7019	ead486e4-d86e-4481-954c-4b2eb5915be2
636b7ab9-80a2-4a0e-ab47-0b8984ea7019	47b511ec-2288-4a83-aa51-947d81ecc29b
636b7ab9-80a2-4a0e-ab47-0b8984ea7019	40f0c389-dd02-4d42-8cb0-d717312a0899
ab5b147a-91f7-4626-9b1d-12de3ba69060	ead486e4-d86e-4481-954c-4b2eb5915be2
ab5b147a-91f7-4626-9b1d-12de3ba69060	47b511ec-2288-4a83-aa51-947d81ecc29b
453fc16b-3645-4175-9363-091181794810	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
0f64fc07-a713-454a-aa0f-185bf0b64e4d	ead486e4-d86e-4481-954c-4b2eb5915be2
0f64fc07-a713-454a-aa0f-185bf0b64e4d	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
0f64fc07-a713-454a-aa0f-185bf0b64e4d	83c6a558-805c-4156-94f6-fa7ea55c7d84
bba24570-8a29-476a-a48e-e392bf91c856	ead486e4-d86e-4481-954c-4b2eb5915be2
bba24570-8a29-476a-a48e-e392bf91c856	47b511ec-2288-4a83-aa51-947d81ecc29b
bba24570-8a29-476a-a48e-e392bf91c856	83c6a558-805c-4156-94f6-fa7ea55c7d84
24976dd9-0923-4ab5-8537-a32ddbf2305d	ead486e4-d86e-4481-954c-4b2eb5915be2
24976dd9-0923-4ab5-8537-a32ddbf2305d	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
24976dd9-0923-4ab5-8537-a32ddbf2305d	83c6a558-805c-4156-94f6-fa7ea55c7d84
24976dd9-0923-4ab5-8537-a32ddbf2305d	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
b4d033fd-7786-4b56-acef-197a356bca16	ead486e4-d86e-4481-954c-4b2eb5915be2
b4d033fd-7786-4b56-acef-197a356bca16	47b511ec-2288-4a83-aa51-947d81ecc29b
b4d033fd-7786-4b56-acef-197a356bca16	83c6a558-805c-4156-94f6-fa7ea55c7d84
54725f67-69d4-4656-a833-b0ce6cf80f74	ead486e4-d86e-4481-954c-4b2eb5915be2
54725f67-69d4-4656-a833-b0ce6cf80f74	47b511ec-2288-4a83-aa51-947d81ecc29b
54725f67-69d4-4656-a833-b0ce6cf80f74	83c6a558-805c-4156-94f6-fa7ea55c7d84
4086ed7e-9d0b-4a71-ae98-3eaaa9b59aff	ead486e4-d86e-4481-954c-4b2eb5915be2
4086ed7e-9d0b-4a71-ae98-3eaaa9b59aff	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
4086ed7e-9d0b-4a71-ae98-3eaaa9b59aff	83c6a558-805c-4156-94f6-fa7ea55c7d84
bb67ff2d-92ec-4a36-8809-fcf69ac9122f	ead486e4-d86e-4481-954c-4b2eb5915be2
bb67ff2d-92ec-4a36-8809-fcf69ac9122f	83c6a558-805c-4156-94f6-fa7ea55c7d84
bb67ff2d-92ec-4a36-8809-fcf69ac9122f	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
6977c14f-6d31-41ed-885f-b0476b696c57	ead486e4-d86e-4481-954c-4b2eb5915be2
6977c14f-6d31-41ed-885f-b0476b696c57	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
6977c14f-6d31-41ed-885f-b0476b696c57	96265c95-808b-4fa1-9480-db9804fcc501
cb55c572-1f1c-48f7-be4d-e1f9d7f3f2a6	ead486e4-d86e-4481-954c-4b2eb5915be2
cb55c572-1f1c-48f7-be4d-e1f9d7f3f2a6	47b511ec-2288-4a83-aa51-947d81ecc29b
5b736170-94b0-4a89-afbd-cc3e90e51148	8797fc27-5ad8-4c6a-a78a-192812f235e4
2ad7e362-44ec-4b8c-8947-92f08b181c4d	ead486e4-d86e-4481-954c-4b2eb5915be2
2ad7e362-44ec-4b8c-8947-92f08b181c4d	47b511ec-2288-4a83-aa51-947d81ecc29b
2ad7e362-44ec-4b8c-8947-92f08b181c4d	ef129f64-64f0-4f75-ac54-a5ba539b41c9
398ec708-c421-42c6-b5f8-f06d802d3f2d	ead486e4-d86e-4481-954c-4b2eb5915be2
398ec708-c421-42c6-b5f8-f06d802d3f2d	47b511ec-2288-4a83-aa51-947d81ecc29b
398ec708-c421-42c6-b5f8-f06d802d3f2d	ef129f64-64f0-4f75-ac54-a5ba539b41c9
b4ad4a66-7863-47ca-a802-c08ec2c525e2	ead486e4-d86e-4481-954c-4b2eb5915be2
b4ad4a66-7863-47ca-a802-c08ec2c525e2	47b511ec-2288-4a83-aa51-947d81ecc29b
b4ad4a66-7863-47ca-a802-c08ec2c525e2	ef129f64-64f0-4f75-ac54-a5ba539b41c9
fd9df923-7750-4da3-8c81-7e084712a96b	ead486e4-d86e-4481-954c-4b2eb5915be2
fd9df923-7750-4da3-8c81-7e084712a96b	ef129f64-64f0-4f75-ac54-a5ba539b41c9
a051cf23-118a-4712-82fa-acdcb5323482	ead486e4-d86e-4481-954c-4b2eb5915be2
a051cf23-118a-4712-82fa-acdcb5323482	47b511ec-2288-4a83-aa51-947d81ecc29b
a051cf23-118a-4712-82fa-acdcb5323482	ef129f64-64f0-4f75-ac54-a5ba539b41c9
58ce235e-5b30-45d5-88fe-bfb605a1084e	ead486e4-d86e-4481-954c-4b2eb5915be2
58ce235e-5b30-45d5-88fe-bfb605a1084e	47b511ec-2288-4a83-aa51-947d81ecc29b
58ce235e-5b30-45d5-88fe-bfb605a1084e	ef129f64-64f0-4f75-ac54-a5ba539b41c9
f53384d6-d46a-4d26-99ca-061bb50c466f	ead486e4-d86e-4481-954c-4b2eb5915be2
f53384d6-d46a-4d26-99ca-061bb50c466f	47b511ec-2288-4a83-aa51-947d81ecc29b
f53384d6-d46a-4d26-99ca-061bb50c466f	ef129f64-64f0-4f75-ac54-a5ba539b41c9
39a656fd-8b54-4561-857e-f53c99b504c8	ead486e4-d86e-4481-954c-4b2eb5915be2
99aead0d-e75d-4b10-b94a-3375f2590cfc	ead486e4-d86e-4481-954c-4b2eb5915be2
99aead0d-e75d-4b10-b94a-3375f2590cfc	47b511ec-2288-4a83-aa51-947d81ecc29b
e097483f-352b-403f-9c91-790e70c6bc12	ead486e4-d86e-4481-954c-4b2eb5915be2
e097483f-352b-403f-9c91-790e70c6bc12	47b511ec-2288-4a83-aa51-947d81ecc29b
de8d8df8-f5b9-4ae3-a468-d9996ffb1a5d	ead486e4-d86e-4481-954c-4b2eb5915be2
de8d8df8-f5b9-4ae3-a468-d9996ffb1a5d	47b511ec-2288-4a83-aa51-947d81ecc29b
1ec144a8-b80d-41ab-aa90-a0355571659f	ead486e4-d86e-4481-954c-4b2eb5915be2
1ec144a8-b80d-41ab-aa90-a0355571659f	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
1ec144a8-b80d-41ab-aa90-a0355571659f	087af487-5130-482d-96cb-bf528c9dcc6a
64ad0e50-baeb-45e1-9754-b058ecf49483	ead486e4-d86e-4481-954c-4b2eb5915be2
64ad0e50-baeb-45e1-9754-b058ecf49483	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
64ad0e50-baeb-45e1-9754-b058ecf49483	087af487-5130-482d-96cb-bf528c9dcc6a
2b0dc7b8-df4a-4f4f-9a68-63347c69d16f	ead486e4-d86e-4481-954c-4b2eb5915be2
2b0dc7b8-df4a-4f4f-9a68-63347c69d16f	47b511ec-2288-4a83-aa51-947d81ecc29b
b1a94724-6dbf-42c1-bcda-3bc0b28c2467	ead486e4-d86e-4481-954c-4b2eb5915be2
b1a94724-6dbf-42c1-bcda-3bc0b28c2467	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
b1a94724-6dbf-42c1-bcda-3bc0b28c2467	087af487-5130-482d-96cb-bf528c9dcc6a
51d2bae6-7409-44f6-a08e-1a69910cf83a	ead486e4-d86e-4481-954c-4b2eb5915be2
51d2bae6-7409-44f6-a08e-1a69910cf83a	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
51d2bae6-7409-44f6-a08e-1a69910cf83a	087af487-5130-482d-96cb-bf528c9dcc6a
64355566-9f21-46c3-9ee2-d8a199c17c1c	ead486e4-d86e-4481-954c-4b2eb5915be2
64355566-9f21-46c3-9ee2-d8a199c17c1c	47b511ec-2288-4a83-aa51-947d81ecc29b
64355566-9f21-46c3-9ee2-d8a199c17c1c	83c6a558-805c-4156-94f6-fa7ea55c7d84
a9e26951-8e75-405d-8032-5fd33a9374cd	ead486e4-d86e-4481-954c-4b2eb5915be2
a9e26951-8e75-405d-8032-5fd33a9374cd	47b511ec-2288-4a83-aa51-947d81ecc29b
a9e26951-8e75-405d-8032-5fd33a9374cd	83c6a558-805c-4156-94f6-fa7ea55c7d84
eb68d1a9-6b4a-47a3-ad4c-7b79df2a8ed8	ead486e4-d86e-4481-954c-4b2eb5915be2
eb68d1a9-6b4a-47a3-ad4c-7b79df2a8ed8	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
eb68d1a9-6b4a-47a3-ad4c-7b79df2a8ed8	83c6a558-805c-4156-94f6-fa7ea55c7d84
af4a61b3-832c-4bb0-9f09-4f2fe994fe33	ead486e4-d86e-4481-954c-4b2eb5915be2
af4a61b3-832c-4bb0-9f09-4f2fe994fe33	47b511ec-2288-4a83-aa51-947d81ecc29b
af4a61b3-832c-4bb0-9f09-4f2fe994fe33	efc608be-52fe-4465-9684-e826872847af
52594a94-5183-4ef5-bd78-87364ae107e9	ead486e4-d86e-4481-954c-4b2eb5915be2
52594a94-5183-4ef5-bd78-87364ae107e9	47b511ec-2288-4a83-aa51-947d81ecc29b
52594a94-5183-4ef5-bd78-87364ae107e9	efc608be-52fe-4465-9684-e826872847af
c12775de-b932-4c05-be6a-c5cbd937af5e	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
b61ea5e6-8dfb-4fc0-aaf6-b6fd651e105f	ead486e4-d86e-4481-954c-4b2eb5915be2
b61ea5e6-8dfb-4fc0-aaf6-b6fd651e105f	47b511ec-2288-4a83-aa51-947d81ecc29b
b61ea5e6-8dfb-4fc0-aaf6-b6fd651e105f	ef129f64-64f0-4f75-ac54-a5ba539b41c9
f9331477-29cf-435c-9373-5b052356c325	ead486e4-d86e-4481-954c-4b2eb5915be2
f9331477-29cf-435c-9373-5b052356c325	5330410b-7132-4267-a5d9-c9f42fe3725b
b06edd96-4ff2-4aa1-927d-9e279927564c	ead486e4-d86e-4481-954c-4b2eb5915be2
b06edd96-4ff2-4aa1-927d-9e279927564c	5330410b-7132-4267-a5d9-c9f42fe3725b
b06edd96-4ff2-4aa1-927d-9e279927564c	83c6a558-805c-4156-94f6-fa7ea55c7d84
1ede333b-9e83-49b7-8b57-c75b86cff04b	9d53d0d4-225d-4e2d-b8c1-636e8252986f
e097483f-352b-403f-9c91-790e70c6bc12	83c6a558-805c-4156-94f6-fa7ea55c7d84
e097483f-352b-403f-9c91-790e70c6bc12	efc608be-52fe-4465-9684-e826872847af
c3e3547f-b151-4d71-8375-0d78f70fbb94	ead486e4-d86e-4481-954c-4b2eb5915be2
c3e3547f-b151-4d71-8375-0d78f70fbb94	5330410b-7132-4267-a5d9-c9f42fe3725b
c3e3547f-b151-4d71-8375-0d78f70fbb94	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
9c404372-31f7-4f02-8954-35ae3e8050f9	ead486e4-d86e-4481-954c-4b2eb5915be2
9c404372-31f7-4f02-8954-35ae3e8050f9	5330410b-7132-4267-a5d9-c9f42fe3725b
9c404372-31f7-4f02-8954-35ae3e8050f9	ef129f64-64f0-4f75-ac54-a5ba539b41c9
1275efbe-0fd8-4bce-b088-caff6c92e962	ead486e4-d86e-4481-954c-4b2eb5915be2
1275efbe-0fd8-4bce-b088-caff6c92e962	9d53d0d4-225d-4e2d-b8c1-636e8252986f
1275efbe-0fd8-4bce-b088-caff6c92e962	087af487-5130-482d-96cb-bf528c9dcc6a
7a2ed5cd-df02-41f5-a5e0-ef050c66cbeb	ead486e4-d86e-4481-954c-4b2eb5915be2
7a2ed5cd-df02-41f5-a5e0-ef050c66cbeb	9d53d0d4-225d-4e2d-b8c1-636e8252986f
7a2ed5cd-df02-41f5-a5e0-ef050c66cbeb	fb2460ea-0400-44d5-a0dc-13275cf33462
454cad83-55df-42c8-a4dd-fe2caf355ced	ead486e4-d86e-4481-954c-4b2eb5915be2
454cad83-55df-42c8-a4dd-fe2caf355ced	9d53d0d4-225d-4e2d-b8c1-636e8252986f
454cad83-55df-42c8-a4dd-fe2caf355ced	fb2460ea-0400-44d5-a0dc-13275cf33462
739508d6-0ff3-42ce-9617-c0040ac10158	ead486e4-d86e-4481-954c-4b2eb5915be2
739508d6-0ff3-42ce-9617-c0040ac10158	9d53d0d4-225d-4e2d-b8c1-636e8252986f
739508d6-0ff3-42ce-9617-c0040ac10158	fb2460ea-0400-44d5-a0dc-13275cf33462
d6af0cb9-2b37-433b-a15a-007dc200ab60	ead486e4-d86e-4481-954c-4b2eb5915be2
d6af0cb9-2b37-433b-a15a-007dc200ab60	9d53d0d4-225d-4e2d-b8c1-636e8252986f
d6af0cb9-2b37-433b-a15a-007dc200ab60	fb2460ea-0400-44d5-a0dc-13275cf33462
2c1b426d-0caa-4d96-99e1-452627acf37c	ead486e4-d86e-4481-954c-4b2eb5915be2
2c1b426d-0caa-4d96-99e1-452627acf37c	9d53d0d4-225d-4e2d-b8c1-636e8252986f
2c1b426d-0caa-4d96-99e1-452627acf37c	fb2460ea-0400-44d5-a0dc-13275cf33462
e97b3d40-092c-4213-87b7-a2386baa3102	ead486e4-d86e-4481-954c-4b2eb5915be2
e97b3d40-092c-4213-87b7-a2386baa3102	9d53d0d4-225d-4e2d-b8c1-636e8252986f
e97b3d40-092c-4213-87b7-a2386baa3102	fb2460ea-0400-44d5-a0dc-13275cf33462
7c99a996-e1d5-4095-a745-0ebc57306315	ead486e4-d86e-4481-954c-4b2eb5915be2
7c99a996-e1d5-4095-a745-0ebc57306315	9d53d0d4-225d-4e2d-b8c1-636e8252986f
7c99a996-e1d5-4095-a745-0ebc57306315	fb2460ea-0400-44d5-a0dc-13275cf33462
80bc3410-1b54-487e-93d0-40c31df84f59	ead486e4-d86e-4481-954c-4b2eb5915be2
80bc3410-1b54-487e-93d0-40c31df84f59	9d53d0d4-225d-4e2d-b8c1-636e8252986f
80bc3410-1b54-487e-93d0-40c31df84f59	fb2460ea-0400-44d5-a0dc-13275cf33462
adb023ca-714a-4492-9b9c-e87d495495f5	ead486e4-d86e-4481-954c-4b2eb5915be2
adb023ca-714a-4492-9b9c-e87d495495f5	9d53d0d4-225d-4e2d-b8c1-636e8252986f
adb023ca-714a-4492-9b9c-e87d495495f5	087af487-5130-482d-96cb-bf528c9dcc6a
76c566e3-2ef2-4cc6-9e50-942932045ec3	ead486e4-d86e-4481-954c-4b2eb5915be2
76c566e3-2ef2-4cc6-9e50-942932045ec3	9d53d0d4-225d-4e2d-b8c1-636e8252986f
76c566e3-2ef2-4cc6-9e50-942932045ec3	087af487-5130-482d-96cb-bf528c9dcc6a
d65b988f-0407-452f-9baa-4c70e2b85f5a	ead486e4-d86e-4481-954c-4b2eb5915be2
d65b988f-0407-452f-9baa-4c70e2b85f5a	9d53d0d4-225d-4e2d-b8c1-636e8252986f
d65b988f-0407-452f-9baa-4c70e2b85f5a	fb2460ea-0400-44d5-a0dc-13275cf33462
827c64dd-ac34-4ddc-9214-5c4ea20bc010	ead486e4-d86e-4481-954c-4b2eb5915be2
827c64dd-ac34-4ddc-9214-5c4ea20bc010	9d53d0d4-225d-4e2d-b8c1-636e8252986f
827c64dd-ac34-4ddc-9214-5c4ea20bc010	fb2460ea-0400-44d5-a0dc-13275cf33462
98d51627-a44f-44eb-8792-3e29fb599791	ead486e4-d86e-4481-954c-4b2eb5915be2
98d51627-a44f-44eb-8792-3e29fb599791	9d53d0d4-225d-4e2d-b8c1-636e8252986f
98d51627-a44f-44eb-8792-3e29fb599791	fb2460ea-0400-44d5-a0dc-13275cf33462
453fc16b-3645-4175-9363-091181794810	ead486e4-d86e-4481-954c-4b2eb5915be2
453fc16b-3645-4175-9363-091181794810	9d53d0d4-225d-4e2d-b8c1-636e8252986f
453fc16b-3645-4175-9363-091181794810	e4b91195-69b8-404b-b9be-01e9e1aab3cd
7693e19e-2157-4163-be22-82f1fea4fe4c	ead486e4-d86e-4481-954c-4b2eb5915be2
7693e19e-2157-4163-be22-82f1fea4fe4c	9d53d0d4-225d-4e2d-b8c1-636e8252986f
42e23112-e8ab-4a03-89ce-6956603d4cf2	ead486e4-d86e-4481-954c-4b2eb5915be2
42e23112-e8ab-4a03-89ce-6956603d4cf2	9d53d0d4-225d-4e2d-b8c1-636e8252986f
42e23112-e8ab-4a03-89ce-6956603d4cf2	e4b91195-69b8-404b-b9be-01e9e1aab3cd
410f1f61-4595-435b-8e05-a1e79207701d	ead486e4-d86e-4481-954c-4b2eb5915be2
410f1f61-4595-435b-8e05-a1e79207701d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
70a6cf4e-ed34-480e-b220-b51ed7d6d142	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
71089e25-4254-4f5d-aedb-3fa6e8f5c1ef	ead486e4-d86e-4481-954c-4b2eb5915be2
71089e25-4254-4f5d-aedb-3fa6e8f5c1ef	9d53d0d4-225d-4e2d-b8c1-636e8252986f
d03c558c-6e77-4431-866b-cffabf41e322	e077aff5-7a48-4ba7-a747-36fdc62c37c6
c12775de-b932-4c05-be6a-c5cbd937af5e	ead486e4-d86e-4481-954c-4b2eb5915be2
c12775de-b932-4c05-be6a-c5cbd937af5e	9d53d0d4-225d-4e2d-b8c1-636e8252986f
c12775de-b932-4c05-be6a-c5cbd937af5e	198f5d8e-6858-4e34-a073-983dfd0bfb2b
e0b11435-3e8b-4759-820a-1e20f5ed90d0	ead486e4-d86e-4481-954c-4b2eb5915be2
e0b11435-3e8b-4759-820a-1e20f5ed90d0	9d53d0d4-225d-4e2d-b8c1-636e8252986f
e0b11435-3e8b-4759-820a-1e20f5ed90d0	e4b91195-69b8-404b-b9be-01e9e1aab3cd
a391eb6d-0535-42cc-a68a-bdc1ad356a89	ead486e4-d86e-4481-954c-4b2eb5915be2
a391eb6d-0535-42cc-a68a-bdc1ad356a89	9d53d0d4-225d-4e2d-b8c1-636e8252986f
5b736170-94b0-4a89-afbd-cc3e90e51148	ead486e4-d86e-4481-954c-4b2eb5915be2
5b736170-94b0-4a89-afbd-cc3e90e51148	9d53d0d4-225d-4e2d-b8c1-636e8252986f
41f3dc3d-11df-4391-a0ae-20894292ed8c	ead486e4-d86e-4481-954c-4b2eb5915be2
41f3dc3d-11df-4391-a0ae-20894292ed8c	9d53d0d4-225d-4e2d-b8c1-636e8252986f
23bfa01b-0db7-4ed0-b4a3-72141d3613b6	ead486e4-d86e-4481-954c-4b2eb5915be2
23bfa01b-0db7-4ed0-b4a3-72141d3613b6	9d53d0d4-225d-4e2d-b8c1-636e8252986f
23bfa01b-0db7-4ed0-b4a3-72141d3613b6	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
b8bb68c6-c006-4dcf-8733-9039c6b47f79	ead486e4-d86e-4481-954c-4b2eb5915be2
b8bb68c6-c006-4dcf-8733-9039c6b47f79	9d53d0d4-225d-4e2d-b8c1-636e8252986f
70a6cf4e-ed34-480e-b220-b51ed7d6d142	ead486e4-d86e-4481-954c-4b2eb5915be2
70a6cf4e-ed34-480e-b220-b51ed7d6d142	9d53d0d4-225d-4e2d-b8c1-636e8252986f
70a6cf4e-ed34-480e-b220-b51ed7d6d142	e4b91195-69b8-404b-b9be-01e9e1aab3cd
211e86cf-3310-493e-9473-01b72a460d69	ead486e4-d86e-4481-954c-4b2eb5915be2
211e86cf-3310-493e-9473-01b72a460d69	9d53d0d4-225d-4e2d-b8c1-636e8252986f
211e86cf-3310-493e-9473-01b72a460d69	e4b91195-69b8-404b-b9be-01e9e1aab3cd
fcfa14eb-ce15-42ef-a11a-c8809a7e2d08	ead486e4-d86e-4481-954c-4b2eb5915be2
fcfa14eb-ce15-42ef-a11a-c8809a7e2d08	9d53d0d4-225d-4e2d-b8c1-636e8252986f
fcfa14eb-ce15-42ef-a11a-c8809a7e2d08	8aa827d6-d61f-4ad4-a217-9be9cc171b30
fcfa14eb-ce15-42ef-a11a-c8809a7e2d08	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
7453914b-3eae-4608-8968-d84d8cee0b2e	ead486e4-d86e-4481-954c-4b2eb5915be2
7453914b-3eae-4608-8968-d84d8cee0b2e	9d53d0d4-225d-4e2d-b8c1-636e8252986f
7453914b-3eae-4608-8968-d84d8cee0b2e	e4b91195-69b8-404b-b9be-01e9e1aab3cd
6c145422-ddb4-4e73-b1f5-da902154f8ba	ead486e4-d86e-4481-954c-4b2eb5915be2
6c145422-ddb4-4e73-b1f5-da902154f8ba	9d53d0d4-225d-4e2d-b8c1-636e8252986f
6c145422-ddb4-4e73-b1f5-da902154f8ba	e4b91195-69b8-404b-b9be-01e9e1aab3cd
2a77d30e-cf15-433c-8f35-6f66f742692e	ead486e4-d86e-4481-954c-4b2eb5915be2
2a77d30e-cf15-433c-8f35-6f66f742692e	9d53d0d4-225d-4e2d-b8c1-636e8252986f
2a77d30e-cf15-433c-8f35-6f66f742692e	198f5d8e-6858-4e34-a073-983dfd0bfb2b
5538c5f4-75cd-47b9-a783-fba5a5b82312	ead486e4-d86e-4481-954c-4b2eb5915be2
5538c5f4-75cd-47b9-a783-fba5a5b82312	5330410b-7132-4267-a5d9-c9f42fe3725b
5538c5f4-75cd-47b9-a783-fba5a5b82312	8aa827d6-d61f-4ad4-a217-9be9cc171b30
35b2f33d-73bf-4146-96dd-efe1b2c22cb6	ead486e4-d86e-4481-954c-4b2eb5915be2
35b2f33d-73bf-4146-96dd-efe1b2c22cb6	5330410b-7132-4267-a5d9-c9f42fe3725b
589332bf-dd5e-4e70-b505-f32a9e68aa4d	ead486e4-d86e-4481-954c-4b2eb5915be2
589332bf-dd5e-4e70-b505-f32a9e68aa4d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
589332bf-dd5e-4e70-b505-f32a9e68aa4d	cd8e90af-faec-46b7-bff2-a346a4ea5266
589332bf-dd5e-4e70-b505-f32a9e68aa4d	e077aff5-7a48-4ba7-a747-36fdc62c37c6
d03c558c-6e77-4431-866b-cffabf41e322	ead486e4-d86e-4481-954c-4b2eb5915be2
d03c558c-6e77-4431-866b-cffabf41e322	9d53d0d4-225d-4e2d-b8c1-636e8252986f
d03c558c-6e77-4431-866b-cffabf41e322	cd8e90af-faec-46b7-bff2-a346a4ea5266
6dc7ecae-6ce5-4544-887d-cd2fe22a5cbe	ead486e4-d86e-4481-954c-4b2eb5915be2
6dc7ecae-6ce5-4544-887d-cd2fe22a5cbe	9d53d0d4-225d-4e2d-b8c1-636e8252986f
6dc7ecae-6ce5-4544-887d-cd2fe22a5cbe	8797fc27-5ad8-4c6a-a78a-192812f235e4
93e90395-cd7b-4bdf-8eca-9dc3252fda66	ead486e4-d86e-4481-954c-4b2eb5915be2
93e90395-cd7b-4bdf-8eca-9dc3252fda66	9d53d0d4-225d-4e2d-b8c1-636e8252986f
93e90395-cd7b-4bdf-8eca-9dc3252fda66	8797fc27-5ad8-4c6a-a78a-192812f235e4
85557bdd-db28-4f14-9518-59d08c659f37	ead486e4-d86e-4481-954c-4b2eb5915be2
85557bdd-db28-4f14-9518-59d08c659f37	9d53d0d4-225d-4e2d-b8c1-636e8252986f
85557bdd-db28-4f14-9518-59d08c659f37	8797fc27-5ad8-4c6a-a78a-192812f235e4
9e7997d4-7d96-41f6-b9c2-3ac78a2369c2	ead486e4-d86e-4481-954c-4b2eb5915be2
9e7997d4-7d96-41f6-b9c2-3ac78a2369c2	9d53d0d4-225d-4e2d-b8c1-636e8252986f
9e7997d4-7d96-41f6-b9c2-3ac78a2369c2	8797fc27-5ad8-4c6a-a78a-192812f235e4
425be91a-5524-4b91-b61b-0f9fce49fc33	ead486e4-d86e-4481-954c-4b2eb5915be2
425be91a-5524-4b91-b61b-0f9fce49fc33	9d53d0d4-225d-4e2d-b8c1-636e8252986f
425be91a-5524-4b91-b61b-0f9fce49fc33	8797fc27-5ad8-4c6a-a78a-192812f235e4
e1005aec-ce4a-4179-9dca-3d2ea7a59d2b	ead486e4-d86e-4481-954c-4b2eb5915be2
e1005aec-ce4a-4179-9dca-3d2ea7a59d2b	9d53d0d4-225d-4e2d-b8c1-636e8252986f
e1005aec-ce4a-4179-9dca-3d2ea7a59d2b	8797fc27-5ad8-4c6a-a78a-192812f235e4
7453914b-3eae-4608-8968-d84d8cee0b2e	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
af4a61b3-832c-4bb0-9f09-4f2fe994fe33	83c6a558-805c-4156-94f6-fa7ea55c7d84
99aead0d-e75d-4b10-b94a-3375f2590cfc	ef129f64-64f0-4f75-ac54-a5ba539b41c9
bd8f826a-dd0a-45cb-aaf9-dfa10d8ede0f	ead486e4-d86e-4481-954c-4b2eb5915be2
bd8f826a-dd0a-45cb-aaf9-dfa10d8ede0f	9d53d0d4-225d-4e2d-b8c1-636e8252986f
bd8f826a-dd0a-45cb-aaf9-dfa10d8ede0f	498a3058-5e74-4e14-b678-214fb63517ad
bd8f826a-dd0a-45cb-aaf9-dfa10d8ede0f	7a72ef5b-62a6-45be-9645-8bfa9a21787b
cc4498f1-0b50-4ff5-9fdd-04668cbf3115	ead486e4-d86e-4481-954c-4b2eb5915be2
cc4498f1-0b50-4ff5-9fdd-04668cbf3115	9d53d0d4-225d-4e2d-b8c1-636e8252986f
cc4498f1-0b50-4ff5-9fdd-04668cbf3115	498a3058-5e74-4e14-b678-214fb63517ad
cc4498f1-0b50-4ff5-9fdd-04668cbf3115	7a72ef5b-62a6-45be-9645-8bfa9a21787b
e0b3cba1-87f9-4e40-9716-f75d2a4ba7b4	ead486e4-d86e-4481-954c-4b2eb5915be2
e0b3cba1-87f9-4e40-9716-f75d2a4ba7b4	9d53d0d4-225d-4e2d-b8c1-636e8252986f
e0b3cba1-87f9-4e40-9716-f75d2a4ba7b4	498a3058-5e74-4e14-b678-214fb63517ad
e0b3cba1-87f9-4e40-9716-f75d2a4ba7b4	7a72ef5b-62a6-45be-9645-8bfa9a21787b
817577ac-27c5-4441-8151-68c7353dd936	ead486e4-d86e-4481-954c-4b2eb5915be2
817577ac-27c5-4441-8151-68c7353dd936	9d53d0d4-225d-4e2d-b8c1-636e8252986f
817577ac-27c5-4441-8151-68c7353dd936	498a3058-5e74-4e14-b678-214fb63517ad
817577ac-27c5-4441-8151-68c7353dd936	98fb72a0-e0f0-4f92-ba5c-bfc8a863f96e
637da0b8-6f33-4827-924e-bfaf63ac1c95	ead486e4-d86e-4481-954c-4b2eb5915be2
637da0b8-6f33-4827-924e-bfaf63ac1c95	9d53d0d4-225d-4e2d-b8c1-636e8252986f
637da0b8-6f33-4827-924e-bfaf63ac1c95	498a3058-5e74-4e14-b678-214fb63517ad
8f8adf79-27d5-454a-9eeb-c961f693110b	ead486e4-d86e-4481-954c-4b2eb5915be2
8f8adf79-27d5-454a-9eeb-c961f693110b	9d53d0d4-225d-4e2d-b8c1-636e8252986f
8f8adf79-27d5-454a-9eeb-c961f693110b	498a3058-5e74-4e14-b678-214fb63517ad
8f8adf79-27d5-454a-9eeb-c961f693110b	7a72ef5b-62a6-45be-9645-8bfa9a21787b
80da21d1-b220-4d7e-bf00-978168e1f18d	ead486e4-d86e-4481-954c-4b2eb5915be2
80da21d1-b220-4d7e-bf00-978168e1f18d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
80da21d1-b220-4d7e-bf00-978168e1f18d	498a3058-5e74-4e14-b678-214fb63517ad
80da21d1-b220-4d7e-bf00-978168e1f18d	7a72ef5b-62a6-45be-9645-8bfa9a21787b
d5dd7498-ce04-4db2-924f-859cd4429d99	ead486e4-d86e-4481-954c-4b2eb5915be2
d5dd7498-ce04-4db2-924f-859cd4429d99	9d53d0d4-225d-4e2d-b8c1-636e8252986f
d5dd7498-ce04-4db2-924f-859cd4429d99	498a3058-5e74-4e14-b678-214fb63517ad
d5dd7498-ce04-4db2-924f-859cd4429d99	7a72ef5b-62a6-45be-9645-8bfa9a21787b
0537629c-4d68-4b39-bee9-6e1b71b64e2c	ead486e4-d86e-4481-954c-4b2eb5915be2
0537629c-4d68-4b39-bee9-6e1b71b64e2c	9d53d0d4-225d-4e2d-b8c1-636e8252986f
0537629c-4d68-4b39-bee9-6e1b71b64e2c	498a3058-5e74-4e14-b678-214fb63517ad
0537629c-4d68-4b39-bee9-6e1b71b64e2c	98fb72a0-e0f0-4f92-ba5c-bfc8a863f96e
fbccdd86-6a66-4f56-b094-9c3d60123a44	ead486e4-d86e-4481-954c-4b2eb5915be2
fbccdd86-6a66-4f56-b094-9c3d60123a44	5330410b-7132-4267-a5d9-c9f42fe3725b
fbccdd86-6a66-4f56-b094-9c3d60123a44	498a3058-5e74-4e14-b678-214fb63517ad
fbccdd86-6a66-4f56-b094-9c3d60123a44	7a72ef5b-62a6-45be-9645-8bfa9a21787b
4b7a04aa-d072-4302-8130-8c32c0bc3c3d	fb2460ea-0400-44d5-a0dc-13275cf33462
2ad7e362-44ec-4b8c-8947-92f08b181c4d	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
1ede333b-9e83-49b7-8b57-c75b86cff04b	517d44ba-ff4c-4077-b99a-1ca8021fa21a
1ede333b-9e83-49b7-8b57-c75b86cff04b	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
1ede333b-9e83-49b7-8b57-c75b86cff04b	5d9fa316-db1c-4307-8ecc-839ba82df21f
4bdfd811-3d52-44e9-9007-082cf5beea50	517d44ba-ff4c-4077-b99a-1ca8021fa21a
4bdfd811-3d52-44e9-9007-082cf5beea50	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
4bdfd811-3d52-44e9-9007-082cf5beea50	b1445426-4264-4b65-8ec0-adfc02142cd9
773125c9-a280-4644-a6c6-eb6ad1e79706	517d44ba-ff4c-4077-b99a-1ca8021fa21a
773125c9-a280-4644-a6c6-eb6ad1e79706	9d53d0d4-225d-4e2d-b8c1-636e8252986f
773125c9-a280-4644-a6c6-eb6ad1e79706	5d9fa316-db1c-4307-8ecc-839ba82df21f
072c750d-d727-408f-8ab7-336e38d85119	517d44ba-ff4c-4077-b99a-1ca8021fa21a
072c750d-d727-408f-8ab7-336e38d85119	9d53d0d4-225d-4e2d-b8c1-636e8252986f
072c750d-d727-408f-8ab7-336e38d85119	5d9fa316-db1c-4307-8ecc-839ba82df21f
41001ec5-51bf-42f9-b81d-afb5e1a3f997	517d44ba-ff4c-4077-b99a-1ca8021fa21a
41001ec5-51bf-42f9-b81d-afb5e1a3f997	9d53d0d4-225d-4e2d-b8c1-636e8252986f
41001ec5-51bf-42f9-b81d-afb5e1a3f997	5d9fa316-db1c-4307-8ecc-839ba82df21f
66c7155a-cbc7-4129-9b6e-c5a3057cd8cb	517d44ba-ff4c-4077-b99a-1ca8021fa21a
66c7155a-cbc7-4129-9b6e-c5a3057cd8cb	9d53d0d4-225d-4e2d-b8c1-636e8252986f
66c7155a-cbc7-4129-9b6e-c5a3057cd8cb	5d9fa316-db1c-4307-8ecc-839ba82df21f
306b40a4-7d32-4c0a-b810-7c8608bb3919	517d44ba-ff4c-4077-b99a-1ca8021fa21a
306b40a4-7d32-4c0a-b810-7c8608bb3919	9d53d0d4-225d-4e2d-b8c1-636e8252986f
306b40a4-7d32-4c0a-b810-7c8608bb3919	9b702516-037c-4524-a21a-6faa71890b5f
6089edff-768a-4cef-b6a4-bca952125d99	517d44ba-ff4c-4077-b99a-1ca8021fa21a
6089edff-768a-4cef-b6a4-bca952125d99	9d53d0d4-225d-4e2d-b8c1-636e8252986f
6089edff-768a-4cef-b6a4-bca952125d99	9b702516-037c-4524-a21a-6faa71890b5f
b4d033fd-7786-4b56-acef-197a356bca16	96265c95-808b-4fa1-9480-db9804fcc501
6fdf001f-f9fa-4161-9542-fd73946cc5f4	517d44ba-ff4c-4077-b99a-1ca8021fa21a
6fdf001f-f9fa-4161-9542-fd73946cc5f4	9d53d0d4-225d-4e2d-b8c1-636e8252986f
6fdf001f-f9fa-4161-9542-fd73946cc5f4	9b702516-037c-4524-a21a-6faa71890b5f
c583d394-6df2-4c7d-a6d7-1a37e98bcc43	517d44ba-ff4c-4077-b99a-1ca8021fa21a
c583d394-6df2-4c7d-a6d7-1a37e98bcc43	9d53d0d4-225d-4e2d-b8c1-636e8252986f
225d9895-0d96-43aa-b510-58e0db0105aa	47b511ec-2288-4a83-aa51-947d81ecc29b
c583d394-6df2-4c7d-a6d7-1a37e98bcc43	5d9fa316-db1c-4307-8ecc-839ba82df21f
b2e74b49-cc23-43ab-ba45-507b6885b9e5	517d44ba-ff4c-4077-b99a-1ca8021fa21a
b2e74b49-cc23-43ab-ba45-507b6885b9e5	9d53d0d4-225d-4e2d-b8c1-636e8252986f
b2e74b49-cc23-43ab-ba45-507b6885b9e5	b28b9374-0324-4613-8fb5-3ddcfa23aa81
9a9a0b5d-14e6-46cb-8c37-7738ddc10ef1	517d44ba-ff4c-4077-b99a-1ca8021fa21a
9a9a0b5d-14e6-46cb-8c37-7738ddc10ef1	9d53d0d4-225d-4e2d-b8c1-636e8252986f
9a9a0b5d-14e6-46cb-8c37-7738ddc10ef1	b28b9374-0324-4613-8fb5-3ddcfa23aa81
225d9895-0d96-43aa-b510-58e0db0105aa	83c6a558-805c-4156-94f6-fa7ea55c7d84
79bed153-30da-4536-8f6e-ddb7e0b32186	517d44ba-ff4c-4077-b99a-1ca8021fa21a
79bed153-30da-4536-8f6e-ddb7e0b32186	9d53d0d4-225d-4e2d-b8c1-636e8252986f
79bed153-30da-4536-8f6e-ddb7e0b32186	b28b9374-0324-4613-8fb5-3ddcfa23aa81
225d9895-0d96-43aa-b510-58e0db0105aa	40f0c389-dd02-4d42-8cb0-d717312a0899
35b2f33d-73bf-4146-96dd-efe1b2c22cb6	9d53d0d4-225d-4e2d-b8c1-636e8252986f
35b2f33d-73bf-4146-96dd-efe1b2c22cb6	498a3058-5e74-4e14-b678-214fb63517ad
de67762b-3e54-45c0-b4b0-c46934833cb7	83c6a558-805c-4156-94f6-fa7ea55c7d84
de67762b-3e54-45c0-b4b0-c46934833cb7	efc608be-52fe-4465-9684-e826872847af
1f7b28bd-1909-469b-8fbe-f1278d8d9eab	517d44ba-ff4c-4077-b99a-1ca8021fa21a
1f7b28bd-1909-469b-8fbe-f1278d8d9eab	9d53d0d4-225d-4e2d-b8c1-636e8252986f
1f7b28bd-1909-469b-8fbe-f1278d8d9eab	b28b9374-0324-4613-8fb5-3ddcfa23aa81
eec7d2bc-8234-42d7-8cec-5fa494c85dd4	517d44ba-ff4c-4077-b99a-1ca8021fa21a
eec7d2bc-8234-42d7-8cec-5fa494c85dd4	5330410b-7132-4267-a5d9-c9f42fe3725b
3392980d-0fa9-42e0-843d-452658d16065	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
3392980d-0fa9-42e0-843d-452658d16065	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
3392980d-0fa9-42e0-843d-452658d16065	b7403172-6600-4bb7-b53e-aac6278c9edc
64f18550-2abb-4d88-b335-60f3fdd02fda	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
64f18550-2abb-4d88-b335-60f3fdd02fda	9d53d0d4-225d-4e2d-b8c1-636e8252986f
64f18550-2abb-4d88-b335-60f3fdd02fda	6187cc84-58b8-4026-bd65-d6852c7330b6
c567dcf4-465d-4517-a168-84ef6acafc45	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
c567dcf4-465d-4517-a168-84ef6acafc45	9d53d0d4-225d-4e2d-b8c1-636e8252986f
c567dcf4-465d-4517-a168-84ef6acafc45	6187cc84-58b8-4026-bd65-d6852c7330b6
a2fcc276-b539-402e-955b-daa6accaedec	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
a2fcc276-b539-402e-955b-daa6accaedec	9d53d0d4-225d-4e2d-b8c1-636e8252986f
a2fcc276-b539-402e-955b-daa6accaedec	6187cc84-58b8-4026-bd65-d6852c7330b6
5c7938cc-d4fc-4052-b043-549cb3875346	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
5c7938cc-d4fc-4052-b043-549cb3875346	9d53d0d4-225d-4e2d-b8c1-636e8252986f
5c7938cc-d4fc-4052-b043-549cb3875346	793936a3-d476-4f95-9326-8e70609cec2e
5742a546-9755-46ca-90c4-345f39526e04	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
5742a546-9755-46ca-90c4-345f39526e04	9d53d0d4-225d-4e2d-b8c1-636e8252986f
5742a546-9755-46ca-90c4-345f39526e04	793936a3-d476-4f95-9326-8e70609cec2e
96c80958-1ff5-457c-a5cc-afc97423f5d4	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
96c80958-1ff5-457c-a5cc-afc97423f5d4	9d53d0d4-225d-4e2d-b8c1-636e8252986f
96c80958-1ff5-457c-a5cc-afc97423f5d4	793936a3-d476-4f95-9326-8e70609cec2e
cfbb49b0-7d23-4fcf-af2b-7572046dbc8d	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
cfbb49b0-7d23-4fcf-af2b-7572046dbc8d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
cfbb49b0-7d23-4fcf-af2b-7572046dbc8d	793936a3-d476-4f95-9326-8e70609cec2e
03edfa63-38ac-4054-b652-1054f00e790e	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
03edfa63-38ac-4054-b652-1054f00e790e	9d53d0d4-225d-4e2d-b8c1-636e8252986f
03edfa63-38ac-4054-b652-1054f00e790e	7b9e9d6d-573d-489c-a80c-73c9354f0f80
2b0dc7b8-df4a-4f4f-9a68-63347c69d16f	fb2460ea-0400-44d5-a0dc-13275cf33462
bba24570-8a29-476a-a48e-e392bf91c856	40f0c389-dd02-4d42-8cb0-d717312a0899
6c145422-ddb4-4e73-b1f5-da902154f8ba	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
39a656fd-8b54-4561-857e-f53c99b504c8	9d53d0d4-225d-4e2d-b8c1-636e8252986f
39a656fd-8b54-4561-857e-f53c99b504c8	ef129f64-64f0-4f75-ac54-a5ba539b41c9
7406245f-5c90-4832-9f8c-52686f4342c6	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
7406245f-5c90-4832-9f8c-52686f4342c6	9d53d0d4-225d-4e2d-b8c1-636e8252986f
7406245f-5c90-4832-9f8c-52686f4342c6	cd3876c6-b101-4c10-ae09-113ed6e61a83
1659d8f7-cd81-44dd-8df2-b453bdf6a6de	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
1659d8f7-cd81-44dd-8df2-b453bdf6a6de	9d53d0d4-225d-4e2d-b8c1-636e8252986f
1659d8f7-cd81-44dd-8df2-b453bdf6a6de	cd3876c6-b101-4c10-ae09-113ed6e61a83
edf7f254-c617-4337-b930-864cea291683	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
edf7f254-c617-4337-b930-864cea291683	9d53d0d4-225d-4e2d-b8c1-636e8252986f
edf7f254-c617-4337-b930-864cea291683	9f662cf5-f238-47d6-8309-adc984a3133e
3f70589b-372d-4472-91a5-97e73dd051b0	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
3f70589b-372d-4472-91a5-97e73dd051b0	9d53d0d4-225d-4e2d-b8c1-636e8252986f
3f70589b-372d-4472-91a5-97e73dd051b0	9f662cf5-f238-47d6-8309-adc984a3133e
52ce1eaa-844d-40c7-8404-bf8ce8f0b514	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
52ce1eaa-844d-40c7-8404-bf8ce8f0b514	5330410b-7132-4267-a5d9-c9f42fe3725b
52ce1eaa-844d-40c7-8404-bf8ce8f0b514	8b150197-e995-412a-89a8-399508ba29c0
184074c0-5358-4d3b-95f3-999b3186cb2a	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
184074c0-5358-4d3b-95f3-999b3186cb2a	9d53d0d4-225d-4e2d-b8c1-636e8252986f
184074c0-5358-4d3b-95f3-999b3186cb2a	f03abf42-10e2-4f96-ac84-d8ec4f017a7e
a71e8f1a-7ff1-446a-9358-c64a315e5d4a	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
a71e8f1a-7ff1-446a-9358-c64a315e5d4a	9d53d0d4-225d-4e2d-b8c1-636e8252986f
a71e8f1a-7ff1-446a-9358-c64a315e5d4a	f03abf42-10e2-4f96-ac84-d8ec4f017a7e
65a1f14f-f4b3-41ef-926f-da13a80a3f40	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
65a1f14f-f4b3-41ef-926f-da13a80a3f40	9d53d0d4-225d-4e2d-b8c1-636e8252986f
65a1f14f-f4b3-41ef-926f-da13a80a3f40	be1f0d24-7859-4a39-bee6-f247ebbd2eb4
8612f738-c71c-491d-a0db-b3433bd6cb1d	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
8612f738-c71c-491d-a0db-b3433bd6cb1d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
8612f738-c71c-491d-a0db-b3433bd6cb1d	838d35cf-3c95-467a-83a2-fc2bad4cd91a
b9009bcd-f940-4649-8a3c-ba5556675dc5	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
b9009bcd-f940-4649-8a3c-ba5556675dc5	9d53d0d4-225d-4e2d-b8c1-636e8252986f
b9009bcd-f940-4649-8a3c-ba5556675dc5	838d35cf-3c95-467a-83a2-fc2bad4cd91a
a208776a-6ac5-491e-9889-e9d1d2212114	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
a208776a-6ac5-491e-9889-e9d1d2212114	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
a208776a-6ac5-491e-9889-e9d1d2212114	838d35cf-3c95-467a-83a2-fc2bad4cd91a
39d748eb-0deb-4423-9d64-8a6870aadfa5	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
39d748eb-0deb-4423-9d64-8a6870aadfa5	9d53d0d4-225d-4e2d-b8c1-636e8252986f
39d748eb-0deb-4423-9d64-8a6870aadfa5	68b3fcbd-4398-4489-8bd8-c59b336d5d46
b897ae44-dca2-4b52-99d9-658f188f6b4d	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
b897ae44-dca2-4b52-99d9-658f188f6b4d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
b897ae44-dca2-4b52-99d9-658f188f6b4d	3ff10831-b2f4-4731-aa18-3cf1154808cd
8df881ad-347f-4b5e-a9cc-f2e06d94d9f0	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
8df881ad-347f-4b5e-a9cc-f2e06d94d9f0	9d53d0d4-225d-4e2d-b8c1-636e8252986f
0aa4e862-a64e-40a4-b4be-8f3b28707fcd	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
0aa4e862-a64e-40a4-b4be-8f3b28707fcd	9d53d0d4-225d-4e2d-b8c1-636e8252986f
0aa4e862-a64e-40a4-b4be-8f3b28707fcd	68b3fcbd-4398-4489-8bd8-c59b336d5d46
8c00bdb2-faa9-42ea-ac5d-274f57f72e2b	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
8c00bdb2-faa9-42ea-ac5d-274f57f72e2b	9d53d0d4-225d-4e2d-b8c1-636e8252986f
8c00bdb2-faa9-42ea-ac5d-274f57f72e2b	69587d12-1124-4bfd-9b9c-1f04c657225a
4f92f70a-0be3-4b90-b4cf-43bd68b51d7c	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
4f92f70a-0be3-4b90-b4cf-43bd68b51d7c	9d53d0d4-225d-4e2d-b8c1-636e8252986f
4f92f70a-0be3-4b90-b4cf-43bd68b51d7c	69587d12-1124-4bfd-9b9c-1f04c657225a
30c9fd1c-1fb1-49d5-ae2a-f636e68e0c71	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
30c9fd1c-1fb1-49d5-ae2a-f636e68e0c71	9d53d0d4-225d-4e2d-b8c1-636e8252986f
30c9fd1c-1fb1-49d5-ae2a-f636e68e0c71	69587d12-1124-4bfd-9b9c-1f04c657225a
ca2bea26-6610-4512-b6b1-69d1a11a9924	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
ca2bea26-6610-4512-b6b1-69d1a11a9924	9d53d0d4-225d-4e2d-b8c1-636e8252986f
ca2bea26-6610-4512-b6b1-69d1a11a9924	69587d12-1124-4bfd-9b9c-1f04c657225a
fd01192e-4f22-4aa3-99d3-64b8f8110395	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
fd01192e-4f22-4aa3-99d3-64b8f8110395	9d53d0d4-225d-4e2d-b8c1-636e8252986f
fd01192e-4f22-4aa3-99d3-64b8f8110395	69587d12-1124-4bfd-9b9c-1f04c657225a
9c1d7250-b948-4562-aa74-45775cebb050	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
9c1d7250-b948-4562-aa74-45775cebb050	9d53d0d4-225d-4e2d-b8c1-636e8252986f
9c1d7250-b948-4562-aa74-45775cebb050	557914c0-d477-461d-b443-2e6f9ba26865
694008c2-35e0-463b-9f2b-e5fd6e152299	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
694008c2-35e0-463b-9f2b-e5fd6e152299	9d53d0d4-225d-4e2d-b8c1-636e8252986f
694008c2-35e0-463b-9f2b-e5fd6e152299	557914c0-d477-461d-b443-2e6f9ba26865
b6438b33-ad1f-4662-b5d9-1cc431502eee	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
b6438b33-ad1f-4662-b5d9-1cc431502eee	9d53d0d4-225d-4e2d-b8c1-636e8252986f
b6438b33-ad1f-4662-b5d9-1cc431502eee	557914c0-d477-461d-b443-2e6f9ba26865
a742e9a5-2400-4183-a881-f8823c72754d	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
a742e9a5-2400-4183-a881-f8823c72754d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
a742e9a5-2400-4183-a881-f8823c72754d	557914c0-d477-461d-b443-2e6f9ba26865
46c044d8-b0ec-4ffc-a81b-0a5cb5baa282	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
46c044d8-b0ec-4ffc-a81b-0a5cb5baa282	9d53d0d4-225d-4e2d-b8c1-636e8252986f
46c044d8-b0ec-4ffc-a81b-0a5cb5baa282	557914c0-d477-461d-b443-2e6f9ba26865
483a6b86-98ee-42a1-826f-adfd2fbf1fdc	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
483a6b86-98ee-42a1-826f-adfd2fbf1fdc	9d53d0d4-225d-4e2d-b8c1-636e8252986f
483a6b86-98ee-42a1-826f-adfd2fbf1fdc	557914c0-d477-461d-b443-2e6f9ba26865
bbba3699-0de5-4fe4-9690-773e9d3e9a54	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
bbba3699-0de5-4fe4-9690-773e9d3e9a54	9d53d0d4-225d-4e2d-b8c1-636e8252986f
bbba3699-0de5-4fe4-9690-773e9d3e9a54	5780a1d6-dc15-47d4-a195-16c68cec22cf
4e70f2f1-23d0-4607-a1a3-d16ac24f7496	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
4e70f2f1-23d0-4607-a1a3-d16ac24f7496	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
4e70f2f1-23d0-4607-a1a3-d16ac24f7496	5780a1d6-dc15-47d4-a195-16c68cec22cf
ba91c993-c5eb-4c7f-bbb3-f0a6c959a1ad	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
ba91c993-c5eb-4c7f-bbb3-f0a6c959a1ad	9d53d0d4-225d-4e2d-b8c1-636e8252986f
ba91c993-c5eb-4c7f-bbb3-f0a6c959a1ad	5780a1d6-dc15-47d4-a195-16c68cec22cf
14d7cfc8-3518-4d12-be2e-1d1cac5c162e	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
14d7cfc8-3518-4d12-be2e-1d1cac5c162e	9d53d0d4-225d-4e2d-b8c1-636e8252986f
14d7cfc8-3518-4d12-be2e-1d1cac5c162e	3f689c05-1f87-4259-9979-7f5943095e59
25645ada-7cf4-4cca-96f0-e342a525b0e5	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
25645ada-7cf4-4cca-96f0-e342a525b0e5	9d53d0d4-225d-4e2d-b8c1-636e8252986f
25645ada-7cf4-4cca-96f0-e342a525b0e5	3f689c05-1f87-4259-9979-7f5943095e59
f0ceea3d-6500-4dba-b608-52376d328a22	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
f0ceea3d-6500-4dba-b608-52376d328a22	9d53d0d4-225d-4e2d-b8c1-636e8252986f
f0ceea3d-6500-4dba-b608-52376d328a22	3f689c05-1f87-4259-9979-7f5943095e59
17439ce4-62eb-4bc2-822d-2ca6a77afc52	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
17439ce4-62eb-4bc2-822d-2ca6a77afc52	9d53d0d4-225d-4e2d-b8c1-636e8252986f
17439ce4-62eb-4bc2-822d-2ca6a77afc52	5d9c9422-2c46-4165-9924-21674236f140
933272cf-fa0b-4dbf-be30-39decc19a76b	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
933272cf-fa0b-4dbf-be30-39decc19a76b	9d53d0d4-225d-4e2d-b8c1-636e8252986f
933272cf-fa0b-4dbf-be30-39decc19a76b	5d9c9422-2c46-4165-9924-21674236f140
61055351-1364-40b6-9ccf-d30190581837	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
61055351-1364-40b6-9ccf-d30190581837	9d53d0d4-225d-4e2d-b8c1-636e8252986f
61055351-1364-40b6-9ccf-d30190581837	2d3bca45-bce7-4a20-9a17-ca8ce15bd8a0
762ef5fd-5980-40cd-848a-3d2e69c208b7	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
762ef5fd-5980-40cd-848a-3d2e69c208b7	9d53d0d4-225d-4e2d-b8c1-636e8252986f
762ef5fd-5980-40cd-848a-3d2e69c208b7	2d3bca45-bce7-4a20-9a17-ca8ce15bd8a0
b8bb68c6-c006-4dcf-8733-9039c6b47f79	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
b8bb68c6-c006-4dcf-8733-9039c6b47f79	8aa827d6-d61f-4ad4-a217-9be9cc171b30
0f64fc07-a713-454a-aa0f-185bf0b64e4d	40f0c389-dd02-4d42-8cb0-d717312a0899
8df881ad-347f-4b5e-a9cc-f2e06d94d9f0	91742a87-7eeb-41a8-b6da-1c82a284d3da
b06edd96-4ff2-4aa1-927d-9e279927564c	40f0c389-dd02-4d42-8cb0-d717312a0899
52594a94-5183-4ef5-bd78-87364ae107e9	83c6a558-805c-4156-94f6-fa7ea55c7d84
c3e3547f-b151-4d71-8375-0d78f70fbb94	83c6a558-805c-4156-94f6-fa7ea55c7d84
3db63450-b5f7-44c3-8fbe-b4b457ed524f	83c6a558-805c-4156-94f6-fa7ea55c7d84
309376aa-0ef9-4783-89db-4efd5ec1d8dc	83c6a558-805c-4156-94f6-fa7ea55c7d84
309376aa-0ef9-4783-89db-4efd5ec1d8dc	96265c95-808b-4fa1-9480-db9804fcc501
211e86cf-3310-493e-9473-01b72a460d69	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
23bfa01b-0db7-4ed0-b4a3-72141d3613b6	8aa827d6-d61f-4ad4-a217-9be9cc171b30
636b7ab9-80a2-4a0e-ab47-0b8984ea7019	83c6a558-805c-4156-94f6-fa7ea55c7d84
636b7ab9-80a2-4a0e-ab47-0b8984ea7019	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
ab5b147a-91f7-4626-9b1d-12de3ba69060	83c6a558-805c-4156-94f6-fa7ea55c7d84
ab5b147a-91f7-4626-9b1d-12de3ba69060	96265c95-808b-4fa1-9480-db9804fcc501
6c7e11ac-508f-4c30-b4ef-918a6c64d5fb	83c6a558-805c-4156-94f6-fa7ea55c7d84
6c7e11ac-508f-4c30-b4ef-918a6c64d5fb	1a27aaf9-6a96-4f1d-9e7c-460d96c06879
5538c5f4-75cd-47b9-a783-fba5a5b82312	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
e0b11435-3e8b-4759-820a-1e20f5ed90d0	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
54725f67-69d4-4656-a833-b0ce6cf80f74	40f0c389-dd02-4d42-8cb0-d717312a0899
4086ed7e-9d0b-4a71-ae98-3eaaa9b59aff	47b511ec-2288-4a83-aa51-947d81ecc29b
4086ed7e-9d0b-4a71-ae98-3eaaa9b59aff	40f0c389-dd02-4d42-8cb0-d717312a0899
a9e26951-8e75-405d-8032-5fd33a9374cd	96265c95-808b-4fa1-9480-db9804fcc501
fcfa14eb-ce15-42ef-a11a-c8809a7e2d08	e4b91195-69b8-404b-b9be-01e9e1aab3cd
9a9a0b5d-14e6-46cb-8c37-7738ddc10ef1	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
a391eb6d-0535-42cc-a68a-bdc1ad356a89	cd8e90af-faec-46b7-bff2-a346a4ea5266
41f3dc3d-11df-4391-a0ae-20894292ed8c	cd8e90af-faec-46b7-bff2-a346a4ea5266
41f3dc3d-11df-4391-a0ae-20894292ed8c	9a2b7a5b-d0fa-4bc2-aa7f-bfe2fd26ce78
6977c14f-6d31-41ed-885f-b0476b696c57	83c6a558-805c-4156-94f6-fa7ea55c7d84
6977c14f-6d31-41ed-885f-b0476b696c57	47b511ec-2288-4a83-aa51-947d81ecc29b
ea362b41-8e60-43ee-ad1a-8594677f08ba	47b511ec-2288-4a83-aa51-947d81ecc29b
ea362b41-8e60-43ee-ad1a-8594677f08ba	83c6a558-805c-4156-94f6-fa7ea55c7d84
eb68d1a9-6b4a-47a3-ad4c-7b79df2a8ed8	47b511ec-2288-4a83-aa51-947d81ecc29b
410f1f61-4595-435b-8e05-a1e79207701d	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
410f1f61-4595-435b-8e05-a1e79207701d	198f5d8e-6858-4e34-a073-983dfd0bfb2b
42e23112-e8ab-4a03-89ce-6956603d4cf2	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
cb55c572-1f1c-48f7-be4d-e1f9d7f3f2a6	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
cb55c572-1f1c-48f7-be4d-e1f9d7f3f2a6	ef129f64-64f0-4f75-ac54-a5ba539b41c9
71089e25-4254-4f5d-aedb-3fa6e8f5c1ef	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
71089e25-4254-4f5d-aedb-3fa6e8f5c1ef	198f5d8e-6858-4e34-a073-983dfd0bfb2b
52ce1eaa-844d-40c7-8404-bf8ce8f0b514	9d53d0d4-225d-4e2d-b8c1-636e8252986f
eec7d2bc-8234-42d7-8cec-5fa494c85dd4	5d9fa316-db1c-4307-8ecc-839ba82df21f
de8d8df8-f5b9-4ae3-a468-d9996ffb1a5d	9d53d0d4-225d-4e2d-b8c1-636e8252986f
de8d8df8-f5b9-4ae3-a468-d9996ffb1a5d	b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57
de8d8df8-f5b9-4ae3-a468-d9996ffb1a5d	ef129f64-64f0-4f75-ac54-a5ba539b41c9
64355566-9f21-46c3-9ee2-d8a199c17c1c	efc608be-52fe-4465-9684-e826872847af
1ec144a8-b80d-41ab-aa90-a0355571659f	47b511ec-2288-4a83-aa51-947d81ecc29b
fd9df923-7750-4da3-8c81-7e084712a96b	9d53d0d4-225d-4e2d-b8c1-636e8252986f
e1542128-3d5a-4ea1-bf54-9ae028335734	83c6a558-805c-4156-94f6-fa7ea55c7d84
16436deb-c127-4054-bd46-62614d1190b9	47b511ec-2288-4a83-aa51-947d81ecc29b
16436deb-c127-4054-bd46-62614d1190b9	83c6a558-805c-4156-94f6-fa7ea55c7d84
16436deb-c127-4054-bd46-62614d1190b9	369df7c1-8477-4b1e-8886-913137036c19
bb67ff2d-92ec-4a36-8809-fcf69ac9122f	47b511ec-2288-4a83-aa51-947d81ecc29b
bb67ff2d-92ec-4a36-8809-fcf69ac9122f	efc608be-52fe-4465-9684-e826872847af
1af892d3-c596-458d-bccb-4a0fe2c2c686	47b511ec-2288-4a83-aa51-947d81ecc29b
1af892d3-c596-458d-bccb-4a0fe2c2c686	83c6a558-805c-4156-94f6-fa7ea55c7d84
1af892d3-c596-458d-bccb-4a0fe2c2c686	369df7c1-8477-4b1e-8886-913137036c19
7693e19e-2157-4163-be22-82f1fea4fe4c	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
7693e19e-2157-4163-be22-82f1fea4fe4c	198f5d8e-6858-4e34-a073-983dfd0bfb2b
f9331477-29cf-435c-9373-5b052356c325	fb2460ea-0400-44d5-a0dc-13275cf33462
\.


--
-- Data for Name: tag; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.tag (id, name, "parentId") FROM stdin;
2432c659-381e-4152-99ae-da3946ba78f6	Género	\N
ead486e4-d86e-4481-954c-4b2eb5915be2	Cabello	\N
517d44ba-ff4c-4077-b99a-1ca8021fa21a	Uñas	\N
d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f	Maquillajes	\N
11eb3167-dce0-4d4b-92d2-0ab1c4a940a7	Tintes	\N
90fd2551-7f19-4bf0-86c7-c8c09ffc5c83	Cejas y pestañas	\N
5330410b-7132-4267-a5d9-c9f42fe3725b	Niños	2432c659-381e-4152-99ae-da3946ba78f6
9d53d0d4-225d-4e2d-b8c1-636e8252986f	Mujer	2432c659-381e-4152-99ae-da3946ba78f6
47b511ec-2288-4a83-aa51-947d81ecc29b	Hombre	2432c659-381e-4152-99ae-da3946ba78f6
b8757f3e-cb73-4cd4-bc71-ab0faa8e4f57	Unisex	2432c659-381e-4152-99ae-da3946ba78f6
83c6a558-805c-4156-94f6-fa7ea55c7d84	Cortes de barbería	ead486e4-d86e-4481-954c-4b2eb5915be2
cd8e90af-faec-46b7-bff2-a346a4ea5266	Alisados	ead486e4-d86e-4481-954c-4b2eb5915be2
8797fc27-5ad8-4c6a-a78a-192812f235e4	Cepillados y brushing	ead486e4-d86e-4481-954c-4b2eb5915be2
6788e799-77c7-4e6a-9368-72571ef8b4df	Aseo general	ead486e4-d86e-4481-954c-4b2eb5915be2
fb2460ea-0400-44d5-a0dc-13275cf33462	Cortes clásicos	ead486e4-d86e-4481-954c-4b2eb5915be2
498a3058-5e74-4e14-b678-214fb63517ad	Trenzas	ead486e4-d86e-4481-954c-4b2eb5915be2
9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed	Peinados	ead486e4-d86e-4481-954c-4b2eb5915be2
4737bc86-f99e-4f1b-a597-28449ac599a4	Lavado y mascarillas	ead486e4-d86e-4481-954c-4b2eb5915be2
9b654a72-9afc-4e95-a3cf-57d449ff4a35	Tratamientos capilares	ead486e4-d86e-4481-954c-4b2eb5915be2
efc608be-52fe-4465-9684-e826872847af	Urbano	83c6a558-805c-4156-94f6-fa7ea55c7d84
40f0c389-dd02-4d42-8cb0-d717312a0899	Clásico	83c6a558-805c-4156-94f6-fa7ea55c7d84
1a27aaf9-6a96-4f1d-9e7c-460d96c06879	Degradado	83c6a558-805c-4156-94f6-fa7ea55c7d84
369df7c1-8477-4b1e-8886-913137036c19	Skinfade	83c6a558-805c-4156-94f6-fa7ea55c7d84
e077aff5-7a48-4ba7-a747-36fdc62c37c6	Keratina	cd8e90af-faec-46b7-bff2-a346a4ea5266
83fb4e85-a17c-4203-a6de-2cebe4e9a0d2	Botox capilar	cd8e90af-faec-46b7-bff2-a346a4ea5266
9a2b7a5b-d0fa-4bc2-aa7f-bfe2fd26ce78	Progresivo	cd8e90af-faec-46b7-bff2-a346a4ea5266
98fb72a0-e0f0-4f92-ba5c-bfc8a863f96e	Box braids	498a3058-5e74-4e14-b678-214fb63517ad
7a72ef5b-62a6-45be-9645-8bfa9a21787b	Trenzas clásicas	498a3058-5e74-4e14-b678-214fb63517ad
299fdcfe-c7d8-4f73-8ff3-fbc5d29b4c98	Trenzas con extensiones	498a3058-5e74-4e14-b678-214fb63517ad
e4b91195-69b8-404b-b9be-01e9e1aab3cd	Recogidos	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
198f5d8e-6858-4e34-a073-983dfd0bfb2b	Semirecogidos	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
8aa827d6-d61f-4ad4-a217-9be9cc171b30	Peinados con accesorios	9a1c14e2-e453-4a6d-b257-b8cad9a9b2ed
5d9fa316-db1c-4307-8ecc-839ba82df21f	Manicure	517d44ba-ff4c-4077-b99a-1ca8021fa21a
b28b9374-0324-4613-8fb5-3ddcfa23aa81	Pedicure	517d44ba-ff4c-4077-b99a-1ca8021fa21a
9b702516-037c-4524-a21a-6faa71890b5f	Diseños y nail art	517d44ba-ff4c-4077-b99a-1ca8021fa21a
a4162d8a-6f39-40b1-aadd-5c7c484a07ac	Acrílicas	517d44ba-ff4c-4077-b99a-1ca8021fa21a
0e0a657d-66eb-4a2f-9eb8-ed5cb91946af	Gel y polygel	517d44ba-ff4c-4077-b99a-1ca8021fa21a
de246f3f-6929-49c9-8c2d-64b2189d2686	Semipermanente	517d44ba-ff4c-4077-b99a-1ca8021fa21a
3bc10a8b-91ef-40e4-97d0-4a39afe56b05	Para eventos	517d44ba-ff4c-4077-b99a-1ca8021fa21a
b1445426-4264-4b65-8ec0-adfc02142cd9	Mantenimiento y reparación	517d44ba-ff4c-4077-b99a-1ca8021fa21a
6187cc84-58b8-4026-bd65-d6852c7330b6	Día / natural	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
793936a3-d476-4f95-9326-8e70609cec2e	Noche	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
7b9e9d6d-573d-489c-a80c-73c9354f0f80	Novia	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
cd3876c6-b101-4c10-ae09-113ed6e61a83	De fiesta	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
9f662cf5-f238-47d6-8309-adc984a3133e	Social y fotográfico	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
8b150197-e995-412a-89a8-399508ba29c0	Quinceañera	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
69587d12-1124-4bfd-9b9c-1f04c657225a	Coloración completa	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
557914c0-d477-461d-b443-2e6f9ba26865	Mechas y balayage	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
5780a1d6-dc15-47d4-a195-16c68cec22cf	Retoque de raíz	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
3f689c05-1f87-4259-9979-7f5943095e59	Color fantasía	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
5d9c9422-2c46-4165-9924-21674236f140	Decoloración	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
2d3bca45-bce7-4a20-9a17-ca8ce15bd8a0	Matiz y gloss	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
f03abf42-10e2-4f96-ac84-d8ec4f017a7e	Diseño de cejas	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
16fc1249-0601-40a0-93dd-1b5f87b6e599	Tinte de cejas	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
be1f0d24-7859-4a39-bee6-f247ebbd2eb4	Henna brows	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
838d35cf-3c95-467a-83a2-fc2bad4cd91a	Perfilado (cera/hilo)	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
68b3fcbd-4398-4489-8bd8-c59b336d5d46	Lifting de pestañas	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
3ff10831-b2f4-4731-aa18-3cf1154808cd	Extensiones de pestañas	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
91742a87-7eeb-41a8-b6da-1c82a284d3da	Tinte de pestañas	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
ef129f64-64f0-4f75-ac54-a5ba539b41c9	Cabello afro/rizado	ead486e4-d86e-4481-954c-4b2eb5915be2
96265c95-808b-4fa1-9480-db9804fcc501	Alternativo	83c6a558-805c-4156-94f6-fa7ea55c7d84
087af487-5130-482d-96cb-bf528c9dcc6a	Cabello largo	ead486e4-d86e-4481-954c-4b2eb5915be2
ab519603-5ce1-493b-b53a-775f290c5b4c	Express	517d44ba-ff4c-4077-b99a-1ca8021fa21a
ad6e7f24-c0f9-41f2-a79f-7eae68d9a2d8	Spa	517d44ba-ff4c-4077-b99a-1ca8021fa21a
b7403172-6600-4bb7-b53e-aac6278c9edc	Caracterización	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
2ecbfecc-cc67-4ea5-ac0c-b9e809f96627	Correctivo	d4ffbd0d-b9e0-4d8d-bb5f-054b37e61c9f
40bb5ab4-07b5-45a2-b712-0b455ca10fd7	Cobertura canas	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
a1431955-0e04-4919-9eab-080416e23792	Color natural	90fd2551-7f19-4bf0-86c7-c8c09ffc5c83
a787317c-8cc9-43c0-8403-9c64420a1631	Cobertura de canas	11eb3167-dce0-4d4b-92d2-0ab1c4a940a7
\.


--
-- Data for Name: type; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.type (id, "translateKey") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.users (id, email, password, "fullName", roles, "isActive", data_policy_accepted_at, email_verified_at, google_id) FROM stdin;
7506b37f-bc71-44da-ba9b-7a17b1a32091	Fernando5@gmail.com	$2a$12$HfmH8YeNU.W50bpJcNo5T.7tB1.BrRLXRDEG.1qpZTBCkurZsY1Ua	Administrador	{admin}	t	\N	2026-08-18 21:30:27.604599+00	\N
12884e8a-633e-46d2-bd2c-17d3cfade293	lcarrionalvarez@gmail.com	$2b$10$FaOEP5lYythEU15PtwP78ur2mFVsEP80ul7m4smwmlEcfZ588cb4.	Omar Daniel	{user}	t	\N	2026-08-18 21:30:27.604599+00	\N
1d61b452-59ca-4089-8465-7a2f2806cc88	lcarrionalvarezn@gmail.com	$2b$10$FaOEP5lYythEU15PtwP78ur2mFVsEP80ul7m4smwmlEcfZ588cb4.	Marta Medrano	{user}	t	\N	2026-08-18 21:30:27.604599+00	\N
b548ba1d-032e-450f-9e94-b7372d7ff25d	lcyancode@gmail.com	$2b$10$FaOEP5lYythEU15PtwP78ur2mFVsEP80ul7m4smwmlEcfZ588cb4.	Julian Acosta	{user}	t	\N	2026-08-18 21:30:27.604599+00	\N
688572e2-c49a-4eea-bf33-1a58fa33516f	lcarrionalvarez@hotmail.com	$2b$10$FaOEP5lYythEU15PtwP78ur2mFVsEP80ul7m4smwmlEcfZ588cb4.	Adriana Banegas	{user}	t	\N	2026-08-18 21:30:27.604599+00	\N
1c9297c9-c6c9-4abc-af9d-3bc79bbc8837	smoke_14492@correo.com	$2b$10$aE3/99AxZROFWq4jn5MkqO300z9avqDtpLiXzzC0Jr.3/BAvLcHpG	Smoke	{user}	t	2026-08-18 21:31:12.073+00	\N	\N
46c9aec8-97fc-4f22-b994-dd91a3dd6eb0	proxy_8735@correo.com	$2b$10$o.NGQyVtps5n17pMf5gM/.GdjKQ4dD4209rJA/unCcn/oayYhPpni	Proxy	{user}	t	2026-08-18 21:55:32.927+00	\N	\N
\.


--
-- Data for Name: workers; Type: TABLE DATA; Schema: public; Owner: luis
--

COPY public.workers (id, name, is_default) FROM stdin;
8c980ba2-3074-4dab-a8c3-8f80ed4b87be	Alejandro	f
13ab182c-d2fc-4706-b7b5-d1539d1caadf	Monica	f
757fd512-8934-4a48-a0f4-ae664c951253	Sin prefencia	t
865c3f39-e1a4-4c6a-a58b-d92fb65dee91	Sonia s	f
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: luis
--

SELECT pg_catalog.setval('public.migrations_id_seq', 6, true);


--
-- Name: reviews PK_231ae565c273ee700b283f15c1d; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY (id);


--
-- Name: detail PK_28de27ee9ae6103af88ab1b3c0c; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.detail
    ADD CONSTRAINT "PK_28de27ee9ae6103af88ab1b3c0c" PRIMARY KEY (id);


--
-- Name: faqs PK_2ddf4f2c910f8e8fa2663a67bf0; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT "PK_2ddf4f2c910f8e8fa2663a67bf0" PRIMARY KEY (id);


--
-- Name: service_tags_tag PK_2f1e93522993ff0afb0a8cc0351; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service_tags_tag
    ADD CONSTRAINT "PK_2f1e93522993ff0afb0a8cc0351" PRIMARY KEY ("serviceId", "tagId");


--
-- Name: type PK_40410d6bf0bedb43f9cadae6fef; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.type
    ADD CONSTRAINT "PK_40410d6bf0bedb43f9cadae6fef" PRIMARY KEY (id);


--
-- Name: reviewsByUser PK_4a2706da5f3b027795254f1ca72; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public."reviewsByUser"
    ADD CONSTRAINT "PK_4a2706da5f3b027795254f1ca72" PRIMARY KEY (id);


--
-- Name: reservation_services PK_4f6633abeabcab5b1c5c4288f19; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.reservation_services
    ADD CONSTRAINT "PK_4f6633abeabcab5b1c5c4288f19" PRIMARY KEY (id);


--
-- Name: planne PK_574b5f18287d22c75431f1f2ae1; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.planne
    ADD CONSTRAINT "PK_574b5f18287d22c75431f1f2ae1" PRIMARY KEY (id);


--
-- Name: refresh_tokens PK_7d8bee0204106019488c4c50ffa; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY (id);


--
-- Name: service PK_85a21558c006647cd76fdce044b; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY (id);


--
-- Name: image_manager PK_89adfc523c3ea78eda37d570a7c; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.image_manager
    ADD CONSTRAINT "PK_89adfc523c3ea78eda37d570a7c" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: tag PK_8e4052373c579afc1471f526760; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: auth_tokens PK_auth_tokens_id; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT "PK_auth_tokens_id" PRIMARY KEY (id);


--
-- Name: reservations PK_da95cef71b617ac35dc5bcda243; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY (id);


--
-- Name: workers PK_e950c9aba3bd84a4f193058d838; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT "PK_e950c9aba3bd84a4f193058d838" PRIMARY KEY (id);


--
-- Name: planne REL_45a3c2297d340e56b1f8bd24d6; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.planne
    ADD CONSTRAINT "REL_45a3c2297d340e56b1f8bd24d6" UNIQUE ("detailId");


--
-- Name: service REL_9bbef42f10fafcf9c9fd55f48a; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT "REL_9bbef42f10fafcf9c9fd55f48a" UNIQUE (detail_id);


--
-- Name: planne UQ_00f8f9fe71b6b2618e721e152d5; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.planne
    ADD CONSTRAINT "UQ_00f8f9fe71b6b2618e721e152d5" UNIQUE (name);


--
-- Name: users UQ_0bd5012aeb82628e07f6a1be53b; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_0bd5012aeb82628e07f6a1be53b" UNIQUE (google_id);


--
-- Name: service UQ_4df47ef659e04d5be78ddb6b598; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT "UQ_4df47ef659e04d5be78ddb6b598" UNIQUE (slug);


--
-- Name: tag UQ_6a9775008add570dc3e5a0bab7b; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT "UQ_6a9775008add570dc3e5a0bab7b" UNIQUE (name);


--
-- Name: service UQ_7806a14d42c3244064b4a1706ca; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT "UQ_7806a14d42c3244064b4a1706ca" UNIQUE (name);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: refresh_tokens UQ_a7838d2ba25be1342091b6695f1; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE (token_hash);


--
-- Name: auth_tokens UQ_auth_tokens_token_hash; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT "UQ_auth_tokens_token_hash" UNIQUE (token_hash);


--
-- Name: reviewsByUser UQ_bcc2af1fcef0be39cf9c7b176e4; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public."reviewsByUser"
    ADD CONSTRAINT "UQ_bcc2af1fcef0be39cf9c7b176e4" UNIQUE ("userId", "reviewId");


--
-- Name: reservations excl_reservations_worker_overlap; Type: CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT excl_reservations_worker_overlap EXCLUDE USING gist (worker_id WITH =, tstzrange(scheduled_at, ended_at) WITH &&) WHERE ((status <> 'cancelada'::text));


--
-- Name: IDX_3ddc983c5f7bcf132fd8732c3f; Type: INDEX; Schema: public; Owner: luis
--

CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON public.refresh_tokens USING btree (user_id);


--
-- Name: IDX_6b9529e6d4558dd00fb2e759b1; Type: INDEX; Schema: public; Owner: luis
--

CREATE INDEX "IDX_6b9529e6d4558dd00fb2e759b1" ON public.service_tags_tag USING btree ("tagId");


--
-- Name: IDX_89d3643a767b3c7551c45d9318; Type: INDEX; Schema: public; Owner: luis
--

CREATE INDEX "IDX_89d3643a767b3c7551c45d9318" ON public.service_tags_tag USING btree ("serviceId");


--
-- Name: IDX_auth_tokens_user_id_type; Type: INDEX; Schema: public; Owner: luis
--

CREATE INDEX "IDX_auth_tokens_user_id_type" ON public.auth_tokens USING btree (user_id, type);


--
-- Name: IDX_d5e27da0cd39bc3bb2811fc8ba; Type: INDEX; Schema: public; Owner: luis
--

CREATE INDEX "IDX_d5e27da0cd39bc3bb2811fc8ba" ON public.refresh_tokens USING btree (family_id);


--
-- Name: reviewsByUser FK_00e91bb4716a6fe4394ff1e5321; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public."reviewsByUser"
    ADD CONSTRAINT "FK_00e91bb4716a6fe4394ff1e5321" FOREIGN KEY ("reviewId") REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: reservations FK_1834ead84dfb79d54d08ff3f3fe; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT "FK_1834ead84dfb79d54d08ff3f3fe" FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE RESTRICT;


--
-- Name: refresh_tokens FK_3ddc983c5f7bcf132fd8732c3f4; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: planne FK_45a3c2297d340e56b1f8bd24d6f; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.planne
    ADD CONSTRAINT "FK_45a3c2297d340e56b1f8bd24d6f" FOREIGN KEY ("detailId") REFERENCES public.detail(id);


--
-- Name: reservations FK_4af5055a871c46d011345a255a6; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT "FK_4af5055a871c46d011345a255a6" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tag FK_5f4effb7cd258ffa9ef554cfbbb; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT "FK_5f4effb7cd258ffa9ef554cfbbb" FOREIGN KEY ("parentId") REFERENCES public.tag(id);


--
-- Name: service_tags_tag FK_6b9529e6d4558dd00fb2e759b19; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service_tags_tag
    ADD CONSTRAINT "FK_6b9529e6d4558dd00fb2e759b19" FOREIGN KEY ("tagId") REFERENCES public.tag(id);


--
-- Name: service_tags_tag FK_89d3643a767b3c7551c45d93181; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service_tags_tag
    ADD CONSTRAINT "FK_89d3643a767b3c7551c45d93181" FOREIGN KEY ("serviceId") REFERENCES public.service(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviewsByUser FK_90911aa1d412eb682c7128f0957; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public."reviewsByUser"
    ADD CONSTRAINT "FK_90911aa1d412eb682c7128f0957" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: reservation_services FK_98e19f81ba239737fcfa594d6bf; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.reservation_services
    ADD CONSTRAINT "FK_98e19f81ba239737fcfa594d6bf" FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: service FK_9bbef42f10fafcf9c9fd55f48a6; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT "FK_9bbef42f10fafcf9c9fd55f48a6" FOREIGN KEY (detail_id) REFERENCES public.detail(id);


--
-- Name: auth_tokens FK_auth_tokens_user_id; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT "FK_auth_tokens_user_id" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: image_manager FK_b40fd1da30dfcc0990cdbe1171d; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.image_manager
    ADD CONSTRAINT "FK_b40fd1da30dfcc0990cdbe1171d" FOREIGN KEY ("serviceId") REFERENCES public.service(id) ON DELETE CASCADE;


--
-- Name: image_manager FK_ba0dd99d3cb65dfa2758535024d; Type: FK CONSTRAINT; Schema: public; Owner: luis
--

ALTER TABLE ONLY public.image_manager
    ADD CONSTRAINT "FK_ba0dd99d3cb65dfa2758535024d" FOREIGN KEY ("planneId") REFERENCES public.planne(id);


--
-- PostgreSQL database dump complete
--

\unrestrict WN6lQ4LN35DsHpe2vh3r9hgJdjGHfu25I6bjf6DaA8dY6DzpR5LcM0jqPkxgC8v

