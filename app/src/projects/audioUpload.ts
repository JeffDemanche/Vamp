import type { ApolloClient } from "@apollo/client";

import type { AudioEngine } from "@/audio/AudioEngine";
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
  /** How the clip schedules its underlying audio. Defaults to `FLAT`. */
  mode?: "FLAT" | "STACKED";
  /** Loop length (samples) for stacked recordings. Stored on the audio record. */
  loopLength?: number;
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
  options?: { engine?: AudioEngine },
) {
  const contentType = file.type || "application/octet-stream";
  const filename = file instanceof File ? file.name : undefined;

  const uploadResult = await client.mutate({
    mutation: CreateAudioUploadMutation,
    variables: {
      input: { projectId: placement.projectId, contentType, filename, loopLength: placement.loopLength },
    },
  });

  const upload = uploadResult.data?.createAudioUpload;
  if (!upload) throw new Error("Failed to create audio upload");

  const audioId = upload.audio._id;
  const bytesPromise = file.arrayBuffer();
  const preloadPromise =
    options?.engine && !options.engine.hasAudio(audioId)
      ? bytesPromise.then((data) => options.engine!.loadAudio(audioId, data))
      : undefined;

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
        mode: placement.mode,
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
          const audios = existing.project.projectData.audios;
          const createdAudio = created.audio;
          const nextAudios =
            createdAudio && !audios.some((audio) => audio._id === createdAudio._id)
              ? [...audios, createdAudio]
              : audios;
          return {
            ...existing,
            project: {
              ...existing.project,
              projectData: {
                ...existing.project.projectData,
                audios: nextAudios,
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

  if (preloadPromise) {
    try {
      await preloadPromise;
    } catch (err) {
      console.error("Failed to preload audio locally", audioId, err);
    }
  }

  return clip;
}
