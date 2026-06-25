import { expect, test } from "@playwright/test";

test.describe("Home route", () => {
  test("renders the app shell at /", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Vamp")).toBeVisible();
    await expect(page.getByText("Collaborative music-making")).toBeVisible();
  });
});
