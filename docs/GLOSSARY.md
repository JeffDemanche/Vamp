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
| **Contributor** | A user who collaborates on a project but does not own it. Tracked in `Project.contributors` as `ProjectUser` memberships (not bare users). |
| **Poetic project name** | The short, evocative two-word title (e.g. "Crimson Echo") auto-generated for a new empty project using the RiTa NLP library (`server/src/lib/projectName.ts`). |
| **Recording** | A user's in-flight audio take within a project. Client editor state held in jotai (`recordingAtom` in `app/src/state/timeline.ts`): which track (`trackId`), the timeline `startSample` where the take begins, and the wall-clock `startedAt` instant. Armed from the `TimelineToolbar` record button on the **selected track**; if playback is stopped it also starts transport (with `startSample = playStart`), otherwise `startSample` is the live playhead. Recording ends whenever playback stops (`RecordingTransportController`). Persisted per user on `ProjectUser.recording` via `ProjectUserSync` so collaborators can observe live recording state in future. |
| **Sample (timeline unit)** | The unit for project-timeline timestamps and durations. Unless explicitly stated otherwise, every timeline position/length (e.g. `ProjectClip.start`, `ProjectClip.duration`) is an integer count of audio samples, **not** seconds. See `AGENTS.md`. |
| **Selected track** | The one `ProjectTrack` the user has armed for new recordings. Client editor state (`selectedTrackIdAtom` in `app/src/state/timeline.ts`); at most one track is selected at a time, toggled by clicking a `TrackInfo` row in the `TrackPane`. Persisted per user on `ProjectUser.selectedTrack` via `ProjectUserSync`. |
| **Timeline viewport** | The slice of the project timeline currently visible in the editor, expressed in samples as `{ start, end }` — the sample coordinates at the timeline's left- and right-hand cutoffs (either may be negative). Client editor state held in jotai (`app/src/state/timeline.ts`), modified by pan/zoom gestures, and persisted per user on `ProjectUser` (`viewportStart`/`viewportEnd`) via `ProjectUserSync`. |
| **Owner** | The user who owns a project; a project has exactly one owner. Stored as `Project.owner`, a reference to the owner's `ProjectUser` membership (not the bare user). |
| **Audio upload flow** | How a clip's audio gets into storage without passing the bytes through the GraphQL API. `createAudioUpload` registers a `PENDING` `ProjectAudio` and returns an upload URL pointing at the server's `PUT /audio/upload/:audioId` route; the client `PUT`s the bytes there and the server forwards them to the configured **Audio storage** backend; then `createClip` confirms the object landed (`head`), flips the audio to `READY`, and links it to the timeline. The client helper `uploadAudioAndCreateClip` runs the whole flow (`app/src/projects/audioUpload.ts`). (Uploads are server-proxied for a uniform local/Vercel path; note Vercel Functions cap bodies at ~4.5 MB — larger files will need Vercel client uploads/multipart.) |
| **Playback range** | The sample window playback uses in the editor: `playStart` (where playback begins), `playEnd` (where it loops back to `playStart`), and a `loop` flag. `playEnd` is always a concrete sample position (kept `>= playStart`) but **only matters when `loop` is on**; with looping off, `playEnd` is ignored and playback runs indefinitely. Client editor state held in jotai (`app/src/state/timeline.ts`), visualized by the `TimelinePlayhead` scrubbers (the `playEnd` scrubber shows only while looping), reflected into the `AudioEngine`, and toggled (`loop`) via the `TimelineToolbar`. Persisted per user on `ProjectUser` (`playStart`/`playEnd`/`loop`) via `ProjectUserSync`. |
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
| `owner` | `ProjectUser` | The owner's membership. Stored as a ref to the owner's `ProjectUser` (not the bare `User`); resolved by a field resolver. |
| `contributors` | `[ProjectUser!]!` | Contributors' memberships. Stored as refs to `ProjectUser`; resolved by a field resolver. |
| `projectData` | `ProjectData` | The project's editable content. Stored as a ref; resolved by a field resolver. |
| `archived` | `Boolean` | Whether the project is archived (hidden from active lists). Defaults to `false`. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

### ProjectAudio
`server/src/entities/ProjectAudio.ts` · GraphQL type `ProjectAudio`

