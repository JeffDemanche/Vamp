import type { Services } from "./container";

/**
 * Per-request GraphQL context. Resolvers receive it via `@Ctx()` and use
 * `services` to reach the business-logic layer. Extend with auth/user/loaders
 * as the API grows.
 */
export interface ServerContext {
  requestId?: string;
  services: Services;
}
