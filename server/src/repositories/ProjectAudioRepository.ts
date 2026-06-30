import { AudioUploadStatus, ProjectAudio, ProjectAudioModel } from "../entities/ProjectAudio";

/** The fields needed to register a new (pending) {@link ProjectAudio}. */
export interface CreateProjectAudioData {
  /** Pre-generated id so the S3 key can embed it before the row is written. */
  _id: string;
  project: string;
  bucket: string;
  key: string;
  contentType: string;
  filename?: string;
  /** Loop length (samples) active when this take was recorded over a loop. */
  loopLength?: number;
  creator: string;
}

/** Object metadata captured from S3 when confirming an upload. */
export interface MarkReadyData {
  byteSize: number;
  contentType?: string;
}

/**
 * Data-access layer for {@link ProjectAudio}. The only place that touches the
 * Typegoose model directly.
 */
export class ProjectAudioRepository {
  findById(id: string): Promise<ProjectAudio | null> {
    return ProjectAudioModel.findById(id).lean<ProjectAudio>().exec();
  }

  findByKey(key: string): Promise<ProjectAudio | null> {
    return ProjectAudioModel.findOne({ key }).lean<ProjectAudio>().exec();
  }

  /** Every audio belonging to a project, oldest first. */
  findByProject(projectId: string): Promise<ProjectAudio[]> {
    return ProjectAudioModel.find({ project: projectId })
      .sort({ createdAt: 1 })
      .lean<ProjectAudio[]>()
      .exec();
  }

  async create(data: CreateProjectAudioData): Promise<ProjectAudio> {
    const doc = await ProjectAudioModel.create({
      _id: data._id,
      project: data.project,
      bucket: data.bucket,
      key: data.key,
      contentType: data.contentType,
      filename: data.filename,
      loopLength: data.loopLength,
      creator: data.creator,
      uploadStatus: AudioUploadStatus.PENDING,
    });
    return doc.toObject<ProjectAudio>();
  }

  /**
   * Flip an audio record to `Ready`, recording the confirmed object size (and
   * the content type S3 actually stored). Returns the updated document.
   */
  markReady(id: string, data: MarkReadyData): Promise<ProjectAudio | null> {
    const $set: Record<string, unknown> = {
      uploadStatus: AudioUploadStatus.READY,
      byteSize: data.byteSize,
    };
    if (data.contentType) $set.contentType = data.contentType;
    return ProjectAudioModel.findByIdAndUpdate(id, { $set }, { returnDocument: "after" })
      .lean<ProjectAudio>()
      .exec();
  }
}
