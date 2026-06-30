import type { Locator } from "@playwright/test";
import { testIds } from "@/testIds";
import { BasePage } from "./BasePage";

/**
 * POM for the project editor at `/projects/:projectId` (`ProjectView`).
 * `path` is the route template; use {@link goto} with a concrete id to navigate.
 */
export class ProjectPage extends BasePage {
  readonly path = "/projects/:projectId";

  get root(): Locator {
    return this.page.getByTestId(testIds.ProjectView.root);
  }

  get trackPane(): Locator {
    return this.page.getByTestId(testIds.TrackPane.root);
  }

  get timelineToolbar(): Locator {
    return this.page.getByTestId(testIds.TimelineToolbar.root);
  }

  /** Navigate to a specific project by id. */
  async goto(projectId?: string): Promise<void> {
    if (!projectId) {
      throw new Error("ProjectPage.goto requires a projectId");
    }
    await this.page.goto(`/projects/${projectId}`);
  }
}
