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
| **Archived project** | A project flagged inactive via `Project.archived`. Set/unset with the `setProjectArchived` mutation; archived projects are hidden from the active project list but not deleted. |
| **Authentication** | Email + password sign-in. `register` creates an account (password hashed with scrypt); `login` begins a server-side `Session` delivered as an HttpOnly cookie; `logout` ends it. See the `Session` data model and the auth GraphQL operations. |
| **Collaborative music-making** | The core value proposition: multiple users creating music together. Surfaced as the app's tagline on the home screen. |
| **Contributor** | A user who collaborates on a project but does not own it. Tracked in `Project.contributors`. |
| **Poetic project name** | The short, evocative two-word title (e.g. "Crimson Echo") auto-generated for a new empty project using the RiTa NLP library (`server/src/lib/projectName.ts`). |
| **Owner** | The user who owns a project (`Project.owner`); a project has exactly one owner. |
| **Project** | A unit of collaborative work: a titled container with an owner, contributors, and backing `ProjectData`. See the Data Models section. **"Project" is primarily a backend/code term** (entities, GraphQL operations, component names); in the app's user-facing copy a project is called a **Vamp** (plural **Vamps**). |
| **Vamp (project)** | The user-facing name for a `Project`. Front-end copy refers to projects as "Vamps" (e.g. "Your Vamps", "New Vamp"); the backend, GraphQL schema, and code identifiers keep the `Project` name. Distinct from **Vamp** the product, though intentionally evocative of it. |

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
| `archived` | `Boolean` | Whether the project is archived (hidden from active lists). Defaults to `false`. |
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

### Session
`server/src/entities/Session.ts` · no GraphQL type

A server-side login session for a `User`, created on login and deleted on logout.
Deliberately **not** exposed to GraphQL: it is authentication infrastructure. Only
the SHA-256 hash of the session token is stored (the raw token lives only in the
client's HttpOnly cookie), and a TTL index on `expiresAt` lets MongoDB reap expired
sessions automatically.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ObjectId` | Server-generated unique identifier. |
| `user` | `Ref<User>` | The session's owner. |
| `tokenHash` | `String` | SHA-256 hash of the session token. Unique. |
| `expiresAt` | `Date` | When the session expires; TTL-indexed. |
| `createdAt` | `Date` | Set on creation; defaults to now. |

### User
`server/src/entities/User.ts` · GraphQL type `User`

A registered person who can use Vamp. Created via the `register` mutation, which
hashes the password with scrypt (`server/src/lib/password.ts`).

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `username` | `String` | Display handle. Required, unique, trimmed. |
| `email` | `String` | Required, unique, lowercased, trimmed. |
| `passwordHash` | `String` | Scrypt hash of the password. Stored only; **never** exposed via GraphQL (no `@Field`). |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

## GraphQL Operations

| Operation | Kind | Description |
| --- | --- | --- |
| `createEmptyProject(ownerId: ID!)` | Mutation | Creates a new empty project for the owner with an auto-generated poetic title (via RiTa) and auto-provisioned `ProjectData`. |
| `createProject(input: CreateProjectInput!)` | Mutation | Creates a project from `{ title, ownerId, contributorIds }` and auto-provisions its `ProjectData`. |
| `login(input: LoginInput!)` | Mutation | Authenticates `{ email, password }`, begins a session (sets the HttpOnly session cookie), and returns the `User`. Returns a generic error on bad credentials. |
| `logout` | Mutation | Ends the current session (deletes it and clears the cookie). Returns `Boolean`. |
| `me` | Query | Returns the currently authenticated `User`, or null if not signed in. |
| `project(id: ID!)` | Query | Returns a single project by id, or null. |
| `projectsByUser(userId: ID!, includeArchived: Boolean = false)` | Query | Returns projects the user owns or contributes to (`[Project!]!`), newest first. Archived projects are excluded unless `includeArchived` is `true`. |
| `register(input: RegisterInput!)` | Mutation | Registers a new account from `{ username, email, password }` (password hashed with scrypt) and returns the `User`. |
| `setProjectArchived(id: ID!, archived: Boolean!)` | Mutation | Archives or unarchives a project, returning the updated `Project`. |
| `updateProjectMetadata(input: UpdateProjectMetadataInput!)` | Mutation | Updates metadata stored directly on a `Project` (currently `title`); `ProjectData` content has separate flows. |
| `user(id: ID!)` | Query | Returns a single user by id, or null. |
| `userByEmail(email: String!)` | Query | Returns a single user by email, or null. |
| `users` | Query | Returns all users (`[User!]!`). |

## User-Facing Terms

| Term | Definition |
| --- | --- |
| **CreateProjectButton** | A feature button in the `UserHomeView` toolbar that creates a new empty project (auto-named via `createEmptyProject`), refreshes the project list, and navigates into the new project (`app/src/components/features/CreateProjectButton.tsx`). |
| **LandingView** | The landing view at `/`, showing the Vamp title, tagline, login/sign-up links, and the list of users (`app/src/components/views/LandingView.tsx`). |
| **LoginView** | The login view at `/login`; an email + password form that begins a session and redirects to `/home` on success (`app/src/components/views/LoginView.tsx`). |
| **ProjectTitleField** | A feature that renders a project's title as an editable heading and persists edits via `updateProjectMetadata` (optimistically); used in the `ProjectView` header (`app/src/components/features/ProjectTitleField.tsx`). |
| **ProjectView** | The view for a single project at `/projects/:projectId`. Fetches the project (via the `project` query) and shows its name (an editable `ProjectTitleField`) and owner at the top, with a stubbed `Timeline` filling the rest of the screen (`app/src/components/views/ProjectView.tsx`). Guarded by `RequireAuth`. |
| **ProjectsTable** | A feature that lists a user's non-archived projects in a table, each row linking into the project; used by `UserHomeView` (`app/src/components/features/ProjectsTable.tsx`). |
| **RegisterView** | The registration view at `/register`; a username/email/password form that creates an account, then sends the user to `LoginView` (`app/src/components/views/RegisterView.tsx`). |
| **RequireAuth** | Client route guard that renders its children only for a signed-in user (via the `me` query) and otherwise redirects to `LoginView` (`app/src/auth/RequireAuth.tsx`). Wraps `UserHomeView` and `ProjectView`. |
| **Timeline** | A stubbed composite placeholder for the project's horizontal editing timeline (tracks, regions, audio). Domain-agnostic; fills the body of the `ProjectView` (`app/src/components/composites/timeline.tsx`). |
| **UserHomeView** | The signed-in user's home view at `/home`. Below the header it shows a projects toolbar (currently a `CreateProjectButton`) above a `ProjectsTable` of the projects the user owns and collaborates on, plus a log-out action (`app/src/components/views/UserHomeView.tsx`). Guarded by `RequireAuth`. |
| **View** | A top-level, route-level screen component on the client. The top tier of the [UI component architecture](../.cursor/rules/ui-architecture.mdc); views live in `app/src/components/views/` and are suffixed `View`. |

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
