import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { MeQuery } from "@/auth/queries";
import { LandingView, UsersQuery } from "./LandingView";

type Mocks = ComponentProps<typeof MockedProvider>["mocks"];

const usersMock = {
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
};

const signedOutMock = {
  request: { query: MeQuery },
  result: { data: { me: null } },
};

const signedInMock = {
  request: { query: MeQuery },
  result: {
    data: {
      me: {
        __typename: "User",
        _id: "1",
        username: "ada",
        email: "ada@example.com",
      },
    },
  },
};

function renderLanding(mocks: Mocks = [usersMock, signedOutMock]) {
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

  it("links to the login and register views when signed out", () => {
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

  it("shows home and logout links when a session is active", async () => {
    renderLanding([usersMock, signedInMock]);

    expect(
      await screen.findByRole("link", { name: /go to your vamps/i }),
    ).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: /log out/i })).toHaveAttribute(
      "href",
      "/logout",
    );
    expect(
      screen.queryByRole("link", { name: /log in/i }),
    ).not.toBeInTheDocument();
  });
});
