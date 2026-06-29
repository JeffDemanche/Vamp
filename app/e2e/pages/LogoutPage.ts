import type { Locator } from "@playwright/test";
import { testIds } from "@/testIds";
import { BasePage } from "./BasePage";

/**
 * POM for the logout route at `/logout` (`LogoutView`). Visiting it ends the
 * session and redirects to `/`; the spinner below shows only briefly.
 */
export class LogoutPage extends BasePage {
  readonly path = "/logout";

  get root(): Locator {
    return this.page.getByTestId(testIds.LogoutView.root);
  }
}
