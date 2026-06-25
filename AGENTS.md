# Vamp — Agent Constitution

Guidance for AI agents working in this repository. Read this before making changes.

Vamp is a collaborative music-making app. This is an npm-workspaces monorepo:

- `app/` — React web client (Vite, React 19, Apollo Client, Tailwind CSS v4 +
  shadcn/ui, lucide icons). Path alias `@/` → `app/src`.
- `server/` — GraphQL API (type-graphql + Typegoose/MongoDB, Apollo Server).
- `docs/` — Project documentation, including the glossary.

## Core Principles

1. **Maintain the glossary.** `docs/GLOSSARY.md` is the canonical source of truth for
   product-specific vocabulary — data models, domain concepts, GraphQL operations, and
   user-facing terms. Whenever you introduce a new concept or change an existing one,
   update the glossary **in the same change**. See "Glossary discipline" below; the
   always-applied rule in `.cursor/rules/glossary.mdc` reinforces this.
2. **Keep schemas in lockstep.** Server entities double as Typegoose models and
   GraphQL `ObjectType`s (`server/src/entities/`). The GraphQL SDL
   (`server/schema.graphql`) and the client's generated types (`app/src/generated/`)
   are derived artifacts — regenerate them rather than editing by hand.
3. **One styling system on the client.** Use Tailwind/shadcn for UI. Reuse and extend
   components in `app/src/components/ui` instead of introducing parallel approaches.
4. **Verify your work.** Run typecheck/build/tests for the workspace you changed
   before considering a task done (e.g. `npm run typecheck -w @vamp/app`,
   `npm test -w @vamp/app`).

## Glossary discipline

Treat updating `docs/GLOSSARY.md` as part of the definition of done:

- **New concept** (entity, screen, domain term, query/mutation) → add an entry.
- **Changed concept** (rename, field added/removed, meaning shift) → update the entry.
- **Removed concept** → delete the entry, or mark it deprecated if still referenced.

Keep entries alphabetized within their section, use the product's exact casing, and
link to the defining code when one exists. When unsure whether a term is
"product-specific," err toward adding it.
