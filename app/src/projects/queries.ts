import { graphql } from "../generated";

/**
 * The projects a user owns or collaborates on, excluding archived ones. Used
 * by `UserHomeView` to populate the projects table.
 */
export const ProjectsByUserQuery = graphql(`
  query ProjectsByUser($userId: ID!) {
    projectsByUser(userId: $userId) {
      _id
      title
      archived
      createdAt
    }
  }
`);

/** Creates a new empty project with an auto-generated poetic title. */
export const CreateEmptyProjectMutation = graphql(`
  mutation CreateEmptyProject($ownerId: ID!) {
    createEmptyProject(ownerId: $ownerId) {
      _id
      title
      archived
      createdAt
    }
  }
`);

/**
 * A single project with the metadata the `ProjectView` header needs (title and
 * owner) plus the project's tracks for the editor's track pane. Also fetches the
 * signed-in user's `ProjectUser` (their saved editor view state) so the timeline
 * can initialize its jotai state from it. Used to populate the project editor
 * screen.
 */
export const ProjectQuery = graphql(`
  query Project($id: ID!) {
    project(id: $id) {
      _id
      title
      owner {
        _id
        user {
          _id
          username
        }
      }
      projectData {
        _id
        tracks {
          _id
          name
        }
      }
    }
    projectUser(projectId: $id) {
      _id
      playStart
      playEnd
      loop
      viewportStart
      viewportEnd
      selectedTrack
      recording {
        track
        startSample
        startedAt
      }
    }
  }
`);

/**
 * Adds a track to a project's timeline. Returns the project's updated
 * `ProjectData` (with its full track list) so Apollo merges the new track into
 * the cached `Project` query and the track pane/lanes refresh automatically.
 */
export const CreateTrackMutation = graphql(`
  mutation CreateTrack($input: CreateTrackInput!) {
    createTrack(input: $input) {
      _id
      tracks {
        _id
        name
      }
    }
  }
`);

/**
 * Removes a track (and any clips on it) from a project's timeline. Returns the
 * updated `ProjectData` so the cached track list refreshes automatically.
 */
export const DeleteTrackMutation = graphql(`
  mutation DeleteTrack($input: DeleteTrackInput!) {
    deleteTrack(input: $input) {
      _id
      tracks {
        _id
        name
      }
    }
  }
`);

/** Updates metadata stored directly on a project, currently its title. */
export const UpdateProjectMetadataMutation = graphql(`
  mutation UpdateProjectMetadata($input: UpdateProjectMetadataInput!) {
    updateProjectMetadata(input: $input) {
      _id
      title
    }
  }
`);

/**
 * Persists (a subset of) the signed-in user's editor view state for a project —
 * the timeline viewport, playback range, loop flag, selected track, and active
 * recording. Used by `ProjectUserSync` to save local timeline state as it changes.
 */
export const UpdateProjectUserStateMutation = graphql(`
  mutation UpdateProjectUserState($input: UpdateProjectUserStateInput!) {
    updateProjectUserState(input: $input) {
      _id
      playStart
      playEnd
      loop
      viewportStart
      viewportEnd
      selectedTrack
      recording {
        track
        startSample
        startedAt
      }
    }
  }
`);

/**
 * Step 1 of adding a clip: register the audio asset and get back a presigned S3
 * URL to upload the raw bytes to. The returned `ProjectAudio` is `PENDING` until
 * `createClip` confirms the upload. Used by `uploadAudioAndCreateClip`.
 */
export const CreateAudioUploadMutation = graphql(`
  mutation CreateAudioUpload($input: CreateAudioUploadInput!) {
    createAudioUpload(input: $input) {
      uploadUrl
      audio {
        _id
        bucket
        key
        contentType
        uploadStatus
      }
    }
  }
`);

/**
 * Step 3 of adding a clip: link the (now-uploaded) audio to a position on the
 * project timeline. The server confirms the upload landed in S3 and flips the
 * audio to `READY` as part of this call. Used by `uploadAudioAndCreateClip`.
 */
export const CreateClipMutation = graphql(`
  mutation CreateClip($input: CreateClipInput!) {
    createClip(input: $input) {
      _id
      start
      duration
      audioOffset
      track
      audio {
        _id
        uploadStatus
        downloadUrl
      }
    }
  }
`);
