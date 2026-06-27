import { Session, SessionModel } from "../entities/Session";

export interface CreateSessionData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Data-access layer for {@link Session}. The only place that touches
 * `SessionModel`; the {@link AuthService} depends on this instead.
 */
export class SessionRepository {
  async create(data: CreateSessionData): Promise<Session> {
    const doc = await SessionModel.create({
      user: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    });
    return doc.toObject<Session>();
  }

  findByTokenHash(tokenHash: string): Promise<Session | null> {
    return SessionModel.findOne({ tokenHash }).lean<Session>().exec();
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await SessionModel.deleteOne({ tokenHash }).exec();
  }

  async deleteByUser(userId: string): Promise<void> {
    await SessionModel.deleteMany({ user: userId }).exec();
  }
}
