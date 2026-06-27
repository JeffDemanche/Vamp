import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { MeQuery } from "@/auth/queries";
import { ProjectsByUserQuery } from "@/projects/queries";
import { UserHomeView } from "./UserHomeView";

type Mocks = ComponentProps<typeof MockedProvider>["mocks"];

const meMock = {
  request: { query: MeQuery },
  result: {
    data: {
      me: { __typename: "User", _id: "u1", username: "ada", email: "ada@example.com" },
    },
  },
};

function renderHome(mocks: Mocks) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <UserHomeView />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe("UserHomeView", () => {
  it("renders the projects toolbar with a create button and lists projects", async () => {
    renderHome([
      meMock,
      {
        request: { query: ProjectsByUserQuery, variables: { userId: "u1" } },
        result: {
          data: {
            projectsByUser: [
              {
                __typename: "Project",
                _id: "p1",
                title: "Crimson Echo",
                archived: false,
                createdAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          },
        },
      },
    ]);

    expect(
      await screen.findByRole("button", { name: /new project/i }),
    ).toBeInTheDocument();

    const projectLink = await screen.findByRole("link", { name: "Crimson Echo" });
    expect(projectLink).toHaveAttribute("href", "/projects/p1");
  });

  it("shows an empty state when the user has no projects", async () => {
    renderHome([
      meMock,
      {
        request: { query: ProjectsByUserQuery, variables: { userId: "u1" } },
        result: { data: { projectsByUser: [] } },
      },
    ]);

    expect(await screen.findByTestId("projects-empty")).toBeInTheDocument();
  });
});
