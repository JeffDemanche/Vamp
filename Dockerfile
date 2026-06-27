# syntax=docker/dockerfile:1

# Single development image shared by the `server` and `app` services. Each
# service overrides the command in docker-compose.yml. Dependencies are
# installed once at the workspace root so npm can hoist them as usual.
FROM node:22-bookworm-slim AS dev

ENV NODE_ENV=development
WORKDIR /app

# Install dependencies first for better layer caching. Only the manifests are
# copied so this layer is only rebuilt when dependencies actually change.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY app/package.json ./app/package.json
RUN npm ci

# Copy the rest of the source. At runtime `docker compose watch` keeps these in
# sync with the host, so this is mostly the initial seed of the working tree.
COPY . .

# server -> 4000, vite dev server -> 5173
EXPOSE 4000 5173
