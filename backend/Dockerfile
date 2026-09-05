# Ticket 001: imagen Docker del backend, construida y ejecutada en la
# misma VM (Ampere A1.Flex, ARM64) -- mismo criterio que
# mail-core-mc/backend/Dockerfile (sin registry externo, mismo host
# construye y despliega).
#
# node:24-slim (Debian, glibc) y no node:24-alpine: mismo criterio de
# evitar de raiz problemas de compatibilidad de librerias nativas en
# Alpine que ya documentan auth-core-mc/mail-core-mc, aunque este
# backend no tenga dependencias nativas propias hoy -- consistencia de
# la flota antes que optimizar un byte de imagen que no se necesita.
# Multi-arch (amd64/arm64), funciona igual en Mac (arm64 dev) y VM
# Ampere (arm64 prod).
#
# *** Contexto de build fijo: SOLO `backend/` ***
# corePipeline.groovy (Shared Library de Jenkins, ver Jenkinsfile raiz)
# corre siempre `docker build ... ./backend` -- el contexto de build
# NUNCA incluye el directorio hermano `frontend/`, y no es configurable
# por proyecto. Por eso el build del frontend (Vite) NO ocurre en un
# stage de ESTE Dockerfile (no hay forma de que un stage copie algo de
# fuera de `./backend`): ocurre ANTES, en el propio `buildAndTest` del
# Jenkinsfile raiz, que compila `frontend/` y copia su `dist/` a
# `backend/public/` (gitignorado, ver .gitignore) en el mismo workspace
# de Jenkins, justo antes de que corePipeline invoque este build de
# imagen. Ver docs/ARQUITECTURA.md, "Build de la imagen: frontend +
# backend en un solo Dockerfile", para el detalle completo y por que
# esto no es un cambio a la Shared Library (fuera de alcance de este
# ticket).
#
# Este Dockerfile SI es multi-stage para el propio backend (build TS ->
# runtime sin devDependencies) -- lo unico que no puede ser multi-stage
# aqui es el frontend, por la razon de arriba.
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app

# curl: usado por el healthcheck de deploy/docker-compose.*.yml contra /health.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Reinstala solo dependencias de produccion (sin devDependencies como
# typescript/vitest/tsx) -- imagen final mas chica y sin herramientas de
# build innecesarias en runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Build estatico del frontend -- ya colocado aqui por el Jenkinsfile
# raiz ANTES de este `docker build` (ver nota arriba). Si se corre este
# Dockerfile a mano sin ese paso previo, `backend/public/` solo trae el
# `.gitkeep` -- la imagen igual arranca: el backend sirve 404 en la SPA
# pero /health y /api/base-assets/skeleton siguen funcionando (ver
# backend/src/app.ts).
COPY public ./public

# Usuario no-root -- la imagen nunca corre la app como root.
RUN groupadd --system app && useradd --system --gid app --no-create-home app \
    && chown -R app:app /app
USER app

EXPOSE 3000
ENV PORT=3000

CMD ["node", "dist/server.js"]
