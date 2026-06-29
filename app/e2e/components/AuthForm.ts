import type { Locator, Page } from "@playwright/test";

/**
 * The subset of a view's test ids that describe an auth form. Both
 * `testIds.RegisterView` and `testIds.LoginView` are assignable to this; the
 * `username` field only exists on the register form.
 */
export interface AuthFormTestIds {
  form: string;
  email: string;
  password: string;
  submit: string;
  username?: string;
}

/**
 * POM component for the shared auth form used by both the register and login
 * views (`AuthShell` + `LabeledInput`). The two views render the same field
 * shape under their own ids, so a single component drives both — the owning page
 * passes the relevant group from `testIds` (the source of truth).
 */
export class AuthForm {
  constructor(
    private readonly page: Page,
    private readonly ids: AuthFormTestIds,
  ) {}

  get root(): Locator {
    return this.page.getByTestId(this.ids.form);
  }

  get usernameInput(): Locator {
    if (!this.ids.username) {
      throw new Error("This auth form has no username field");
    }
    return this.page.getByTestId(this.ids.username);
  }

  get emailInput(): Locator {
    return this.page.getByTestId(this.ids.email);
  }

  get passwordInput(): Locator {
    return this.page.getByTestId(this.ids.password);
  }

  get submitButton(): Locator {
    return this.page.getByTestId(this.ids.submit);
  }

  /** The inline server-error alert shown on a failed submit. */
  get error(): Locator {
    return this.root.getByRole("alert");
  }

  async fillUsername(value: string): Promise<void> {
    await this.usernameInput.fill(value);
  }

  async fillEmail(value: string): Promise<void> {
    await this.emailInput.fill(value);
  }

  async fillPassword(value: string): Promise<void> {
    await this.passwordInput.fill(value);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
