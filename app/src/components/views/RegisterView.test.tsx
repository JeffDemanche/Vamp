import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RegisterMutation } from "@/auth/queries";
import { LoginView } from "./LoginView";
import { RegisterView } from "./RegisterView";

type Mocks = ComponentProps<typeof MockedProvider>["mocks"];

const input = {
  username: "ada",
  email: "ada@example.com",
  password: "a-good-password",
};

function renderRegister(mocks: Mocks) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterView />} />
          <Route path="/login" element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe("RegisterView", () => {
  it("registers then redirects to login with a confirmation notice", async () => {
    renderRegister([
      {
        request: { query: RegisterMutation, variables: { input } },
        result: {
          data: {
            register: {
              __typename: "User",
              _id: "1",
              username: "ada",
              email: "ada@example.com",
            },
          },
        },
      },
    ]);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: input.username },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: input.email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: input.password },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByTestId("registered-notice")).toBeInTheDocument();
  });

  it("surfaces a server error (e.g. duplicate email)", async () => {
    renderRegister([
      {
        request: { query: RegisterMutation, variables: { input } },
        result: {
          errors: [{ message: "An account with this email already exists." }],
        },
      },
    ]);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: input.username },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: input.email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: input.password },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already exists/i,
    );
  });
});
