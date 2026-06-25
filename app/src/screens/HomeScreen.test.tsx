import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen } from "@testing-library/react";
import { HomeScreen, UsersQuery } from "./HomeScreen";

const mocks = [
  {
    request: { query: UsersQuery },
    result: {
      data: {
        users: [
          {
            __typename: "User",
            _id: "1",
            name: "Ada Lovelace",
            email: "ada@example.com",
          },
          {
            __typename: "User",
            _id: "2",
            name: "Grace Hopper",
            email: "grace@example.com",
          },
        ],
      },
    },
  },
];

describe("HomeScreen", () => {
  it("renders the app shell and a loading state initially", () => {
    render(
      <MockedProvider mocks={mocks}>
        <HomeScreen />
      </MockedProvider>,
    );

    expect(screen.getByText("Vamp")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading users")).toBeInTheDocument();
  });

  it("renders users returned by the GraphQL query", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <HomeScreen />
      </MockedProvider>,
    );

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
  });
});