A handle to a single audio asset belonging to a `Project`, stored as an object
in the **Audio storage** backend (the `bucket`/`key` locate the raw bytes; the
bytes never pass through GraphQL). Lives in its **own collection** (not embedded)
so the same upload can back multiple clips. Created via the **Audio upload flow**
and tracked through `uploadStatus`: `PENDING` until the upload is confirmed, then
`READY`. A `ProjectClip` references one `ProjectAudio`. The `project`/`creator`
relations are persisted as refs with **no** `@Field` (lookup keys).

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier (also embedded in the object key). |
| `project` | `Ref<Project>` | The owning project. Stored only; not exposed via GraphQL. |
| `bucket` | `String` | The logical container the object lives in (`local` or `vercel-blob`). |
| `key` | `String` | The object key/pathname locating the raw bytes (`projects/<id>/audio/<id>`). |
| `contentType` | `String` | MIME type declared at upload (e.g. `audio/wav`); reconciled with the store on confirm. |
| `byteSize` | `Int` | Stored object size in bytes, captured on confirm. `null` while `PENDING`. |
| `filename` | `String` | Original client-side filename, for display. Optional. |
| `uploadStatus` | `AudioUploadStatus` | `PENDING` or `READY` (see **Audio upload flow**). Defaults to `PENDING`. |
| `downloadUrl` | `String` | Field-resolver-only: a URL to fetch the bytes (the local server route or the Vercel Blob URL), or `null` while `PENDING`. Not stored. |
| `creator` | `Ref<User>` | The user who uploaded the audio. Stored only; not exposed via GraphQL. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

`AudioUploadStatus` is the GraphQL enum (`PENDING` | `READY`) tracking that lifecycle.

### ProjectClip
`server/src/entities/ProjectClip.ts` · GraphQL type `ProjectClip`

A clip placed on a `ProjectTrack` within a `ProjectData` timeline, playing a
window of a `ProjectAudio`. An **embedded subdocument** stored in
`ProjectData.clips`. `start`/`duration`/`audioOffset` are integers measured in
**samples** (see the timeline-timestamp convention in `AGENTS.md`).

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `start` | `Int` | Clip start position on the timeline, in samples. |
| `duration` | `Int` | Clip length, in samples. |
| `audioOffset` | `Int` | How many samples into the underlying `ProjectAudio` the clip begins playing from. Defaults to `0`. |
| `track` | `ID` | The `_id` of the `ProjectTrack` (embedded on the same `ProjectData`) this clip is on. |
| `audio` | `ProjectAudio` | The audio the clip plays. Stored as a ref; hydrated by a field resolver. |
| `creator` | `User` | The user who created the clip. Stored as a ref; **not** exposed via `@Field` yet (will be hydrated by a field resolver). |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

### ProjectData
`server/src/entities/ProjectData.ts` · GraphQL type `ProjectData`

The editable content of a `Project` (tracks, clips, audio, etc.), split out so
project metadata can be listed without loading large payloads. Tracks and clips
are embedded subdocument arrays that load with the content.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `tracks` | `[ProjectTrack!]!` | The project's tracks. Embedded; defaults to `[]`. |
| `clips` | `[ProjectClip!]!` | The project's clips. Embedded; defaults to `[]`. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

### ProjectTrack
`server/src/entities/ProjectTrack.ts` · GraphQL type `ProjectTrack`

A single track within a `ProjectData` timeline. An **embedded subdocument**
stored in `ProjectData.tracks`. Clips reference the track they live on by this
document's `_id`.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `name` | `String` | Track name. Required, trimmed. |
| `creator` | `User` | The user who created the track. Stored as a ref; **not** exposed via `@Field` yet (will be hydrated by a field resolver). |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

### ProjectUser
`server/src/entities/ProjectUser.ts` · GraphQL type `ProjectUser`

A `User`'s **membership** in a `Project`: the join record tying a user to a
project, which also carries that user's per-project editor view state. It is
**keyed by the `(project, user)` combination** (a unique compound index — at most
one per pair), stored in its own collection. `Project.owner` and
`Project.contributors` reference these records (not bare `User`s), so a
`ProjectUser` is the canonical "this user is part of this project". A membership
is provisioned for the owner and each contributor when a project is created.

