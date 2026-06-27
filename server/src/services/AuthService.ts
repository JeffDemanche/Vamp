import { Types } from "mongoose";
import type { User } from "../entities/User";
import { hashPassword, verifyPassword } from "../lib/password";
import { generateSessionToken, hashSessionToken } from "../lib/sessionToken";
import type { SessionRepository } from "../repositories/SessionRepository";
import type { UserRepository } from "../repositories/UserRepository";

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface LoginResult {
  user: User;
  /** The raw session token — set as an HttpOnly cookie by the resolver layer. */
  token: string;
  expiresAt: Date;
}

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthServiceOptions {
  sessionTtlMs?: number;
}

function refToId(ref: unknown): string {
  if (ref instanceof Types.ObjectId) return ref.toHexString();
  if (ref && typeof ref === "object" && "_id" in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

/**
 * Authentication: registration (with password hashing), login (issuing a
 * server-side session), logout, and resolving a session token back to a user.
 * Keeps all credential handling in one place; resolvers stay thin and the HTTP
 * concerns (cookies) live in the resolver/server layer.
 */
export class AuthService {
  private readonly sessionTtlMs: number;
  /**
   * A throwaway hash compared against on failed logins so that requests for a
   * non-existent email take roughly the same time as a wrong password,
   * mitigating user enumeration via timing.
   */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    options: AuthServiceOptions = {},
  ) {
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  async register(data: RegisterData): Promise<User> {
    const email = data.email.trim().toLowerCase();
    const username = data.username.trim();

    if (await this.users.findByEmail(email)) {
      throw new Error("An account with this email already exists.");
    }
    if (await this.users.findByUsername(username)) {
      throw new Error("That username is already taken.");
    }

    const passwordHash = await hashPassword(data.password);
    return this.users.create({ username, email, passwordHash });
  }

  async login(data: LoginData): Promise<LoginResult> {
    const email = data.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    // Always run a verification, even when the user is missing, to keep the
    // timing (and error) identical and avoid leaking which emails exist.
    const passwordMatches = user
      ? await verifyPassword(data.password, user.passwordHash)
      : await verifyPassword(data.password, await this.getDummyHash());

    if (!user || !passwordMatches) {
      throw new Error("Invalid email or password.");
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    await this.sessions.create({
      userId: refToId(user._id),
      tokenHash: hashSessionToken(token),
      expiresAt,
    });

    return { user, token, expiresAt };
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (!token) return;
    await this.sessions.deleteByTokenHash(hashSessionToken(token));
  }

  /**
   * Resolve a raw session token to its user, or `null` if the token is unknown
   * or expired. Expired sessions are deleted opportunistically.
   */
  async authenticateBySessionToken(token: string): Promise<User | null> {
    const session = await this.sessions.findByTokenHash(hashSessionToken(token));
    if (!session) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessions.deleteByTokenHash(session.tokenHash);
      return null;
    }

    return this.users.findById(refToId(session.user));
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = hashPassword("invalid-password-placeholder");
    }
    return this.dummyHash;
  }
}
