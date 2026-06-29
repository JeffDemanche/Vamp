import { expect, test } from "./fixtures";

test.describe("Home route", () => {
  test("renders the app shell at /", async ({ landingPage }) => {
    await landingPage.goto();

    await expect(landingPage.heading).toBeVisible();
    await expect(landingPage.tagline).toBeVisible();
    await expect(landingPage.userList.getByText("No users yet.")).toBeVisible();
  });
});
