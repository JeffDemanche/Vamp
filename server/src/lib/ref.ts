import { Types } from "mongoose";

/**
 * Extract the string id from a Typegoose `Ref`, whether it is an unpopulated
 * `ObjectId`, an already-populated document, or a bare id string. Used wherever
 * the service/resolver layers need a stored relation's id without caring how it
 * happens to be hydrated.
 */
export function refToId(ref: unknown): string {
  if (ref instanceof Types.ObjectId) return ref.toHexString();
  if (ref && typeof ref === "object" && "_id" in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}
