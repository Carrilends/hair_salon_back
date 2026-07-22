# Despliegue (Docker)

Este proyecto es un backend **NestJS** con **PostgreSQL**. El despliegue recomendado es con Docker Compose para que la API y la base de datos corran de forma reproducible.

## Requisitos

- Docker + Docker Compose (plugin v2)

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Ajusta valores sensibles:
   - `JWT_SECRET`
   - `CLOUDINARY_*`
   - `DB_PASSWORD`

Notas importantes:

- Dentro de Docker, la API se conecta al Postgres por red interna usando `DB_HOST=db` y `DB_PORT=5432` (esto lo fuerza `docker-compose.yml`).
- `DB_PUBLIC_PORT` controla el puerto publicado hacia tu máquina (por defecto `3334 -> 5432`).

## Levantar en local con Docker

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f api
```

Healthcheck (la API usa prefijo global `/api`):

```bash
curl -s http://localhost:${API_PUBLIC_PORT:-3001}/api/health
```

## Apagar / limpiar

```bash
docker compose down
```

Eliminar también el volumen de Postgres (BORRA datos):

```bash
docker compose down -v
```

## Migraciones (esquema de base de datos)

El esquema **no** se genera con `synchronize`: lo gobiernan las migraciones de TypeORM versionadas en `src/database/migrations/`. `synchronize` está desactivado por defecto en todos los entornos (`TYPEORM_SYNCHRONIZE=true` lo reactiva puntualmente en desarrollo, bajo tu responsabilidad).

La CLI usa `src/database/data-source.ts`, que lee el mismo `.env` que la aplicación.

```bash
# Ver qué migraciones hay y cuáles están aplicadas
yarn migration:show

# Aplicar las pendientes
yarn migration:run

# Deshacer la última
yarn migration:revert

# Generar una nueva a partir de los cambios en las entidades
yarn typeorm migration:generate src/database/migrations/NombreDescriptivo
```

Notas:

- **Genera siempre contra una base vacía.** Si la generas contra una base que ya tiene el esquema, TypeORM producirá una migración vacía o con diferencias espurias. Un patrón seguro es crear una base desechable en el mismo contenedor y apuntar la CLI a ella:

  ```bash
  docker compose exec -T db psql -U "$DB_USER" -d postgres -c 'CREATE DATABASE "TmpGen";'
  DB_NAME=TmpGen yarn typeorm migration:generate src/database/migrations/NombreDescriptivo
  docker compose exec -T db psql -U "$DB_USER" -d postgres -c 'DROP DATABASE "TmpGen";'
  ```

- **Base preexistente creada por `synchronize`.** Si una base ya tiene las tablas pero no la tabla `migrations`, no ejecutes `migration:run` a secas: intentaría crear tablas existentes y fallaría. Márcala como base de partida sin tocar los datos:

  ```bash
  yarn migration:run -- --fake
  ```

- **En producción las migraciones se aplican solas al arrancar**: `TYPEORM_MIGRATIONS_RUN` vale `true` por defecto cuando `NODE_ENV=production`. En runtime se cargan desde `dist/database/migrations/*.js`, que `nest build` genera a partir de los fuentes.
- Haz respaldo antes de aplicar migraciones sobre una base con datos: `docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > respaldo.sql`.

## Despliegue en servidor (recomendación)

- Copia el repo (o tu artefacto) al servidor.
- Crea `.env` en el servidor (no lo subas a git).
- Ejecuta:

```bash
docker compose up -d --build
```

## Troubleshooting rápido

- **La API intenta conectar a `localhost`**: asegúrate de estar usando `docker compose` (no correr `start:dev` en tu host con `.env` apuntando a docker). En Compose la API fuerza `DB_HOST=db`.
- **Permisos / carpeta `hair_salon_db`**: ya no se usa carpeta bind-mount; Postgres usa volumen `pgdata`.

