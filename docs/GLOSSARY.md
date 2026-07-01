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
| **Archived clip** | A `ProjectClip` soft-removed from the timeline by flipping its `ProjectClip.archived` flag (via the `archiveClips` mutation). The clip stays embedded on `ProjectData.clips` so its underlying take is retained, but it is filtered out of the API's `clips` and no longer renders. Triggered from the editor by selecting clips and pressing the delete **Hotkey**. Analogous to an **Archived project**, but for an individual clip. |
| **Archived project** | A project flagged inactive via `Project.archived`. Set/unset with the `setProjectArchived` mutation; archived projects are hidden from the active project list but not deleted. Users archive a project from the home view's `ProjectsTable` via the per-row archive action, which opens a **ConfirmDialog** before dropping the row from the active list. |
| **Authentication** | Email + password sign-in. `register` creates an account (password hashed with scrypt); `login` begins a server-side `Session` delivered as an HttpOnly cookie; `logout` ends it. See the `Session` data model and the auth GraphQL operations. |
| **Clip drag** | Repositioning a placed `ProjectClip` on the timeline by dragging it. A drag moves the clip **horizontally**, updating its `start` (in samples); if the pointer crosses into another track's swimlane the clip previews on that track, and on release the new placement (`start` and, if it changed, `track`) is committed via the `updateClip` mutation. Built on the standardized **useTimelineDrag** gesture (with a small movement threshold so a press without movement still selects rather than moves). The in-flight preview lives in client-only jotai state (`clipDragAtom` in `app/src/state/timeline.ts`, via `useClipDrag`/`useSetClipDrag`): the dragged `TimelineClip` publishes its previewed `{ start, trackId }` while the source clip dims in place, and `TrackLanes` draws a floating copy following the cursor (above the lanes, so it isn't clipped by a swimlane's `overflow-hidden`). The previewed track is found by hit-testing each lane's `data-track-id` rect against the pointer's Y. |
| **Clip mode** | How a `ProjectClip` schedules its underlying audio for playback. `FLAT` plays the audio once and stops at the clip end; `STACKED` overlays the recorded loop passes on top of each other within a single loop region (using `ProjectAudio.loopLength`), so a looped recording sounds stacked on itself even though it is one file. Stored on `ProjectClip.mode` (`ClipMode` enum). See **Flat clip** and **Stacked clip**. |
| **Collaborative music-making** | The core value proposition: multiple users creating music together. Surfaced as the app's tagline on the home screen. |
| **Contributor** | A user who collaborates on a project but does not own it. Tracked in `Project.contributors` as `ProjectUser` memberships (not bare users). |
| **Flat clip** | A `ProjectClip` with `mode = FLAT`. Plays its underlying audio once, windowed to the clip's `[start, start + duration)` range and stopped at the clip end. The default for file imports and non-looped recordings. |
| **Hotkey** | A contextual keyboard shortcut in the project editor. A single `HotkeyProvider` (`app/src/hotkeys/HotkeyProvider.tsx`) owns one window `keydown` listener and a registry of bindings; feature components register shortcuts via the `useHotkey` hook for as long as they are mounted, so a shortcut exists only while its surface is on screen and can gate itself with an `enabled` flag. The most recently registered binding for a keystroke wins (so nested contexts override), and bindings don't fire while typing in an editable element unless they opt in. Combos are `+`-separated strings (e.g. `"Delete"`, `"Mod+z"`, `"space"`). `ClipHotkeys` binds Delete/Backspace to archive the **Selected clips**, and `TransportHotkeys` binds Space (play/stop), R (record), and L (toggle loop). |
| **Poetic project name** | The short, evocative two-word title (e.g. "Crimson Echo") auto-generated for a new empty project using the RiTa NLP library (`server/src/lib/projectName.ts`). |
| **Microphone access** | The browser permission to capture audio for **Recording**. The editor probes it passively on load (`navigator.permissions`, no prompt) and watches for changes so the `TimelineToolbar` can reflect blocked access ahead of time; the actual prompt happens on the first capture attempt (`getUserMedia`). When access is already granted and a **Selected track** is armed, the `RecordingController` also pre-acquires the mic via `AudioEngine.prepareRecording` so Record can start capture without waiting on `getUserMedia` (the browser's mic indicator may stay on while the editor is open). Denials and hardware failures are translated into user-facing messages and a retry. Helpers live in `app/src/audio/microphone.ts`; the flow is orchestrated by the `RecordingController`. |
| **Recording** | A user's in-flight audio take within a project, capturing live microphone audio onto a track. Client editor state held in jotai (`recordingAtom` in `app/src/state/timeline.ts`): which track (`trackId`), the timeline `startSample` where the take begins, the wall-clock `startedAt` instant, and (when the transport was looping at capture start) the `loopLength` and `playStart` in samples. Armed from the `TimelineToolbar` record button on the **selected track** via the `RecordingController`: recording state flips on immediately (optimistic UI) so the live `RecordingClip` appears on click, then the `AudioEngine` begins capture (reusing a pre-acquired mic stream when **Microphone access** is already granted); if playback is stopped it also starts transport in the same audio-clock instant capture begins (`startSample = playStart`), otherwise `startSample` is the live playhead and the provisional anchor is reconciled if the playhead moved during acquisition. The live take is drawn by the `RecordingClip`. Recording ends whenever playback stops, at which point the captured audio is saved as a new **ProjectClip** (via the **Audio upload flow**). When the transport was looping at capture start, the clip is created as a **Stacked clip** — its `duration` is the loop region (one loop length) once the take reaches the first loop point, otherwise the measured capture length; if the take crosses the loop boundary (starts near `playEnd`, stops after the playhead wraps back toward `playStart`) the clip anchors at `playStart`, spans the full loop region, and its audio is remapped into loop coordinates. Non-looped takes become **Flat clip**s spanning the measured duration. Persisted per user on `ProjectUser.recording` via `ProjectUserSync` so collaborators can observe live recording state in future. |
| **Recording settings** | Editor controls for choosing which audio input and output devices the `AudioEngine` uses. Opened from a settings button beside the **TimelineToolbar** record button (`RecordingSettings` popover). Input selection is passed to `getUserMedia` on the next capture; output selection routes playback through `AudioContext.setSinkId` when the browser supports it. Device lists come from `navigator.mediaDevices.enumerateDevices` (`app/src/audio/audioDevices.ts`); selections are held on the engine via `useAudioDevices` in `AudioEngineProvider`. |
| **Sample (timeline unit)** | The unit for project-timeline timestamps and durations. Unless explicitly stated otherwise, every timeline position/length (e.g. `ProjectClip.start`, `ProjectClip.duration`) is an integer count of audio samples, **not** seconds. See `AGENTS.md`. |
| **Selectable surface** | The single selection styling pattern shared by interactive timeline surfaces — `TrackInfo` rows and the **Clip (component)**. Rather than ringing a selected element, it recolours it with its own scheme: an unselected surface shows a subtle, surface-tinted version of the scheme, and a selected surface is filled with the scheme's full colour and matching foreground (keyed off a `data-selected` attribute). Two schemes: `neutral` (card → primary fill) and `destructive` (faint tint → solid destructive fill); an `interactive` flag gates the pointer/hover/focus affordances. Defined as a `cva` in `app/src/lib/selectable.ts`. |
| **Selected clips** | The set of `ProjectClip`s the user has selected on the timeline. Unlike the single **Selected track**, the timeline supports a **multi-clip** selection. Client-only editor state (`selectedClipIdsAtom` in `app/src/state/timeline.ts`, accessed via `useSelectedClips`): a plain click on a `TimelineClip` collapses the selection to that clip (or clears it if it was the sole selection), while ⌘/Ctrl-click adds/removes it. Drives commands like the delete **Hotkey**, which archives every selected clip. Not persisted (unlike the **Selected track**). |
| **Selected track** | The one `ProjectTrack` the user has armed for new recordings. Client editor state (`selectedTrackIdAtom` in `app/src/state/timeline.ts`); at most one track is selected at a time, toggled by clicking a `TrackInfo` row in the `TrackPane`. Persisted per user on `ProjectUser.selectedTrack` via `ProjectUserSync`. |
| **Stacked clip** | A `ProjectClip` with `mode = STACKED`. Occupies one loop region on the timeline — normally its `duration`/`maxDuration` equal `ProjectAudio.loopLength` (`L`), but if a looped **Recording** stops before the first loop point, `duration`/`maxDuration` match the captured length instead (still `STACKED`, with `loopLength` stored on the audio). If a looped recording crosses the playback loop boundary, the clip anchors at `playStart` and spans the full loop region (`L`), with capture-order audio remapped into loop coordinates. The underlying recording spans one or more loop passes. Each pass is a persisted **AudioInClip** (same timeline window, `audioOffset += k*L`). On playback the engine schedules every **AudioInClip**, intersecting each with the clip trim envelope so shortening the clip below `L` truncates all layers at the clip end. During an in-flight looped **Recording**, stacked playback of completed passes begins after the first loop wrap. |
| **Timeline viewport** | The slice of the project timeline currently visible in the editor, expressed in samples as `{ start, end }` — the sample coordinates at the timeline's left- and right-hand cutoffs (either may be negative). Client editor state held in jotai (`app/src/state/timeline.ts`), modified by pan/zoom gestures, and persisted per user on `ProjectUser` (`viewportStart`/`viewportEnd`) via `ProjectUserSync`. |
| **Owner** | The user who owns a project; a project has exactly one owner. Stored as `Project.owner`, a reference to the owner's `ProjectUser` membership (not the bare user). |
| **Audio upload flow** | How a clip's audio gets into storage without passing the bytes through the GraphQL API. `createAudioUpload` registers a `PENDING` `ProjectAudio` and returns an upload URL pointing at the server's `PUT /audio/upload/:audioId` route; the client `PUT`s the bytes there and the server forwards them to the configured **Audio storage** backend; then `createClip` confirms the object landed (`head`), flips the audio to `READY`, and links it to the timeline. The client helper `uploadAudioAndCreateClip` runs the whole flow and, on `createClip`, appends the new clip into the cached `Project` query so the timeline lanes render it immediately without a refetch (`app/src/projects/audioUpload.ts`). (Uploads are server-proxied for a uniform local/Vercel path; note Vercel Functions cap bodies at ~4.5 MB — larger files will need Vercel client uploads/multipart.) |
| **Playback range** | The sample window playback uses in the editor: `playStart` (where playback begins), `playEnd` (where it loops back to `playStart`), and a `loop` flag. `playEnd` is always a concrete sample position (kept `>= playStart`) but **only matters when `loop` is on**; with looping off, `playEnd` is ignored and playback runs indefinitely. Client editor state held in jotai (`app/src/state/timeline.ts`), visualized by the `TimelinePlayhead` scrubbers (the `playEnd` scrubber shows only while looping) and adjusted by dragging the `PlaybackScrubbers` handles, reflected into the `AudioEngine`, and toggled (`loop`) via the `TimelineToolbar`. The handle setters keep the range ordered: `setPlayStart`/`setPlayEnd` push the opposite edge along, while `dragPlayBoundary` (used by dragging) **swaps** start/end when one is dragged past the other. Persisted per user on `ProjectUser` (`playStart`/`playEnd`/`loop`) via `ProjectUserSync`. |
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
| `loopLength` | `Int` | The loop length (in samples) active when this audio was recorded over a looping transport. `null` for non-looped takes and file imports. Used by **stacked** clips when deriving **AudioInClip** pass counts. |
| `durationSamples` | `Int` | Duration of the decoded recording in timeline samples. Set at clip creation (`createClip`) so legacy **stacked** clips can backfill their **AudioInClip** pass count. Optional. |
| `uploadStatus` | `AudioUploadStatus` | `PENDING` or `READY` (see **Audio upload flow**). Defaults to `PENDING`. |
| `downloadUrl` | `String` | Field-resolver-only: a URL to fetch the bytes (the local server route or the Vercel Blob URL), or `null` while `PENDING`. Not stored. |
| `creator` | `Ref<User>` | The user who uploaded the audio. Stored only; not exposed via GraphQL. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

`AudioUploadStatus` is the GraphQL enum (`PENDING` | `READY`) tracking that lifecycle.

### AudioInClip
`server/src/entities/AudioInClip.ts` · GraphQL type `AudioInClip`

One dispatched playback event belonging to a **ProjectClip** — the persisted unit
the **AudioEngine** schedules (see **Audio event**). Multiple `AudioInClip`s may
reference the same underlying **ProjectAudio** bytes (e.g. stacked loop passes).
Embedded on `ProjectClip.audioInClips`. Baked by the client at `createClip` and
validated server-side (`@vamp/shared`). `start`/`duration`/`audioOffset` are in
**samples**.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `start` | `Int` | Intrinsic timeline start where this event sounds. Shifts with the parent clip on `updateClip`. |
| `duration` | `Int` | Intrinsic timeline length of this event. Not rewritten when the parent clip is trimmed — the clip envelope intersects at playback (see **Audio event**). |
| `audioOffset` | `Int` | Offset into the parent clip's `ProjectAudio` where this event begins reading. |

### ProjectClip
`server/src/entities/ProjectClip.ts` · GraphQL type `ProjectClip`

A clip placed on a `ProjectTrack` within a `ProjectData` timeline, playing a
window of a `ProjectAudio`. An **embedded subdocument** stored in
`ProjectData.clips`. `start`/`duration`/`audioOffset` are integers measured in
**samples** (see the timeline-timestamp convention in `AGENTS.md`).

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `start` | `Int` | Clip start position on the timeline, in samples. Updatable via `updateClip` (the **Clip drag**). |
| `duration` | `Int` | Clip length, in samples. May be shortened via `updateClip` but never exceeds `maxDuration`. |
| `maxDuration` | `Int` | The clip's original size, in samples — set at creation and never exceeded by `duration`. |
| `mode` | `ClipMode` | How the clip schedules its underlying audio (`FLAT` or `STACKED`). Defaults to `FLAT`. See **Clip mode**. |
| `audioOffset` | `Int` | How many samples into the underlying `ProjectAudio` the clip begins playing from. Defaults to `0`. |
| `audioInClips` | `[AudioInClip!]!` | Baked dispatched playback events for this clip (one per loop pass for **stacked** clips). Exposed via a field resolver that backfills legacy clips. |
| `track` | `ID` | The `_id` of the `ProjectTrack` (embedded on the same `ProjectData`) this clip is on. Reassigned by `updateClip` when a **Clip drag** drops the clip on another track. |
| `audio` | `ProjectAudio` | The audio the clip plays. Stored as a ref; hydrated by a field resolver. |
| `creator` | `User` | The user who created the clip. Stored as a ref; **not** exposed via `@Field` yet (will be hydrated by a field resolver). |
| `archived` | `boolean` | Whether the clip has been soft-removed from the timeline. Stored only (no `@Field`); archived clips stay on `ProjectData.clips` so the take is retained, but are filtered out of the API's `clips`. Defaults to `false`. Set by `archiveClips`. |
| `createdAt` | `DateTimeISO` | Set on creation; defaults to now. |

`ClipMode` is the GraphQL enum (`FLAT` | `STACKED`) for **Clip mode**.

### ProjectData
`server/src/entities/ProjectData.ts` · GraphQL type `ProjectData`

The editable content of a `Project` (tracks, clips, audio, etc.), split out so
project metadata can be listed without loading large payloads. Tracks and clips
are embedded subdocument arrays that load with the content. Holds a stored
`project` back-reference to its owning `Project` so the `audios` field resolver
can load every `ProjectAudio` belonging to the project.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `ID` | Server-generated unique identifier. |
| `project` | `Ref<Project>` | Back-reference to the owning project. Stored only; not exposed via GraphQL (powers the `audios` resolver). |
| `tracks` | `[ProjectTrack!]!` | The project's tracks. Embedded; defaults to `[]`. |
| `clips` | `[ProjectClip!]!` | The clips currently placed on the timeline. Backed by an embedded subdocument array (defaults to `[]`) but exposed through a field resolver that filters out **archived** clips, so consumers see only live clips while archived takes stay in storage. |
| `audios` | `[ProjectAudio!]!` | Field-resolver-only: every `ProjectAudio` belonging to the project (looked up by the stored `project` back-reference), so clients can download all project audio without walking `clips`. Not stored. |
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
| `archiveClips(input: ArchiveClipsInput!)` | Mutation | Archives (soft-removes) the clips `{ projectId, clipIds }` from a project's timeline by flipping each `ProjectClip.archived` to `true`. The clips stay in storage but are filtered out of the API's `clips`. Returns the updated `ProjectData` (with archived clips already excluded) so the client refreshes its timeline. Used by the project view's delete hotkey to remove the **Selected clips**. |
| `createAudioUpload(input: CreateAudioUploadInput!)` | Mutation | Begins the **Audio upload flow**: registers a `PENDING` `ProjectAudio` for `{ projectId, contentType, filename?, loopLength? }` and returns `{ audio, uploadUrl }` — the server `PUT` endpoint the client uploads the bytes to. Creator is the signed-in user. |
| `createClip(input: CreateClipInput!)` | Mutation | Places a `ProjectClip` on a project's timeline from `{ projectId, trackId, audioId, start, duration, audioOffset?, mode?, audioInClips, durationSamples? }`. Client-baked `audioInClips` are validated server-side. Sets `maxDuration = duration`. Confirms the referenced `ProjectAudio` finished uploading (flipping it to `READY`) and belongs to the project, then appends the embedded clip. Creator is the signed-in user. |
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
| `updateClip(input: UpdateClipInput!)` | Mutation | Moves or trims a `ProjectClip` on the timeline from `{ projectId, clipId, start?, duration?, track? }` — repositioning it (`start`, in samples), shortening it (`duration`, clamped to `maxDuration`), and/or moving it to another `track`; omitted fields are left unchanged. Returns the updated `ProjectClip`, which keeps its `_id` so Apollo merges the new placement into the cache and the lanes re-render. Used by the **Clip drag**. |
| `updateProjectUserState(input: UpdateProjectUserStateInput!)` | Mutation | Persists (a subset of) the signed-in user's editor view state (`{ projectId, playStart?, playEnd?, loop?, viewportStart?, viewportEnd?, selectedTrack?, recording? }`) for a project, upserting the `ProjectUser` (only provided fields are written; pass `null` for `selectedTrack`/`recording` to clear them) and returning it. |
| `updateProjectMetadata(input: UpdateProjectMetadataInput!)` | Mutation | Updates metadata stored directly on a `Project` (currently `title`); `ProjectData` content has separate flows. |
| `user(id: ID!)` | Query | Returns a single user by id, or null. |
| `userByEmail(email: String!)` | Query | Returns a single user by email, or null. |
| `users` | Query | Returns all users (`[User!]!`). |

## User-Facing Terms

| Term | Definition |
| --- | --- |
| **Audio event** | A schedulable unit of playback derived from a persisted **AudioInClip** after intersecting it with the parent clip's trim envelope (`resolveScheduledEvent` in `@vamp/shared`): an in-memory audio file plus the effective timeline window (`startSample`/`endSample`, in **samples**) and buffer offset. What the **AudioEngine** hands to the Web Audio API when playback begins (`app/src/audio/AudioEngine.ts`). |
| **AudioEngine** | The client-side playback **and recording** engine: the interface between the editor UI, the Web Audio API, the decoded audio files it holds in memory (keyed by `ProjectAudio._id`), and the **audio events** flattened from each clip's baked **AudioInClip** list (intersected with the clip trim envelope). `loadAudio`/`setAudioBuffer` populate the in-memory store; upstream code fetches `READY` audio bytes via `ensureAudioLoaded` before scheduling. During capture it taps the mic into an accumulating PCM buffer (`getRecordingBuffer`, `subscribeRecordingBuffer`) for the live **RecordingClip** waveform; after the first loop wrap during a looped take it also schedules completed passes from that buffer (`LIVE_RECORDING_AUDIO_ID`). `update` reflects clips plus the timeline's sample rate and **Playback range**; `play`/`stop` schedule each event as a Web Audio source. See `app/src/audio/AudioEngine.ts`. |
| **AudioEngineProvider** | The client glue that owns one `AudioEngine` per timeline editor and keeps it in sync with the editor's jotai state and the project's content. Rendered inside the editor's jotai `Provider`; reads the cached `project` query, maps each `READY` `ProjectClip` into engine clips, and downloads the project's whole audio library (`projectData.audios`) via `ensureAudioLoaded` into the engine's in-memory store (keyed by `ProjectAudio._id`) — rather than walking clips — before/while pushing clips plus the sample rate and **Playback range** into `engine.update`. Exposes `useAudioEngine` (the instance), `useAudioEnginePlaying` (reactive playing state), `useAudioEngineTimecode` (the live `timecode`, polled on `requestAnimationFrame` for the playhead), `useAudioBuffer` (a clip's decoded buffer, re-rendering when it lands, for the **Clip waveform**), `useRecordingBuffer` (the in-progress take's PCM, for the live **RecordingClip** waveform), and `useAudioDevices` (enumerated input/output devices plus selection wired to **Recording settings**) (`app/src/audio/AudioEngineProvider.tsx`). |
| **Client audio loader** | Client helper that downloads a `READY` `ProjectAudio`'s bytes from its GraphQL `downloadUrl` (local dev: the server's `GET /audio/blob/...` route; production: Vercel Blob) and decodes them into the `AudioEngine`'s in-memory store under the audio's `_id`. `ensureAudioLoaded` no-ops for `PENDING` audio or already-loaded ids and deduplicates concurrent fetches; `filterReadyAudios` narrows a project's `audios` list to the downloadable ones. Invoked by `AudioEngineProvider` over `projectData.audios` (`app/src/audio/audioLoader.ts`, `app/src/audio/clipMapping.ts`). |
| **Clip (component)** | The pure composite that renders a `ProjectClip` on the timeline. The owning feature absolutely positions it (left/width from the clip's sample `start`/`duration`) within a track lane; the composite supplies the clip box, its header `label`, and two variants: `standard` (a placed clip, rendered by `TimelineClip`) and `recording` (a clip actively being recorded, rendered by `RecordingClip` — destructive-tinted and pulsing). Selection follows the shared **Selectable surface** pattern (recolouring to its full scheme when `selected`, no ring); passing an `onSelect` callback makes the clip interactive (click/Enter/Space to select, with the originating event passed so callers can read modifier keys). An optional `badge` slot renders a small adornment at the trailing edge of the header (used for the **Clip mode badge**). Any `children` are drawn as a pointer-inert background layer filling the clip behind the header label — used for the **Clip waveform**. All state arrives via props (`app/src/components/composites/clip.tsx`). |
| **Clip mode badge** | A subtle icon in a **Clip (component)** header indicating its **Clip mode**, built by `ClipModeBadge` and passed into the clip's `badge` slot (`app/src/components/features/TimelineClip.tsx`). Flat clips show a single-rectangle glyph; stacked clips show a stack glyph plus the number of baked **AudioInClip**s (dispatched playback events). Also drawn on the **Clip drag** preview. |
| **Clip waveform** | The waveform drawn in the background of a **Clip (component)**. The `ClipWaveform` feature draws one layer per **AudioInClip**, intersected with the clip trim envelope, reduced to mono peaks (`computeClipPeaks`) and handed to the pure **Waveform** primitive. For placed clips it reads from the `AudioEngine`'s decoded buffer (`useAudioBuffer`); for the live **RecordingClip** it reads in-progress PCM from `useRecordingBuffer`. Stacked clips overlay one layer per baked pass. See `app/src/components/features/ClipWaveform.tsx`. |
| **ClipHotkeys** | A headless feature that registers the editor's clip-related **Hotkey**s. Binds Delete/Backspace to archive every clip in the **Selected clips** (`archiveClips`) and clear the selection; the binding is disabled while nothing is selected. Must be mounted inside both a `HotkeyProvider` and the editor's jotai `Provider`; rendered by `ProjectView` (`app/src/components/features/ClipHotkeys.tsx`). |
| **ConfirmDialog** | The reusable confirmation popup used to guard consequential actions. A pure composite (`app/src/components/composites/confirm-dialog.tsx`) built on the `Dialog` primitive: the caller owns the open state and supplies the title, description, confirm/cancel labels, a `destructive` flag, a `pending` flag (spins/disables while the action runs), and the `onConfirm` handler. First used by the home view's `ProjectsTable` to confirm archiving a project (see **Archived project**). |
| **EditorProvider** | Scopes the project editor's jotai state to one editor instance: hydrates atoms from the user's saved `ProjectUser` on mount and mounts `ProjectUserSync` to persist changes. Wraps both the `TrackPane` and `TimelineEditor` so they share viewport, playback, selected-track, and recording state (`app/src/components/features/EditorProvider.tsx`). |
| **HotkeyProvider** | The provider that powers the editor's **Hotkey** system: owns a single window `keydown` listener and a ref-backed registry of bindings, and exposes the `useHotkey` hook for feature components to register contextual shortcuts. Resolves keystrokes most-recent-binding-first, skips editable targets unless a binding opts in, and matches `+`-separated combo strings (`"Mod"` = ⌘/Ctrl). Mounted in `ProjectView` around the editor (`app/src/hotkeys/HotkeyProvider.tsx`). |
| **LandingView** | The landing view at `/`, showing the Vamp title, tagline, and the list of users. Its header adapts to the session (via the `me` query): when signed out it shows login/sign-up links; when signed in it shows a "Go to your Vamps" link to `UserHomeView` (`/home`) and a log-out link to `LogoutView` (`/logout`) (`app/src/components/views/LandingView.tsx`). |
| **LoginView** | The login view at `/login`; an email + password form that begins a session and redirects to `/home` on success (`app/src/components/views/LoginView.tsx`). |
| **LogoutView** | The logout route at `/logout`; on mount it runs the `logout` mutation (via the `useLogout` hook, clearing the cached `me` user) and then redirects to `LandingView` (`/`). Lets a `Link to="/logout"` act as a logout action (`app/src/components/views/LogoutView.tsx`). |
| **PlaybackScrubbers** | The feature that renders the draggable handles for the **Playback range** scrubbers into the `Timeline`'s `headerOverlay`. Reads the play range (`useTimelinePlayback`) and the surface's `useTimelineCoords` to lay a transparent grab-zone over the `playStart` triangle (and, only while looping — matching the canvas scrubbers — the `playEnd` triangle). Dragging a handle moves it via the standardized `useTimelineDrag` gesture; while looping, dragging one handle past the other **swaps** their roles (`dragPlayBoundary`) so the dragged handle keeps following the cursor, with the active side tracked across the gesture in a ref. With looping off, only the start handle shows and it repositions `playStart`. The triangles themselves are still drawn by the `TimelinePlayhead` canvas (`app/src/components/features/PlaybackScrubbers.tsx`). |
| **ProjectTitleField** | A feature that renders a project's title as an editable heading and persists edits via `updateProjectMetadata` (optimistically); used in the `ProjectView` header (`app/src/components/features/ProjectTitleField.tsx`). |
| **ProjectUserSync** | A headless feature listener that persists the signed-in user's editor view state to `ProjectUser` as it changes. It subscribes to the aggregated `persistedEditorStateAtom` (timeline viewport + playback range + loop + selected track + recording), debounces bursts (e.g. pan/zoom), and upserts via `updateProjectUserState`, skipping the initial mount value. Mounted inside `EditorProvider`'s jotai `Provider` (`app/src/components/features/ProjectUserSync.tsx`). |
| **RecordingClip** | The feature that draws the live, in-progress **Recording** as a red `recording`-variant **Clip (component)** on its track's `Swimlane`. It reads the active recording (`useRecording`) and how much audio the engine has captured on the audio clock (`useRecordingCapturedSamples`), placing a `SwimlaneItem` via `recordingClipLayout` (same rules as persisted clip placement). For a flat take the clip grows with capture progress; for a looped take it grows until one loop length has been captured then locks to one loop region — using the audio clock so the width stays at full loop length after the transport wraps. When the take crosses the loop boundary the clip anchors at `playStart` and spans the full loop region, with live PCM remapped into loop coordinates for the waveform. A live **Clip waveform** is drawn from the engine's in-progress PCM tap (`useRecordingBuffer`), using the same stacked/flat layering rules as placed clips. Renders nothing unless a recording is active on its `trackId`, so it disappears when recording stops (a placed `standard` clip replaces it once the take is saved). Rendered inside each lane by `TrackLanes` (`app/src/components/features/RecordingClip.tsx`). |
| **RecordingController** | The feature that owns the editor's recording lifecycle and exposes it to the `TimelineToolbar` via `useRecordingControls`. Probes **Microphone access** on mount (no prompt) and tracks changes; when access is granted and a track is selected it keeps a warm mic stream via `AudioEngine.prepareRecording` (re-warmed after each take and when the input device changes). `beginRecording` flips recording state immediately for responsive UI, then starts capture on the engine (reconciling the anchor if the playhead moved during acquisition), surfacing denied/no-mic failures as a user-facing error and rolling back optimistic state on failure. When playback stops mid-recording it stops capture, clears the live recording state (hiding the `RecordingClip`), and runs the **Audio upload flow** (`uploadAudioAndCreateClip`) to `createClip` with placement derived from `recordingClipLayout` (including loop-boundary wrap and PCM remapping for wrapped takes). Replaces the former headless `RecordingTransportController`. Mounted inside `TimelineEditor`'s `AudioEngineProvider`/jotai `Provider` (`app/src/components/features/RecordingController.tsx`). |
| **RecordingSettings** | The feature popover beside the **TimelineToolbar** record button for **Recording settings**. Renders input/output device selects wired to `useAudioDevices`; disabled while a take is in progress (`app/src/components/features/RecordingSettings.tsx`). |
| **ProjectView** | The view for a single project at `/projects/:projectId`. Fetches the project (via the `project` query) and shows its name (an editable `ProjectTitleField`) and owner at the top, with a `TrackPane` and the `TimelineEditor` filling the rest of the screen side by side (`app/src/components/views/ProjectView.tsx`). Guarded by `RequireAuth`. |
| **ProjectsTable** | A feature that lists a user's non-archived projects in a table, each row linking into the project; used by `UserHomeView` (`app/src/components/features/ProjectsTable.tsx`). |
| **RegisterView** | The registration view at `/register`; a username/email/password form that creates an account, then sends the user to `LoginView` (`app/src/components/views/RegisterView.tsx`). |
| **RequireAuth** | Client route guard that renders its children only for a signed-in user (via the `me` query) and otherwise redirects to `LoginView` (`app/src/auth/RequireAuth.tsx`). Wraps `UserHomeView` and `ProjectView`. |
| **Swimlane** | The pure composite for a single track's horizontal lane on the `Timeline`. Spans the full timeline viewport width and is sized (`h-14`) and stacked to align with the track's `TrackInfo` row in the `TrackPane`. Establishes a sample → pixel coordinate system for its children: from its measured width and the `viewportStart`/`viewportEnd` props it derives `SwimlaneCoords` (exposed via the `useSwimlaneCoords` context) so content — placed with the `SwimlaneItem` helper — stays pinned to its sample position as the **Timeline viewport** pans/zooms. Carries a faint background so empty lanes are visible. All state arrives via props (`app/src/components/composites/swimlane.tsx`). |
| **TimelineClip** | The feature that draws a placed (persisted) `ProjectClip` on its track's `Swimlane`: it positions a `SwimlaneItem` from the clip's sample `start`/`duration` and renders a `standard`-variant **Clip (component)** labelled with the source audio's filename (or a generic fallback for recordings, which have none). Clicking it updates the **Selected clips** (`useSelectedClips`) — plain click selects just this clip, ⌘/Ctrl-click toggles it within a multi-clip selection. Dragging it drives the **Clip drag**: past a small threshold it moves the clip via `useTimelineDrag`, publishing the live preview to `useSetClipDrag` (dimming the source) and, on release, committing the new `start`/`track` through `updateClip` (kept up until the server confirms so the clip doesn't flash back); a trailing click after a real drag is swallowed so it doesn't toggle selection. Rendered per track by `TrackLanes`; pairs with `RecordingClip`, which shows the live take before it becomes one of these (`app/src/components/features/TimelineClip.tsx`). |
| **Timeline** | The pure composite for the project's horizontal editing timeline surface. Renders a `TimelineRuler` background and `TimelinePlayhead` scrubbers (including the live `playbackPosition` playhead) underneath/over its track/region children and converts pointer-drag (pan) and ctrl/⌘ + wheel (zoom) gestures into `onPan`/`onZoom` sample-delta callbacks. Receives the visible range, **Playback range**, and live playback position via props. Exposes its sample ↔ pixel mapping to its subtree as `TimelineCoords` (via `useTimelineCoords`) and accepts a `headerOverlay` for interactive header-band content such as the `PlaybackScrubbers` handles (`app/src/components/composites/timeline.tsx`). |
| **TimelineCoords** | The sample ↔ pixel coordinate system the `Timeline` composite exposes to its subtree via the `useTimelineCoords` context. Mirrors the per-lane `SwimlaneCoords` but spans the whole surface: `sampleToX`/`xToSample`/`samplesToWidth` plus `clientXToSample` (maps an absolute pointer `clientX` to a sample using the live container rect). Lets header-band overlays and drag handles position by sample and translate pointer gestures (`app/src/components/composites/timeline.tsx`). |
| **TimelineEditor** | The feature that connects the jotai **Timeline viewport** and **Playback range** state to the pure `Timeline` composite: it reads the visible sample range via `useTimelineViewport` and the play range via `useTimelinePlayback`, forwards pan/zoom gestures back into the atoms, feeds the `AudioEngine`'s live `timecode` down as the playhead while playing, and mounts the `PlaybackScrubbers` drag handles in the timeline's `headerOverlay`. Owns the editor's jotai `Provider` and `AudioEngineProvider` and stacks the `TimelineToolbar` above the timeline surface. Mounted in `ProjectView` (`app/src/components/features/TimelineEditor.tsx`). |
| **TimelinePlayhead** | A canvas primitive that draws the **Playback range** scrubbers over the timeline: a small caret leaning right at `playStart`, a caret leaning left at `playEnd` when it is non-null, and — while playing — a solid full-height `playbackPosition` playhead line tracking the live audio-engine position. Each caret sits at the top of the header band joined to a thin guide line spanning the full timeline height (header included), so the marker and its line read as one continuous scrubber. Pure; takes `viewportStart`/`viewportEnd`/`headerHeight`/`playStart`/`playEnd`/`playbackPosition` props and resolves theme colors (`--primary`, `--secondary-foreground`, `--destructive`) from its own computed style (`app/src/components/primitives/timeline-playhead.tsx`). |
| **TimelineToolbar** | The feature toolbar above the timeline surface holding playback/timeline controls: a **loop** toggle (flips `loop` in the **Playback range**), a **play/stop** button that drives the editor's `AudioEngine` and reflects its playing state, a **record** button that hands off to the `RecordingController` (`beginRecording`) — disabled until a track is selected, reflecting blocked **Microphone access**, and surfacing any capture error beside the toolbar — and a **Recording settings** button (`RecordingSettings`) beside the record control. Rendered by `TimelineEditor` inside the jotai `Provider`/`AudioEngineProvider`/`RecordingController` (`app/src/components/features/TimelineToolbar.tsx`). |
| **useTimelineDrag** | The standardized primitive hook for dragging something horizontally along the timeline (`app/src/components/primitives/use-timeline-drag.ts`). It owns the pointer plumbing every timeline drag shares — primary-button only, pointer capture, stopping propagation so the `Timeline` doesn't also pan, and converting `clientX` → sample on each move — and reports the resulting sample (raw and snapped) through `onDragStart`/`onDrag`/`onDragEnd`, returning `dragHandlers` to spread onto the element plus a `dragging` flag. The coordinate mapping (typically `TimelineCoords.clientXToSample`) and an optional `snap` transform (the extension point for future grid/clip snapping) arrive as options, as does an optional `preventDefault` flag (default `true`; set `false` so a draggable can keep its native `click`, as the **Clip drag** does for selection); callers decide what the sample means. Used by `PlaybackScrubbers` and the **Clip drag** (`TimelineClip`). |
| **TimelineRuler** | A canvas primitive that draws the timeline's background markers — per-second ticks plus periodic timestamp labels — for the visible sample range. Pure; takes `viewportStart`/`viewportEnd`/`sampleRate` props and assumes 44.1 kHz by default (`app/src/components/primitives/timeline-ruler.tsx`). |
| **TrackInfo** | The pure composite for a single row in the timeline's `TrackPane`, summarizing one `ProjectTrack` (its name) and exposing a delete control (a trash button shown when an `onDelete` callback is provided). When given an `onSelect` callback it becomes selectable via the shared **Selectable surface** pattern (filling with its full primary scheme when `selected`, no ring). Receives all state via props (`app/src/components/composites/track-info.tsx`). |
| **TrackLanes** | The feature that renders the project's track `Swimlane`s as the `Timeline`'s children: it reads the tracks **and clips** from the cached `project` query and the visible sample range via `useTimelineViewport`, then stacks one lane per track (spacing mirrored from the `TrackPane`) so each lane lines up with its `TrackInfo` row. Each lane renders its track's placed clips (`TimelineClip`, filtered by `clip.track`) plus a `RecordingClip` so the live take appears on the track that is recording. Each lane is wrapped in a `data-track-id` element so a **Clip drag** can hit-test which track the pointer is over, and a floating `ClipDragPreview` overlay sits above the (otherwise `overflow-hidden`) lanes to draw the dragged clip following the cursor across tracks. Mounted by `TimelineEditor` inside the jotai `Provider` (`app/src/components/features/TrackLanes.tsx`). |
| **TrackPane** | The feature pane to the left of the `TimelineEditor` in `ProjectView` that lists the project's tracks as `TrackInfo` composites (read from the cached `project` query). An "Add track" button below the list creates a new track (`createTrack`), and each `TrackInfo`'s delete control removes its track (`deleteTrack`); both return the updated `ProjectData`, which Apollo merges into the cache so the list and timeline lanes refresh automatically (`app/src/components/features/TrackPane.tsx`). |
| **TransportHotkeys** | A headless feature that registers the editor's transport-related **Hotkey**s: Space toggles play/stop on the `AudioEngine` (a stop while recording ends the take), R arms **Recording** on the **Selected track** via the `RecordingController` (`beginRecording`, gated to when a track is selected and no take is running), and L toggles looping (`toggleLoop` in the **Playback range**). Must be mounted inside a `HotkeyProvider`, the editor's jotai `Provider`, `AudioEngineProvider`, and `RecordingController`; rendered by `TimelineEditor` (`app/src/components/features/TransportHotkeys.tsx`). |
| **UserHomeView** | The signed-in user's home view at `/home`. Its header links back to `LandingView` (`/`) and offers a log-out action (via the `useLogout` hook). Below it shows a projects toolbar (currently a `CreateProjectButton`) above a `ProjectsTable` of the projects the user owns and collaborates on (`app/src/components/views/UserHomeView.tsx`). Guarded by `RequireAuth`. |
| **View** | A top-level, route-level screen component on the client. The top tier of the [UI component architecture](../.cursor/rules/ui-architecture.mdc); views live in `app/src/components/views/` and are suffixed `View`. |
| **Waveform** | The pure primitive that renders pre-decoded `peaks` to a canvas via `wavesurfer.js` — visual only, with no audio loaded (no fetch, decode, or playback). Drawn as a continuous waveform (no `barWidth`) so it stays crisp and cheap at any zoom, normalized to fill its container, and pointer-inert so it never steals gestures from the surface it backs. Takes `peaks`/`duration`/`waveColor` (a concrete colour — canvas can't paint `var(...)`) via props; peaks update through `wavesurfer`'s `load("", …)` path and colour through `setOptions`. Used by the **Clip waveform** (`app/src/components/primitives/waveform.tsx`). |

## Infrastructure & Local Development

| Term | Definition |
| --- | --- |
| **Audio storage** | The pluggable backend holding raw clip audio, abstracted behind the `AudioStorage` interface (`server/src/lib/audioStorage.ts`) and tracked as `ProjectAudio` records via the **Audio upload flow**. Two drivers, selected by `AUDIO_STORAGE_DRIVER`: `local` (`LocalAudioStorage`, default — writes files under `AUDIO_LOCAL_DIR` and serves them from the server's `GET /audio/blob/...` route, for development) and `vercel` (`VercelBlobAudioStorage` — Vercel Blob via `@vercel/blob`, needs `BLOB_READ_WRITE_TOKEN`). Tests inject an in-memory fake. The binary transfer routes live in `server/src/routes/audioRoutes.ts`. |
| **Docker dev environment** | The full local stack (MongoDB, API, Vite) started with `docker compose watch`. Defined in `docker-compose.yml` + `Dockerfile`; keeps containers in sync with the working tree for live reload. The `app` container also runs `codegen --watch` in the background, so edits to `server/schema.graphql` or to `graphql(...)` operations regenerate the typed documents (`src/generated/`) live — no restart needed. |
| **E2E integration tests** | Playwright specs in `app/e2e/` that run against the real Express + Apollo stack (`server/test-e2e/server.ts`), not mocks. Playwright's `webServer` builds the client and boots the API with `SERVE_CLIENT=true` on a single origin (`http://127.0.0.1:4001` — IPv4 loopback, not `localhost`, to avoid macOS resolving `localhost` to `::1` while the server listens on IPv4 only) backed by an ephemeral in-memory MongoDB (`mongodb-memory-server`). Each test starts from a blank database via `POST /__e2e__/reset` (mounted only when `E2E=1`; see `server/src/routes/e2eRoutes.ts` and `app/e2e/fixtures.ts`). Tests are written against **E2E Page Objects** and run with `npm run test:e2e -w @vamp/app`. |
| **E2E Page Object** | A Page Object Model (POM) wrapping one client route for Playwright tests, under `app/e2e/pages/` (one per route: `LandingPage` `/`, `RegisterPage` `/register`, `LoginPage` `/login`, `LogoutPage` `/logout`, `UserHomePage` `/home`, `ProjectPage` `/projects/:projectId`). Each extends `BasePage` (holds `page` + `path`, provides `goto()`) and exposes route locators (resolved from the **Test id registry**) and high-level actions. Reusable sub-widgets live in `app/e2e/components/` (e.g. `AuthForm`, shared by the register/login views). POMs are injected into specs as Playwright fixtures from `app/e2e/fixtures.ts`. |
| **Test id registry** | The single source of truth for client `data-testid` values, `testIds` in `app/src/testIds.ts`. Constants are grouped by the React component that renders the element, so a value's path names both the component and the element (e.g. `testIds.LoginView.submit`). Consumed both by the components (rendering the attribute) and by the Playwright **E2E Page Objects** and jest tests (locating it), so ids never drift between render and test sites. |

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
