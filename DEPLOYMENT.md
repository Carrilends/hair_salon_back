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

