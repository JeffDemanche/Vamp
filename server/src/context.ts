import type { Response } from "express";
import type { Services } from "./container";
import type { User } from "./entities/User";

/**
 * Per-request GraphQL context. Resolvers receive it via `@Ctx()` and use
 * `services` to reach the business-logic layer.
 *
 * Auth fields are populated by the context factory in `server.ts` from the
 * session cookie. They are optional because tests drive resolvers via
 * `apollo.executeOperation` without a real Express request/response.
 */
export interface ServerContext {
  requestId?: string;
  services: Services;
  /** The Express response, used to set/clear the session cookie. */
  res?: Response;
  /** The authenticated user for this request, if any. */
  currentUser?: User | null;
  /** The raw session token from the request cookie, if present. */
  sessionToken?: string | null;
}
