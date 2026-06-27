import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MeQuery } from "./queries";
import { RequireAuth } from "./RequireAuth";

type Mocks = ComponentProps<typeof MockedProvider>["mocks"];

function renderGuarded(mocks: Mocks) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route
            path="/home"
            element={
              <RequireAuth>
                <div>protected content</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe("RequireAuth", () => {
  it("renders children when a user is authenticated", async () => {
    renderGuarded([
      {
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
      },
    ]);

    expect(await screen.findByText("protected content")).toBeInTheDocument();
  });

  it("redirects to login when not authenticated", async () => {
    renderGuarded([
      {
        request: { query: MeQuery },
        result: { data: { me: null } },
      },
    ]);

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });
});