The `project`/`user` relations are persisted as refs with **no** `@Field` (they
are lookup keys); the `user` is hydrated via a field resolver. Beyond membership
it holds the editor's local view state so it survives reloads: the **playback
range** (`playStart`/`playEnd`/`loop`), the **Timeline viewport**
(`viewportStart`/`viewportEnd`), the **selected track** (`selectedTrack`), and the
active **Recording** (`recording`). All sample fields are integers in **samples**
(see `AGENTS.md`); defaults mirror the client's timeline defaults at 44.1 kHz. The
client persists changes through `updateProjectUserState` (via `ProjectUserSync`) and
hydrates them on load via `EditorProvider`.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier (the membership id referenced by `Project.owner`/`contributors`). |
| `project` | `Ref<Project>` | The project this membership belongs to. Stored only; not exposed via GraphQL. |
| `user` | `User` | The member. Stored as a `Ref<User>` (no `@Field`); exposed via a field resolver. |
| `playStart` | `Int` | Saved playback start, in samples. Defaults to `0`. |
| `playEnd` | `Int` | Saved playback loop point, in samples. Always concrete; only matters when `loop` is on. Defaults to `441000` (10s). |
| `loop` | `Boolean` | Whether playback loops back to `playStart` at `playEnd`. Defaults to `false`. |
| `viewportStart` | `Int` | Saved left edge of the visible timeline, in samples (may be negative). Defaults to `-44100`. |
| `viewportEnd` | `Int` | Saved right edge of the visible timeline, in samples (may be negative). Defaults to `441000`. |
| `selectedTrack` | `ID` | `_id` of the embedded `ProjectTrack` the user has selected for new recordings. Nullable; `null` when none is selected. |
| `recording` | `ProjectUserRecording` | The user's in-flight recording, or `null` when not recording. Embedded subdocument. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

### ProjectUserRecording
`server/src/entities/ProjectUser.ts` · GraphQL type `ProjectUserRecording`

A user's **active recording** within a project — the in-flight take being captured.
Embedded on `ProjectUser` (a subdocument with no own `_id`) and `null` whenever
the user is not recording.

