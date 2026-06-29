import { expect, test } from "./fixtures";

test.describe("Home route", () => {
  test("renders the app shell at /", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Vamp")).toBeVisible();
    await expect(page.getByText("Collaborative music-making")).toBeVisible();
    await expect(page.getByText("No users yet.")).toBeVisible();
  });
});
