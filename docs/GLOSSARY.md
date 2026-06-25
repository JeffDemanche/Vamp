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

## Data Models

Data models are defined once on the server as a class that is simultaneously a
Typegoose (MongoDB) model and a type-graphql `ObjectType`, keeping the database and
GraphQL schemas in lockstep (`server/src/entities/`).

### User
`server/src/entities/User.ts` · GraphQL type `User`

A registered person who can use Vamp.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `name` | `String` | Display name. Required, trimmed. |
| `email` | `String` | Required, unique, lowercased, trimmed. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

## GraphQL Operations

| Operation | Kind | Description |
| --- | --- | --- |
| `users` | Query | Returns all users (`[User!]!`). |
| `user(id: ID!)` | Query | Returns a single user by id, or null. |
| `createUser(input: CreateUserInput!)` | Mutation | Creates a user from `{ name, email }`. |

## User-Facing Terms

| Term | Definition |
| --- | --- |
| **Home screen** | The landing view at `/`, showing the Vamp title, tagline, and the list of users (`app/src/screens/HomeScreen.tsx`). |

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
