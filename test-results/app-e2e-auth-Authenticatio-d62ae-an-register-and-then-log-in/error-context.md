# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app/e2e/auth.spec.ts >> Authentication >> a new user can register and then log in
- Location: app/e2e/auth.spec.ts:4:7

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:4001
Call log:
  - → POST http://127.0.0.1:4001/__e2e__/reset
    - user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```

# Test source

```ts
  1  | import { test as base, expect } from "@playwright/test";
  2  | import { LandingPage } from "./pages/LandingPage";
  3  | import { LoginPage } from "./pages/LoginPage";
  4  | import { LogoutPage } from "./pages/LogoutPage";
  5  | import { ProjectPage } from "./pages/ProjectPage";
  6  | import { RegisterPage } from "./pages/RegisterPage";
  7  | import { UserHomePage } from "./pages/UserHomePage";
  8  | 
  9  | /** Page Object Models exposed as Playwright fixtures, one per route. */
  10 | interface Pages {
  11 |   landingPage: LandingPage;
  12 |   registerPage: RegisterPage;
  13 |   loginPage: LoginPage;
  14 |   logoutPage: LogoutPage;
  15 |   userHomePage: UserHomePage;
  16 |   projectPage: ProjectPage;
  17 | }
  18 | 
  19 | /**
  20 |  * Integration-test fixture. Two responsibilities:
  21 |  *
  22 |  *  1. `page` — wipes the ephemeral backend (Mongo collections + local audio
  23 |  *     uploads) before each test so every spec starts from a blank slate.
  24 |  *  2. The POM fixtures — lazily construct a page object per route, so specs read
  25 |  *     as `await registerPage.register(...)` instead of juggling raw locators.
  26 |  */
  27 | export const test = base.extend<Pages>({
  28 |   page: async ({ page, baseURL }, use) => {
  29 |     const resetUrl = `${baseURL ?? "http://127.0.0.1:4001"}/__e2e__/reset`;
> 30 |     const response = await page.request.post(resetUrl);
     |                                         ^ Error: apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:4001
  31 |     if (!response.ok()) {
  32 |       throw new Error(
  33 |         `E2E reset failed (${response.status()}): ${await response.text()}`,
  34 |       );
  35 |     }
  36 |     await use(page);
  37 |   },
  38 | 
  39 |   landingPage: async ({ page }, use) => {
  40 |     await use(new LandingPage(page));
  41 |   },
  42 |   registerPage: async ({ page }, use) => {
  43 |     await use(new RegisterPage(page));
  44 |   },
  45 |   loginPage: async ({ page }, use) => {
  46 |     await use(new LoginPage(page));
  47 |   },
  48 |   logoutPage: async ({ page }, use) => {
  49 |     await use(new LogoutPage(page));
  50 |   },
  51 |   userHomePage: async ({ page }, use) => {
  52 |     await use(new UserHomePage(page));
  53 |   },
  54 |   projectPage: async ({ page }, use) => {
  55 |     await use(new ProjectPage(page));
  56 |   },
  57 | });
  58 | 
  59 | export { expect };
  60 | 
```