import type { Response } from "express";
import { SessionModel } from "../src/entities/Session";
import { UserModel } from "../src/entities/User";
import { verifyPassword } from "../src/lib/password";
import { hashSessionToken } from "../src/lib/sessionToken";
import { execute, startTestStack, stopTestStack, type TestStack } from "./testServer";

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      _id
      username
      email
      createdAt
    }
  }
`;

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      _id
      email
    }
  }
`;

const LOGOUT = /* GraphQL */ `
  mutation Logout {
    logout
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      _id
      email
    }
  }
`;

const LIST_USERS = /* GraphQL */ `
  query Users {
    users {
      _id
      username
      email
    }
  }
`;

let stack: TestStack;

beforeAll(async () => {
  stack = await startTestStack();
});

afterAll(async () => {
  await stopTestStack(stack);
});

afterEach(async () => {
  await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})]);
});

/** A minimal Express `Response` stand-in that records cookie operations. */
function mockResponse(): {
  res: Response;
  cookies: Record<string, { value: string }>;
} {
  const cookies: Record<string, { value: string }> = {};
  const res = {
    cookie(name: string, value: string) {
      cookies[name] = { value };
      return res;
    },
    clearCookie(name: string) {
      delete cookies[name];
      return res;
    },
  } as unknown as Response;
  return { res, cookies };
}

describe("Auth API (register / login / logout / me)", () => {
  it("registers a user, hashes the password, and never exposes it", async () => {
    const registered = await execute<{
      register: { _id: string; username: string; email: string };
    }>(stack.apollo, REGISTER, {
      input: { username: "ada", email: "ADA@example.com", password: "correct horse battery" },
    });

    expect(registered.errors).toBeUndefined();
    expect(registered.data?.register).toMatchObject({
      username: "ada",
      email: "ada@example.com",
    });
    expect(JSON.stringify(registered.data)).not.toContain("correct horse battery");

    const stored = await UserModel.findOne({ email: "ada@example.com" }).lean();
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toContain("correct horse battery");
    await expect(
      verifyPassword("correct horse battery", stored!.passwordHash),
    ).resolves.toBe(true);
  });

  it("rejects a too-short password via class-validator", async () => {
    const result = await execute(stack.apollo, REGISTER, {
      input: { username: "bob", email: "bob@example.com", password: "short" },
    });
    expect(result.errors?.[0]?.message).toMatch(/argument validation error/i);
    await expect(UserModel.countDocuments()).resolves.toBe(0);
  });

  it("rejects a duplicate email", async () => {
    const input = { username: "ada", email: "ada@example.com", password: "a-good-password" };
    await execute(stack.apollo, REGISTER, { input });
    const dup = await execute(stack.apollo, REGISTER, {
      input: { ...input, username: "ada2" },
    });
    expect(dup.errors?.[0]?.message).toMatch(/already exists/i);
    await expect(UserModel.countDocuments()).resolves.toBe(1);
  });

  it("logs in with valid credentials, setting a session cookie", async () => {
    await execute(stack.apollo, REGISTER, {
      input: { username: "ada", email: "ada@example.com", password: "a-good-password" },
    });

    const { res, cookies } = mockResponse();
    const result = await execute<{ login: { _id: string; email: string } }>(
      stack.apollo,
      LOGIN,
      { input: { email: "ada@example.com", password: "a-good-password" } },
      { res },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.login.email).toBe("ada@example.com");

    const token = cookies["vamp_session"]?.value;
    expect(token).toBeTruthy();

    // The cookie holds the raw token; the DB stores only its hash.
    const session = await SessionModel.findOne({
      tokenHash: hashSessionToken(token!),
    }).lean();
    expect(session).toBeTruthy();
    await expect(SessionModel.countDocuments()).resolves.toBe(1);
  });

  it("rejects a wrong password with a generic error and no session", async () => {
    await execute(stack.apollo, REGISTER, {
      input: { username: "ada", email: "ada@example.com", password: "a-good-password" },
    });

    const { res } = mockResponse();
    const result = await execute(
      stack.apollo,
      LOGIN,
      { input: { email: "ada@example.com", password: "wrong-password" } },
      { res },
    );
    expect(result.errors?.[0]?.message).toMatch(/invalid email or password/i);
    await expect(SessionModel.countDocuments()).resolves.toBe(0);
  });

  it("does not reveal whether an email exists on failed login", async () => {
    const { res } = mockResponse();
    const result = await execute(
      stack.apollo,
      LOGIN,
      { input: { email: "nobody@example.com", password: "whatever-password" } },
      { res },
    );
    expect(result.errors?.[0]?.message).toMatch(/invalid email or password/i);
  });

  it("logs out by deleting the session", async () => {
    await execute(stack.apollo, REGISTER, {
      input: { username: "ada", email: "ada@example.com", password: "a-good-password" },
    });
    const { res, cookies } = mockResponse();
    await execute(
      stack.apollo,
      LOGIN,
      { input: { email: "ada@example.com", password: "a-good-password" } },
      { res },
    );
    const token = cookies["vamp_session"]!.value;

    const result = await execute<{ logout: boolean }>(stack.apollo, LOGOUT, undefined, {
      res,
      sessionToken: token,
    });
    expect(result.data?.logout).toBe(true);
    await expect(SessionModel.countDocuments()).resolves.toBe(0);
  });

  it("returns the current user from `me` only when authenticated", async () => {
    const registered = await execute<{ register: { _id: string } }>(stack.apollo, REGISTER, {
      input: { username: "ada", email: "ada@example.com", password: "a-good-password" },
    });
    const user = await UserModel.findById(registered.data!.register._id).lean();

    const anonymous = await execute<{ me: { _id: string } | null }>(stack.apollo, ME);
    expect(anonymous.data?.me).toBeNull();

    const authed = await execute<{ me: { _id: string; email: string } | null }>(
      stack.apollo,
      ME,
      undefined,
      { currentUser: user as never },
    );
    expect(authed.data?.me?.email).toBe("ada@example.com");
  });

  it("lists registered users", async () => {
    await execute(stack.apollo, REGISTER, {
      input: { username: "grace", email: "grace@example.com", password: "a-good-password" },
    });
    await execute(stack.apollo, REGISTER, {
      input: { username: "alan", email: "alan@example.com", password: "a-good-password" },
    });

    const listed = await execute<{ users: { email: string }[] }>(stack.apollo, LIST_USERS);
    expect(listed.errors).toBeUndefined();
    expect(listed.data?.users.map((u) => u.email).sort()).toEqual([
      "alan@example.com",
      "grace@example.com",
    ]);
  });
});
