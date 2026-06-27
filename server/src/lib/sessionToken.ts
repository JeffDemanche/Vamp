import { createHash, randomBytes } from "crypto";

/**
 * Session tokens are opaque, high-entropy strings handed to the client in an
 * HttpOnly cookie. Only the SHA-256 hash is persisted, so a database leak does
 * not expose usable tokens (the raw token is never stored or logged).
 */
const TOKEN_BYTES = 32; // 256 bits of entropy

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
