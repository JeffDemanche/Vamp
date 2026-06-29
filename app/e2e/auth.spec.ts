import { expect, test } from "./fixtures";

test.describe("Authentication", () => {
  test("a new user can register and then log in", async ({
    registerPage,
    loginPage,
    userHomePage,
  }) => {
    const user = {
      username: "ada",
      email: `ada+${Date.now()}@example.com`,
      password: "a-good-password",
    };

    await registerPage.goto();
    await registerPage.register(user);

    // Registering does not start a session; the app redirects to /login with a
    // confirmation notice.
    await expect(loginPage.registeredNotice).toBeVisible();

    await loginPage.login({ email: user.email, password: user.password });

    // Landing on the signed-in home view means the session cookie was set and
    // the route guard let us through — i.e. we're logged in.
    await expect(userHomePage.root).toBeVisible();
    await expect(userHomePage.heading).toBeVisible();
    await expect(userHomePage.logoutButton).toBeVisible();
  });
});
