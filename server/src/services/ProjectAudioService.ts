import type { Readable } from "node:stream";
import { Types } from "mongoose";
import { AudioUploadStatus, type ProjectAudio } from "../entities/ProjectAudio";
import { buildAudioUploadUrl } from "../lib/audioPaths";
import type { AudioStorage } from "../lib/audioStorage";
import type { ProjectAudioRepository } from "../repositories/ProjectAudioRepository";

/** Everything needed to begin an audio upload for a project. */
export interface CreateAudioUploadInput {
  projectId: string;
  creatorId: string;
  contentType: string;
  filename?: string;
  /** Loop length (samples) active when this take was recorded over a loop. */
  loopLength?: number;
}

/**
 * The result of starting an upload: the freshly-created (pending)
 * {@link ProjectAudio} plus the URL the client `PUT`s the bytes to.
 */
export interface CreateAudioUploadResult {
  audio: ProjectAudio;
  uploadUrl: string;
}

/**
 * Business logic for {@link ProjectAudio} and the upload lifecycle. Orchestrates
 * the repository (records/tracking) and the {@link AudioStorage} seam (the
 * actual object store), never touching the Typegoose model or a storage SDK
 * directly. Uploads are server-proxied: the client `PUT`s bytes to the upload
 * URL minted here, the route forwards them through {@link storeBytes}, and
 * {@link confirmUploaded} flips the record to `READY`.
 */
export class ProjectAudioService {
  constructor(
    private readonly audios: ProjectAudioRepository,
    private readonly storage: AudioStorage,
    /** Base URL of this server, for building client upload/download URLs. */
    private readonly publicBaseUrl: string,
  ) {}

  findById(id: string): Promise<ProjectAudio | null> {
    return this.audios.findById(id);
  }

  findByKey(key: string): Promise<ProjectAudio | null> {
    return this.audios.findByKey(key);
  }

  /** Every {@link ProjectAudio} belonging to a project. */
  findByProject(projectId: string): Promise<ProjectAudio[]> {
    return this.audios.findByProject(projectId);
  }

  /**
   * Register a new pending audio asset and mint the URL the client uploads its
   * bytes to. The record is created `PENDING`; the client `PUT`s to the URL,
   * then {@link confirmUploaded} (e.g. as part of creating a clip) flips it to
   * `READY`.
   */
  async createUpload(input: CreateAudioUploadInput): Promise<CreateAudioUploadResult> {
    const id = new Types.ObjectId().toHexString();
    const key = `projects/${input.projectId}/audio/${id}`;

    const audio = await this.audios.create({
      _id: id,
      project: input.projectId,
      bucket: this.storage.bucket,
      key,
      contentType: input.contentType,
      filename: input.filename,
      loopLength: input.loopLength,
      creator: input.creatorId,
    });

    return { audio, uploadUrl: buildAudioUploadUrl(this.publicBaseUrl, id) };
  }

  /**
   * Forward uploaded bytes to the configured backend for an audio that is still
   * pending. Called by the server upload route; throws if the audio is unknown.
   */
  async storeBytes(audioId: string, body: Readable, contentType: string): Promise<void> {
    const audio = await this.audios.findById(audioId);
    if (!audio) throw new Error(`ProjectAudio not found: ${audioId}`);
    await this.storage.write(audio.key, body, contentType);
  }

  /**
   * Confirm an audio's bytes actually landed in the store and flip it to
   * `READY`, recording the stored object's size. Idempotent: already-`READY`
   * audio is returned untouched. Throws if the object is missing (upload never
   * finished).
   */
  async confirmUploaded(audioId: string): Promise<ProjectAudio> {
    const audio = await this.audios.findById(audioId);
    if (!audio) throw new Error(`ProjectAudio not found: ${audioId}`);
    if (audio.uploadStatus === AudioUploadStatus.READY) return audio;

    const info = await this.storage.head(audio.key);
    if (!info) {
      throw new Error(
        `Audio object not found in storage for ${audioId}; upload did not complete`,
      );
    }

    const updated = await this.audios.markReady(audioId, {
      byteSize: info.contentLength,
      contentType: info.contentType,
    });
    if (!updated) throw new Error(`ProjectAudio not found: ${audioId}`);
    return updated;
  }

  /**
   * A download URL for a `READY` audio, or `null` while it is still pending
   * (nothing to download yet).
   */
  createDownloadUrl(audio: ProjectAudio): Promise<string | null> {
    if (audio.uploadStatus !== AudioUploadStatus.READY) {
      return Promise.resolve(null);
    }
    return this.storage.createDownloadUrl(audio.key);
  }

  /** Store the decoded recording length in timeline samples. */
  async setDurationSamples(
    audioId: string,
    durationSamples: number,
  ): Promise<ProjectAudio> {
    const updated = await this.audios.setDurationSamples(audioId, durationSamples);
    if (!updated) throw new Error(`ProjectAudio not found: ${audioId}`);
    return updated;
  }
}
