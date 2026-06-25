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
    │   ├── screens/HomeScreen.tsx  # the single route, queries `users`
    │   ├── App.tsx                 # ApolloProvider + Router
    │   ├── main.tsx                # web entry
    │   └── generated/              # GraphQL codegen output (git-ignored)
    ├── e2e/                        # Playwright specs
    ├── codegen.ts
    ├── vite.config.ts
    └── playwright.config.ts
```
