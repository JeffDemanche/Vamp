import type { Locator } from "@playwright/test";
import { testIds } from "@/testIds";
import { BasePage } from "./BasePage";

/** POM for the public landing view at `/` (`LandingView`). */
export class LandingPage extends BasePage {
  readonly path = "/";

  get root(): Locator {
    return this.page.getByTestId(testIds.LandingView.root);
  }

  get heading(): Locator {
    return this.root.getByRole("heading", { name: "Vamp" });
  }

  get tagline(): Locator {
    return this.root.getByText("Collaborative music-making");
  }

  get userList(): Locator {
    return this.page.getByTestId(testIds.LandingView.userList);
  }

  get loginLink(): Locator {
    return this.root.getByRole("link", { name: /log in/i });
  }

  get signUpLink(): Locator {
    return this.root.getByRole("link", { name: /sign up/i });
  }

  get goToVampsLink(): Locator {
    return this.root.getByRole("link", { name: /go to your vamps/i });
  }
}
