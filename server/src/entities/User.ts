import { getModelForClass, prop } from "@typegoose/typegoose";
import { Field, ID, ObjectType } from "type-graphql";

/**
 * A single class that is simultaneously:
 *  - a Typegoose model (via the `@prop` decorators), and
 *  - a type-graphql `ObjectType` (via the `@Field` decorators).
 *
 * This keeps the database schema and the GraphQL schema in lockstep.
 */
@ObjectType()
export class User {
  @Field(() => ID)
  readonly _id!: string;

  @Field()
  @prop({ required: true, unique: true, trim: true })
  username!: string;

  @Field()
  @prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  /**
   * Scrypt hash of the user's password (see `lib/password.ts`). Persisted via
   * `@prop` but intentionally has no `@Field` decorator, so it is never exposed
   * through the GraphQL API.
   */
  @prop({ required: true })
  passwordHash!: string;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const UserModel = getModelForClass(User);
