import type { ApolloClient } from "@apollo/client";
import {
  CreateAudioUploadMutation,
  CreateClipMutation,
  ProjectQuery,
} from "./queries";

/** Where on the timeline (and into the audio) a new clip should land. */
export interface NewClipPlacement {
  projectId: string;
  /** `_id` of the `ProjectTrack` the clip belongs to. */
  trackId: string;
  /** Timeline start position, in samples. */
  start: number;
  /** Clip length, in samples. */
  duration: number;
  /** Offset into the underlying audio to begin at, in samples. Defaults to 0. */
  audioOffset?: number;
}

/**
 * End-to-end "add a clip from a local audio file" flow, mirroring the server's
 * presigned-upload architecture:
 *
 *   1. `createAudioUpload` registers a `ProjectAudio` and returns a presigned
 *      S3 URL (the audio is `PENDING`).
 *   2. The bytes are `PUT` straight to S3 — they never touch the GraphQL API.
 *   3. `createClip` links the audio to the timeline; the server confirms the
 *      upload landed and flips the audio to `READY`.
 *
 * Returns the created clip (with its hydrated audio).
 */
export async function uploadAudioAndCreateClip(
  client: ApolloClient,
  file: File | Blob,
  placement: NewClipPlacement,
) {
  const contentType = file.type || "application/octet-stream";
  const filename = file instanceof File ? file.name : undefined;

  const uploadResult = await client.mutate({
    mutation: CreateAudioUploadMutation,
    variables: {
      input: { projectId: placement.projectId, contentType, filename },
    },
  });

  const upload = uploadResult.data?.createAudioUpload;
  if (!upload) throw new Error("Failed to create audio upload");

  const putResponse = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error(`Audio upload to S3 failed (${putResponse.status})`);
  }

  const clipResult = await client.mutate({
    mutation: CreateClipMutation,
    variables: {
      input: {
        projectId: placement.projectId,
        trackId: placement.trackId,
        audioId: upload.audio._id,
        start: placement.start,
        duration: placement.duration,
        audioOffset: placement.audioOffset ?? 0,
      },
    },
    // Append the new clip into the cached `ProjectQuery` so the timeline lanes
    // render it immediately, without refetching the whole project.
    update: (cache, { data }) => {
      const created = data?.createClip;
      if (!created) return;
      cache.updateQuery(
        { query: ProjectQuery, variables: { id: placement.projectId } },
        (existing) => {
          if (!existing?.project) return existing;
          const clips = existing.project.projectData.clips;
          if (clips.some((existingClip) => existingClip._id === created._id)) {
            return existing;
          }
          return {
            ...existing,
            project: {
              ...existing.project,
              projectData: {
                ...existing.project.projectData,
                clips: [...clips, created],
              },
            },
          };
        },
      );
    },
  });

  const clip = clipResult.data?.createClip;
  if (!clip) throw new Error("Failed to create clip");
  return clip;
}
