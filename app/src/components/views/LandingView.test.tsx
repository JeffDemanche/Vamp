import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

function renderLanding() {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <LandingView />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe("LandingView", () => {
  it("renders the app shell and a loading state initially", () => {
    renderLanding();

    expect(screen.getByText("Vamp")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading users")).toBeInTheDocument();
  });

  it("renders users returned by the GraphQL query", async () => {
    renderLanding();

    expect(await screen.findByText("ada")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
  });

  it("links to the login and register views", () => {
    renderLanding();

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
