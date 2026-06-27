import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen } from "@testing-library/react";
import { LandingView, UsersQuery } from "./LandingView";

const mocks = [
  {
    request: { query: UsersQuery },
    result: {
      data: {
        users: [
          {
            __typename: "User",
            _id: "1",
            username: "ada",
            email: "ada@example.com",
          },
          {
            __typename: "User",
            _id: "2",
            username: "grace",
            email: "grace@example.com",
          },
        ],
      },
    },
  },
];

describe("LandingView", () => {
  it("renders the app shell and a loading state initially", () => {
    render(
      <MockedProvider mocks={mocks}>
        <LandingView />
      </MockedProvider>,
    );

    expect(screen.getByText("Vamp")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading users")).toBeInTheDocument();
  });

  it("renders users returned by the GraphQL query", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <LandingView />
      </MockedProvider>,
    );

    expect(await screen.findByText("ada")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
  });
});
