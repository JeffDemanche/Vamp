# Vamp

Monorepo for Vamp, a collaborative music-making app.

It is an [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) monorepo with two packages:

| Package      | Path      | What it is                                                                    |
| ------------ | --------- | ----------------------------------------------------------------------------- |
| `@vamp/server` | `server/` | Node.js + Express + Apollo Server GraphQL API, MongoDB via Mongoose/Typegoose |
| `@vamp/app`    | `app/`    | React Native app (web target first) with Apollo Client, built by Vite         |

## Stack

**Server**
- **Express 5** HTTP layer
- **Apollo Server 5** mounted at `/graphql`
- **type-graphql** — schema-first-from-code: resolvers and types are TypeScript classes with decorators
- **Typegoose + Mongoose** — fully typed MongoDB models
- **Jest + `mongodb-memory-server`** — tests drive the real resolvers against an ephemeral in-memory MongoDB (the whole stack, nothing mocked but the DB location)

**App**
- **React Native** primitives rendered on the web via **react-native-web** (aliased in Vite + Jest)
- **Vite** dev server / bundler
- **react-router-dom** — a single `/` route for now
- **Apollo Client 4**
- **GraphQL Code Generator** (`client` preset) — generates fully typed documents from the server's emitted schema, so client and server **share one source of truth** for the API contract
- **Jest + Testing Library** for unit tests
- **Playwright** for integration/e2e tests

## How the client and server share types

The server is the source of truth for the GraphQL schema:

1. `server` emits its SDL to `server/schema.graphql` (`npm run schema`). This file is committed — it is the API contract.
2. `app` runs GraphQL Code Generator (`npm run codegen`), which reads `server/schema.graphql` plus the `graphql(...)` operations in the app and writes fully typed documents to `app/src/generated/` (git-ignored, regenerated on demand).
3. Components call `useQuery(SomeTypedDocument)` and get end-to-end type safety.

## Prerequisites

- Node.js >= 20
- A MongoDB instance for running the server locally (tests use an in-memory one automatically)

