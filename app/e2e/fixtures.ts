import { test as base, expect } from "@playwright/test";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { LogoutPage } from "./pages/LogoutPage";
import { ProjectPage } from "./pages/ProjectPage";
import { RegisterPage } from "./pages/RegisterPage";
import { UserHomePage } from "./pages/UserHomePage";

/** Page Object Models exposed as Playwright fixtures, one per route. */
interface Pages {
  landingPage: LandingPage;
  registerPage: RegisterPage;
  loginPage: LoginPage;
  logoutPage: LogoutPage;
  userHomePage: UserHomePage;
  projectPage: ProjectPage;
}

/**
 * Integration-test fixture. Two responsibilities:
 *
 *  1. `page` — wipes the ephemeral backend (Mongo collections + local audio
 *     uploads) before each test so every spec starts from a blank slate.
 *  2. The POM fixtures — lazily construct a page object per route, so specs read
 *     as `await registerPage.register(...)` instead of juggling raw locators.
 */
export const test = base.extend<Pages>({
  page: async ({ page, baseURL }, use) => {
    const resetUrl = `${baseURL ?? "http://127.0.0.1:4001"}/__e2e__/reset`;
    const response = await page.request.post(resetUrl);
    if (!response.ok()) {
      throw new Error(
        `E2E reset failed (${response.status()}): ${await response.text()}`,
      );
    }
    await use(page);
  },

  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  logoutPage: async ({ page }, use) => {
    await use(new LogoutPage(page));
  },
  userHomePage: async ({ page }, use) => {
    await use(new UserHomePage(page));
  },
  projectPage: async ({ page }, use) => {
    await use(new ProjectPage(page));
  },
});

export { expect };
