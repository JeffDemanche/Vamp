import { test as base, expect } from "@playwright/test";

/**
 * Integration-test fixture: wipes the ephemeral backend (Mongo collections +
 * local audio uploads) before each test so every spec starts from a blank slate.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const resetUrl = `${baseURL ?? "http://localhost:4001"}/__e2e__/reset`;
    const response = await page.request.post(resetUrl);
    if (!response.ok()) {
      throw new Error(
        `E2E reset failed (${response.status()}): ${await response.text()}`,
      );
    }
    await use(page);
  },
});

export { expect };