The quickest way to get a full local stack (MongoDB + both dev servers) is
Docker — see ["Run everything with Docker"](#run-everything-with-docker) below.

> Clip audio is stored via a pluggable backend (`AUDIO_STORAGE_DRIVER`): the
> default `local` driver writes files to disk for development, and `vercel` uses
> Vercel Blob (set `BLOB_READ_WRITE_TOKEN`) in production. See `server/.env.example`.

## Run everything with Docker

A single command brings up MongoDB, the GraphQL API, and the Vite dev server —
all with live reload:

```bash
docker compose watch
```

`docker compose watch` builds the image, starts the stack, and then keeps the
running containers in sync with your working tree:

- editing files under `server/` restarts the API (ts-node-dev);
- editing files under `app/` triggers Vite HMR in the browser;
- changing a `package.json` or `package-lock.json` rebuilds the image.

| Service      | URL / Port                          | Notes                                            |
| ------------ | ----------------------------------- | ------------------------------------------------ |
| `app`        | http://localhost:5173               | Vite dev server with HMR                         |
| `server`     | http://localhost:4000/graphql       | GraphQL API (health check at `/health`)          |
| `mongo`      | `mongodb://localhost:27017/vamp`    | Persisted in the `mongo-data` volume             |

No `.env` files are needed for Docker — values are supplied in
`docker-compose.yml`. Inside the network the API reaches MongoDB at
`mongodb://mongo:27017/vamp`.

```bash
docker compose down       # stop the stack (keeps volumes/data)
docker compose down -v     # stop and wipe MongoDB data
```

## Getting started

```bash
# 1. Install all workspace dependencies
npm install

# 2. Generate the GraphQL contract + typed client (required before app build/typecheck)
npm run schema    # server -> server/schema.graphql
npm run codegen   # app    -> app/src/generated/

# 3. Run the two dev servers (in separate terminals)
npm run dev:server   # http://localhost:4000/graphql
npm run dev:app      # http://localhost:5173
```

Copy the example env files if you need to override defaults:

```bash
cp server/.env.example server/.env
cp app/.env.example app/.env
```

## Common commands

Run from the repo root:

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `npm run build`      | Build both packages                               |
| `npm test`           | Run unit/integration tests in both packages       |
| `npm run dev:server` | Start the API in watch mode                       |
| `npm run dev:app`    | Start the Vite dev server                         |
| `npm run schema`     | Re-emit `server/schema.graphql`                   |
| `npm run codegen`    | Regenerate the typed GraphQL client in the app    |

Per-package scripts (run with `npm run <script> --workspace @vamp/server` or `--workspace @vamp/app`):

- **server**: `dev`, `build`, `start`, `schema`, `test`, `typecheck`
- **app**: `dev`, `build`, `preview`, `codegen`, `test`, `test:e2e`, `typecheck`

### End-to-end tests

```bash
cd app
npx playwright install chromium   # one-time browser download
npm run test:e2e                  # boots the Vite dev server automatically
```

## Deploy to Vercel

The whole app ships as a **single Vercel deployment**: one Express server (a
serverless function) serves the GraphQL API, the audio transfer routes, and the
production Vite build of the React client.

How it fits together:

- `npm run vercel-build` (the configured build command) regenerates the schema,
  runs codegen, builds both workspaces, then copies `app/dist` → `public/`.
- `api/index.ts` is the serverless function. Files under `api/` are built by
  `@vercel/node` regardless of framework, so this is reliable in a monorepo. It
  boots the Express app once (Apollo + MongoDB are cached across warm
  invocations) and forwards each request to it.
- `vercel.json` sets `"framework": null` so Vercel does **not** auto-detect this
  as an Express/Vite project (which previously caused either a `No entrypoint
  found` build error, or a static-only deploy where every `POST /graphql`
  returned `405`). It also maps **all** routes to the function via `rewrites`.
- Hashed client assets and `index.html` live in `public/`, so Vercel's CDN
  serves them directly (filesystem matches win over rewrites). Everything else —
  `/graphql`, `/audio/*`, and deep client routes — falls through to the function,
  which serves the API and the SPA `index.html` fallback.
- In production the client talks to a **same-origin** `/graphql` automatically
  (see `app/src/apollo/client.ts`), so no `VITE_GRAPHQL_URI` is needed.

In the Vercel project settings, leave **Output Directory** blank (do not set it
to `app/dist`); `vercel.json` already handles output and routing.

Required environment variables in the Vercel project:

| Variable                | Purpose                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `MONGODB_URI`             | Connection string for your MongoDB (e.g. Atlas) cluster       |
| `AUDIO_STORAGE_DRIVER`  | Set to `vercel` to store audio bytes in Vercel Blob           |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token (required when driver = `vercel`) |

`NODE_ENV=production` and `VERCEL_URL` are provided by Vercel automatically;
`PUBLIC_BASE_URL` defaults to `https://$VERCEL_URL` when unset.

You can produce the same build locally with `npm run vercel-build`, then run the
combined server (it serves `app/dist` because `NODE_ENV=production` enables
`SERVE_CLIENT`):

```bash
npm run vercel-build
NODE_ENV=production MONGODB_URI=mongodb://127.0.0.1:27017/vamp npm start
# → http://localhost:4000 serves the SPA, /graphql, and /audio
```

## Project layout

```
.
├── package.json            # workspaces + aggregate scripts
├── tsconfig.base.json      # shared TS compiler options
├── server/
│   ├── src/
│   │   ├── entities/User.ts        # Typegoose model + type-graphql ObjectType (one class)
│   │   ├── resolvers/UserResolver.ts
│   │   ├── schema.ts               # buildSchema()
│   │   ├── server.ts               # Express app + Apollo middleware
│   │   ├── db.ts                   # Mongoose connection
│   │   ├── emit-schema.ts          # writes schema.graphql
│   │   └── index.ts                # bootstrap / listen
│   ├── test/                       # full-stack Jest tests (in-memory Mongo)
│   └── schema.graphql              # generated API contract (committed)
└── app/
    ├── src/
    │   ├── apollo/client.ts
    │   ├── components/             # route-level Views (LandingView, etc.)
    │   ├── App.tsx                 # ApolloProvider + Router
    │   ├── main.tsx                # web entry
    │   └── generated/              # GraphQL codegen output (git-ignored)
    ├── e2e/                        # Playwright specs
    ├── codegen.ts
    ├── vite.config.ts
    └── playwright.config.ts
```
