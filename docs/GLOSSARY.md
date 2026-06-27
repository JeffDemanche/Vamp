# Vamp Glossary

The canonical reference for Vamp's product-specific vocabulary: data models, domain
concepts, and user-facing terms. Keep this current — see "Maintaining this glossary"
at the bottom.

> Conventions: terms are alphabetized within each section. Use the exact casing the
> product/code uses. When a term maps to code, reference the type or file.

## Product & Domain Concepts

| Term | Definition |
| --- | --- |
| **Vamp** | The product: a collaborative music-making app. In jazz, a "vamp" is a short, repeating musical passage — the name evokes looping, improvisation, and playing together. |
| **Collaborative music-making** | The core value proposition: multiple users creating music together. Surfaced as the app's tagline on the home screen. |
| **Contributor** | A user who collaborates on a project but does not own it. Tracked in `Project.contributors`. |
| **Owner** | The user who owns a project (`Project.owner`); a project has exactly one owner. |
| **Project** | A unit of collaborative work: a titled container with an owner, contributors, and backing `ProjectData`. See the Data Models section. |

## Data Models

Data models are defined once on the server as a class that is simultaneously a
Typegoose (MongoDB) model and a type-graphql `ObjectType`, keeping the database and
GraphQL schemas in lockstep (`server/src/entities/`).

### Project
`server/src/entities/Project.ts` · GraphQL type `Project`

A music project owned by one user and optionally worked on by contributors. Its
relational fields are persisted as references and exposed via field resolvers
(`server/src/resolvers/ProjectResolver.ts`).

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `title` | `String` | Project name. Required, trimmed. |
| `owner` | `User` | The owning user. Stored as a ref; resolved by a field resolver. |
| `contributors` | `[User!]!` | Users collaborating on the project. Stored as refs; resolved by a field resolver. |
| `projectData` | `ProjectData` | The project's editable content. Stored as a ref; resolved by a field resolver. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

### ProjectData
`server/src/entities/ProjectData.ts` · GraphQL type `ProjectData`

The editable content of a `Project` (tracks, regions, audio, etc.), split out so
project metadata can be listed without loading large payloads. Empty for now;
fields will be added as the editor takes shape.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

### User
`server/src/entities/User.ts` · GraphQL type `User`

A registered person who can use Vamp.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `username` | `String` | Display handle. Required, unique, trimmed. |
| `email` | `String` | Required, unique, lowercased, trimmed. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

## GraphQL Operations

| Operation | Kind | Description |
| --- | --- | --- |
| `createProject(input: CreateProjectInput!)` | Mutation | Creates a project from `{ title, ownerId, contributorIds }` and auto-provisions its `ProjectData`. |
| `createUser(input: CreateUserInput!)` | Mutation | Creates a user from `{ username, email }`. |
| `project(id: ID!)` | Query | Returns a single project by id, or null. |
| `projectsByUser(userId: ID!)` | Query | Returns all projects the user owns or contributes to (`[Project!]!`). |
| `user(id: ID!)` | Query | Returns a single user by id, or null. |
| `userByEmail(email: String!)` | Query | Returns a single user by email, or null. |
| `users` | Query | Returns all users (`[User!]!`). |

## User-Facing Terms

| Term | Definition |
| --- | --- |
| **Home screen** | The landing view at `/`, showing the Vamp title, tagline, and the list of users (`app/src/screens/HomeScreen.tsx`). |

## Infrastructure & Local Development

| Term | Definition |
| --- | --- |
| **Docker dev environment** | The full local stack (MongoDB, LocalStack, API, Vite) started with `docker compose watch`. Defined in `docker-compose.yml` + `Dockerfile`; keeps containers in sync with the working tree for live reload. |
| **LocalStack** | A local AWS emulator run as a container in development. Vamp uses its S3 service so uploads can be exercised without real AWS. Reachable at `http://localstack:4566` inside the network (`http://localhost:4566` from the host). |
| **S3 uploads** | File uploads stored in an S3 bucket (`vamp-uploads`). In local dev the bucket lives in LocalStack; the server reads its S3 settings from `AWS_*` / `S3_BUCKET` env vars (`server/src/config.ts`, `S3Config`). |

---

## Maintaining this glossary

This file is a living document. **Update it in the same change that introduces or
modifies a concept** — do not defer it.

- **New concept** → add a row/entry to the appropriate section.
- **Changed concept** (renamed, new/removed fields, altered meaning) → update the
  existing entry so it matches the code.
- **Removed concept** → delete the entry (or note its deprecation if still referenced).
- Keep entries alphabetized within their section and link to the defining code where
  one exists.
