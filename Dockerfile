FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV CI=true

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY test ./test
RUN yarn build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json yarn.lock ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
