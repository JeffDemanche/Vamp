import type { Locator } from "@playwright/test";
import { testIds } from "@/testIds";
import { BasePage } from "./BasePage";

/** POM for the signed-in home view at `/home` (`UserHomeView`). */
export class UserHomePage extends BasePage {
  readonly path = "/home";

  get root(): Locator {
    return this.page.getByTestId(testIds.UserHomeView.root);
  }

  get heading(): Locator {
    return this.root.getByRole("heading", { name: "Your Vamps" });
  }

  get logoutButton(): Locator {
    return this.root.getByRole("button", { name: /log out/i });
  }

  get createProjectButton(): Locator {
    return this.root.getByRole("button", { name: /new vamp/i });
  }

  get projectsTable(): Locator {
    return this.page.getByTestId(testIds.ProjectsTable.table);
  }

  get projectsEmpty(): Locator {
    return this.page.getByTestId(testIds.ProjectsTable.empty);
  }
}
