import type { Page } from "@playwright/test";

/**
 * Base class for all Page Object Models. Holds the Playwright `page` and the
 * route's `path`, and provides a shared `goto()` that navigates to it.
 *
 * Locators in subclasses should prefer `page.getByTestId(...)` so specs stay
 * resilient to copy/markup changes (see the `data-testid`s on the views).
 */
export abstract class BasePage {
  /** The route this page object represents, e.g. `/login`. */
  abstract readonly path: string;

  constructor(protected readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
