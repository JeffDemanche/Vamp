import { UserModel } from "../src/entities/User";
import { execute, startTestStack, stopTestStack, type TestStack } from "./testServer";

const CREATE_USER = /* GraphQL */ `
  mutation Create($input: CreateUserInput!) {
    createUser(input: $input) {
      _id
      name
      email
      createdAt
    }
  }
`;

const LIST_USERS = /* GraphQL */ `
  query Users {
    users {
      _id
      name
      email
    }
  }
`;

const GET_USER = /* GraphQL */ `
  query User($id: ID!) {
    user(id: $id) {
      _id
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
  await UserModel.deleteMany({});
});

describe("User API (full stack: Apollo -> type-graphql -> Typegoose -> in-memory Mongo)", () => {
  it("creates a user and reads it back", async () => {
    const created = await execute<{ createUser: { _id: string; name: string; email: string } }>(
      stack.apollo,
      CREATE_USER,
      { input: { name: "Ada Lovelace", email: "ADA@example.com" } },
    );

    expect(created.errors).toBeUndefined();
    expect(created.data?.createUser).toMatchObject({
      name: "Ada Lovelace",
      // schema lowercases + trims the email
      email: "ada@example.com",
    });

    const id = created.data!.createUser._id;
    expect(id).toBeTruthy();

    const fetched = await execute<{ user: { _id: string; email: string } | null }>(
      stack.apollo,
      GET_USER,
      { id },
    );
    expect(fetched.data?.user?.email).toBe("ada@example.com");
  });

  it("lists multiple users", async () => {
    await execute(stack.apollo, CREATE_USER, {
      input: { name: "Grace Hopper", email: "grace@example.com" },
    });
    await execute(stack.apollo, CREATE_USER, {
      input: { name: "Alan Turing", email: "alan@example.com" },
    });

    const listed = await execute<{ users: { email: string }[] }>(stack.apollo, LIST_USERS);
    expect(listed.errors).toBeUndefined();
    expect(listed.data?.users).toHaveLength(2);
    expect(listed.data?.users.map((u) => u.email).sort()).toEqual([
      "alan@example.com",
      "grace@example.com",
    ]);
  });

  it("rejects an invalid email via class-validator", async () => {
    const result = await execute(stack.apollo, CREATE_USER, {
      input: { name: "Bad Email", email: "not-an-email" },
    });
    expect(result.errors?.[0]?.message).toMatch(/argument validation error/i);
    await expect(UserModel.countDocuments()).resolves.toBe(0);
  });
});