| Field | Type | Notes |
| --- | --- | --- |
| `track` | `ID` | `_id` of the embedded `ProjectTrack` the take is captured on (the user's `selectedTrack` when recording began). |
| `startSample` | `Int` | Timeline sample the recording starts at (in **samples**). |
| `startedAt` | `DateTimeISO` | Wall-clock instant recording began. |

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
| `createAudioUpload(input: CreateAudioUploadInput!)` | Mutation | Begins the **Audio upload flow**: registers a `PENDING` `ProjectAudio` for `{ projectId, contentType, filename? }` and returns `{ audio, uploadUrl }` — the server `PUT` endpoint the client uploads the bytes to. Creator is the signed-in user. |
| `createClip(input: CreateClipInput!)` | Mutation | Places a `ProjectClip` on a project's timeline from `{ projectId, trackId, audioId, start, duration, audioOffset? }`. Confirms the referenced `ProjectAudio` finished uploading (flipping it to `READY`) and belongs to the project, then appends the embedded clip. Creator is the signed-in user. |
| `createEmptyProject(ownerId: ID!)` | Mutation | Creates a new empty project for the owner with an auto-generated poetic title (via RiTa) and auto-provisioned `ProjectData` seeded with a single starter `ProjectTrack` owned by the creator. |
| `createProject(input: CreateProjectInput!)` | Mutation | Creates a project from `{ title, ownerId, contributorIds }` and auto-provisions its `ProjectData` (seeded with a single starter `ProjectTrack` owned by the creator). |
| `createTrack(input: CreateTrackInput!)` | Mutation | Adds a `ProjectTrack` to a project's timeline from `{ projectId, name? }` (auto-named `Track <n>` when `name` is omitted). Creator is the signed-in user. Returns the updated `ProjectData` (its full track list). |
| `deleteTrack(input: DeleteTrackInput!)` | Mutation | Removes the `ProjectTrack` `{ projectId, trackId }` from a project's timeline, along with any `ProjectClip`s that live on it. Returns the updated `ProjectData`. |
| `login(input: LoginInput!)` | Mutation | Authenticates `{ email, password }`, begins a session (sets the HttpOnly session cookie), and returns the `User`. Returns a generic error on bad credentials. |
| `logout` | Mutation | Ends the current session (deletes it and clears the cookie). Returns `Boolean`. |
| `me` | Query | Returns the currently authenticated `User`, or null if not signed in. |
| `project(id: ID!)` | Query | Returns a single project by id, or null. |
| `projectAudio(id: ID!)` | Query | Returns a single `ProjectAudio` by id, or null (including its `downloadUrl` when `READY`). |
| `projectUser(projectId: ID!)` | Query | Returns the signed-in user's per-project view state (`ProjectUser`) for a project, or null if none has been saved yet. Identity comes from the authenticated user, not an argument. |
| `projectsByUser(userId: ID!, includeArchived: Boolean = false)` | Query | Returns projects the user owns or contributes to (`[Project!]!`), newest first. Archived projects are excluded unless `includeArchived` is `true`. |
| `register(input: RegisterInput!)` | Mutation | Registers a new account from `{ username, email, password }` (password hashed with scrypt) and returns the `User`. |
| `setProjectArchived(id: ID!, archived: Boolean!)` | Mutation | Archives or unarchives a project, returning the updated `Project`. |
| `updateProjectUserState(input: UpdateProjectUserStateInput!)` | Mutation | Persists (a subset of) the signed-in user's editor view state (`{ projectId, playStart?, playEnd?, loop?, viewportStart?, viewportEnd?, selectedTrack?, recording? }`) for a project, upserting the `ProjectUser` (only provided fields are written; pass `null` for `selectedTrack`/`recording` to clear them) and returning it. |
| `updateProjectMetadata(input: UpdateProjectMetadataInput!)` | Mutation | Updates metadata stored directly on a `Project` (currently `title`); `ProjectData` content has separate flows. |
| `user(id: ID!)` | Query | Returns a single user by id, or null. |
| `userByEmail(email: String!)` | Query | Returns a single user by email, or null. |
| `users` | Query | Returns all users (`[User!]!`). |

## User-Facing Terms

| Term | Definition |
| --- | --- |
| **Audio event** | A scheduled-able unit of playback the `AudioEngine` derives from a clip (`AudioEvent`): an in-memory audio file plus the timeline sample window (`startSample`/`endSample`, in **samples**) during which it sounds and the buffer offset to start from. What the engine actually hands to the Web Audio API when playback begins (`app/src/audio/AudioEngine.ts`). |
| **AudioEngine** | The client-side playback engine: the interface between the editor UI, the Web Audio API, the decoded audio files it holds in memory, and the **audio events** derived from a project's clips. `update` reflects the editor state it depends on (clips plus the timeline's sample rate and **Playback range**, including `loop`) and re-derives its events; `play`/`stop` begin/end playback by scheduling each event as a Web Audio source against the audio clock; with `loop` on it restarts at `playStart` when it reaches `playEnd` instead of stopping. It tracks the playing state and the audio-clock/sample anchors so its `timecode` getter reports the current timeline position (in samples) accurately for the UI to poll (`app/src/audio/AudioEngine.ts`). |
| **AudioEngineProvider** | The client glue that owns one `AudioEngine` per timeline editor and keeps it in sync with the editor's jotai state. Rendered inside the editor's jotai `Provider`; an effect pushes the sample rate and **Playback range** into `engine.update`. Exposes `useAudioEngine` (the instance), `useAudioEnginePlaying` (reactive playing state), and `useAudioEngineTimecode` (the live `timecode`, polled on `requestAnimationFrame` for the playhead) (`app/src/audio/AudioEngineProvider.tsx`). |
| **Clip (component)** | The pure composite that renders a `ProjectClip` on the timeline. The owning feature absolutely positions it (left/width from the clip's sample `start`/`duration`) within a track lane; the composite supplies the clip box, its header `label`, consistent interactive affordances (hover/focus/pressed plus a `selected` highlight ring), and two variants: `standard` (a placed clip) and `recording` (a clip actively being recorded — destructive-tinted and pulsing). All state arrives via props (`app/src/components/composites/clip.tsx`). |
| **EditorProvider** | Scopes the project editor's jotai state to one editor instance: hydrates atoms from the user's saved `ProjectUser` on mount and mounts `ProjectUserSync` to persist changes. Wraps both the `TrackPane` and `TimelineEditor` so they share viewport, playback, selected-track, and recording state (`app/src/components/features/EditorProvider.tsx`). |
| **LandingView** | The landing view at `/`, showing the Vamp title, tagline, and the list of users. Its header adapts to the session (via the `me` query): when signed out it shows login/sign-up links; when signed in it shows a "Go to your Vamps" link to `UserHomeView` (`/home`) and a log-out link to `LogoutView` (`/logout`) (`app/src/components/views/LandingView.tsx`). |
| **LoginView** | The login view at `/login`; an email + password form that begins a session and redirects to `/home` on success (`app/src/components/views/LoginView.tsx`). |
| **LogoutView** | The logout route at `/logout`; on mount it runs the `logout` mutation (via the `useLogout` hook, clearing the cached `me` user) and then redirects to `LandingView` (`/`). Lets a `Link to="/logout"` act as a logout action (`app/src/components/views/LogoutView.tsx`). |
| **ProjectTitleField** | A feature that renders a project's title as an editable heading and persists edits via `updateProjectMetadata` (optimistically); used in the `ProjectView` header (`app/src/components/features/ProjectTitleField.tsx`). |
| **ProjectUserSync** | A headless feature listener that persists the signed-in user's editor view state to `ProjectUser` as it changes. It subscribes to the aggregated `persistedEditorStateAtom` (timeline viewport + playback range + loop + selected track + recording), debounces bursts (e.g. pan/zoom), and upserts via `updateProjectUserState`, skipping the initial mount value. Mounted inside `EditorProvider`'s jotai `Provider` (`app/src/components/features/ProjectUserSync.tsx`). |
| **RecordingClip** | The feature that draws the live, in-progress **Recording** as a red `recording`-variant **Clip (component)** on its track's `Swimlane`. It reads the active recording (`useRecording`) and the `AudioEngine`'s live `timecode`, placing a `SwimlaneItem` that starts at the recording's `startSample` and grows smoothly toward the playhead as the take proceeds. Renders nothing unless a recording is active on its `trackId`, so it disappears when recording stops (a placed `standard` clip will replace it once persisted recordings exist). Rendered inside each lane by `TrackLanes` (`app/src/components/features/RecordingClip.tsx`). |
| **RecordingTransportController** | A headless feature listener that ends the active recording whenever playback stops. Recording is tied to the transport: arming record starts playback if stopped, and any stop clears recording. Mounted inside `TimelineEditor`'s `AudioEngineProvider` (`app/src/components/features/RecordingTransportController.tsx`). |
| **ProjectView** | The view for a single project at `/projects/:projectId`. Fetches the project (via the `project` query) and shows its name (an editable `ProjectTitleField`) and owner at the top, with a `TrackPane` and the `TimelineEditor` filling the rest of the screen side by side (`app/src/components/views/ProjectView.tsx`). Guarded by `RequireAuth`. |
| **ProjectsTable** | A feature that lists a user's non-archived projects in a table, each row linking into the project; used by `UserHomeView` (`app/src/components/features/ProjectsTable.tsx`). |
| **RegisterView** | The registration view at `/register`; a username/email/password form that creates an account, then sends the user to `LoginView` (`app/src/components/views/RegisterView.tsx`). |
| **RequireAuth** | Client route guard that renders its children only for a signed-in user (via the `me` query) and otherwise redirects to `LoginView` (`app/src/auth/RequireAuth.tsx`). Wraps `UserHomeView` and `ProjectView`. |
| **Swimlane** | The pure composite for a single track's horizontal lane on the `Timeline`. Spans the full timeline viewport width and is sized (`h-14`) and stacked to align with the track's `TrackInfo` row in the `TrackPane`. Establishes a sample → pixel coordinate system for its children: from its measured width and the `viewportStart`/`viewportEnd` props it derives `SwimlaneCoords` (exposed via the `useSwimlaneCoords` context) so content — placed with the `SwimlaneItem` helper — stays pinned to its sample position as the **Timeline viewport** pans/zooms. Carries a faint background so empty lanes are visible. All state arrives via props (`app/src/components/composites/swimlane.tsx`). |
| **Timeline** | The pure composite for the project's horizontal editing timeline surface. Renders a `TimelineRuler` background and `TimelinePlayhead` scrubbers (including the live `playbackPosition` playhead) underneath/over its track/region children and converts pointer-drag (pan) and ctrl/⌘ + wheel (zoom) gestures into `onPan`/`onZoom` sample-delta callbacks. Receives the visible range, **Playback range**, and live playback position via props (`app/src/components/composites/timeline.tsx`). |
| **TimelineEditor** | The feature that connects the jotai **Timeline viewport** and **Playback range** state to the pure `Timeline` composite: it reads the visible sample range via `useTimelineViewport` and the play range via `useTimelinePlayback`, forwards pan/zoom gestures back into the atoms, and feeds the `AudioEngine`'s live `timecode` down as the playhead while playing. Owns the editor's jotai `Provider` and `AudioEngineProvider` and stacks the `TimelineToolbar` above the timeline surface. Mounted in `ProjectView` (`app/src/components/features/TimelineEditor.tsx`). |
| **TimelinePlayhead** | A canvas primitive that draws the **Playback range** scrubbers over the timeline: a forward-facing (right-pointing) triangle at `playStart` in the header band, a backward-facing (left-pointing) triangle at `playEnd` when it is non-null (each with a thin full-height guide line), and — while playing — a solid full-height `playbackPosition` playhead line tracking the live audio-engine position. Pure; takes `viewportStart`/`viewportEnd`/`headerHeight`/`playStart`/`playEnd`/`playbackPosition` props and resolves theme colors (`--primary`, `--secondary-foreground`, `--destructive`) from its own computed style (`app/src/components/primitives/timeline-playhead.tsx`). |
| **TimelineToolbar** | The feature toolbar above the timeline surface holding playback/timeline controls: a **loop** toggle (flips `loop` in the **Playback range**) and a **play/stop** button that drives the editor's `AudioEngine` and reflects its playing state. Rendered by `TimelineEditor` inside the jotai `Provider`/`AudioEngineProvider` (`app/src/components/features/TimelineToolbar.tsx`). |
| **TimelineRuler** | A canvas primitive that draws the timeline's background markers — per-second ticks plus periodic timestamp labels — for the visible sample range. Pure; takes `viewportStart`/`viewportEnd`/`sampleRate` props and assumes 44.1 kHz by default (`app/src/components/primitives/timeline-ruler.tsx`). |
| **TrackInfo** | The pure composite for a single row in the timeline's `TrackPane`, summarizing one `ProjectTrack` (its name) and exposing a delete control (a trash button shown when an `onDelete` callback is provided). Receives all state via props (`app/src/components/composites/track-info.tsx`). |
| **TrackLanes** | The feature that renders the project's track `Swimlane`s as the `Timeline`'s children: it reads the tracks from the cached `project` query and the visible sample range via `useTimelineViewport`, then stacks one lane per track (spacing mirrored from the `TrackPane`) so each lane lines up with its `TrackInfo` row. Each lane hosts a `RecordingClip` so the live take appears on the track that is recording. Mounted by `TimelineEditor` inside the jotai `Provider` (`app/src/components/features/TrackLanes.tsx`). |
| **TrackPane** | The feature pane to the left of the `TimelineEditor` in `ProjectView` that lists the project's tracks as `TrackInfo` composites (read from the cached `project` query). An "Add track" button below the list creates a new track (`createTrack`), and each `TrackInfo`'s delete control removes its track (`deleteTrack`); both return the updated `ProjectData`, which Apollo merges into the cache so the list and timeline lanes refresh automatically (`app/src/components/features/TrackPane.tsx`). |
| **UserHomeView** | The signed-in user's home view at `/home`. Its header links back to `LandingView` (`/`) and offers a log-out action (via the `useLogout` hook). Below it shows a projects toolbar (currently a `CreateProjectButton`) above a `ProjectsTable` of the projects the user owns and collaborates on (`app/src/components/views/UserHomeView.tsx`). Guarded by `RequireAuth`. |
| **View** | A top-level, route-level screen component on the client. The top tier of the [UI component architecture](../.cursor/rules/ui-architecture.mdc); views live in `app/src/components/views/` and are suffixed `View`. |

## Infrastructure & Local Development

| Term | Definition |
| --- | --- |
| **Audio storage** | The pluggable backend holding raw clip audio, abstracted behind the `AudioStorage` interface (`server/src/lib/audioStorage.ts`) and tracked as `ProjectAudio` records via the **Audio upload flow**. Two drivers, selected by `AUDIO_STORAGE_DRIVER`: `local` (`LocalAudioStorage`, default — writes files under `AUDIO_LOCAL_DIR` and serves them from the server's `GET /audio/blob/...` route, for development) and `vercel` (`VercelBlobAudioStorage` — Vercel Blob via `@vercel/blob`, needs `BLOB_READ_WRITE_TOKEN`). Tests inject an in-memory fake. The binary transfer routes live in `server/src/routes/audioRoutes.ts`. |
| **Docker dev environment** | The full local stack (MongoDB, API, Vite) started with `docker compose watch`. Defined in `docker-compose.yml` + `Dockerfile`; keeps containers in sync with the working tree for live reload. |

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
