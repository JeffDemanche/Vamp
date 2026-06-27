import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginMutation } from "@/auth/queries";
import { LoginView } from "./LoginView";

type Mocks = ComponentProps<typeof MockedProvider>["mocks"];

const input = { email: "ada@example.com", password: "a-good-password" };

function renderLogin(mocks: Mocks) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/home" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: input.email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: input.password },
  });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
}

describe("LoginView", () => {
  it("logs in and navigates home on success", async () => {
    renderLogin([
      {
        request: { query: LoginMutation, variables: { input } },
        result: {
          data: {
            login: {
              __typename: "User",
              _id: "1",
              username: "ada",
              email: "ada@example.com",
            },
          },
        },
      },
    ]);

    fillAndSubmit();

    expect(await screen.findByText("home page")).toBeInTheDocument();
  });

  it("shows an error and stays put on invalid credentials", async () => {
    renderLogin([
      {
        request: { query: LoginMutation, variables: { input } },
        result: { errors: [{ message: "Invalid email or password." }] },
      },
    ]);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid email or password/i,
    );
    expect(screen.queryByText("home page")).not.toBeInTheDocument();
  });
});
