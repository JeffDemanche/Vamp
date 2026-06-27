import { getModelForClass, index, prop, type Ref } from "@typegoose/typegoose";
import { User } from "./User";

/**
 * A server-side login session for a {@link User}. Created on login and deleted
 * on logout. Unlike other entities, `Session` is deliberately NOT a
 * type-graphql `ObjectType`: sessions are authentication infrastructure and
 * must never be queryable through the API. Only the SHA-256 hash of the
 * session token is stored (`lib/sessionToken.ts`), so the database never holds
 * a usable credential.
 *
 * A TTL index on `expiresAt` lets MongoDB reap expired sessions automatically.
 */
@index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export class Session {
  readonly _id!: string;

  @prop({ ref: () => User, required: true })
  user!: Ref<User>;

  @prop({ required: true, unique: true })
  tokenHash!: string;

  @prop({ required: true })
  expiresAt!: Date;

  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const SessionModel = getModelForClass(Session);
