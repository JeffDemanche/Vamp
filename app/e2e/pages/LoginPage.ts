import type { Locator } from "@playwright/test";
import { testIds } from "@/testIds";
import { AuthForm } from "../components/AuthForm";
import { BasePage } from "./BasePage";

export interface LoginCredentials {
  email: string;
  password: string;
}

/** POM for the login view at `/login` (`LoginView`). */
export class LoginPage extends BasePage {
  readonly path = "/login";

  readonly form = new AuthForm(this.page, testIds.LoginView);

  /** The "Account created — please log in." notice shown after registering. */
  get registeredNotice(): Locator {
    return this.page.getByTestId(testIds.LoginView.registeredNotice);
  }

  /** Fill in the credentials and submit the login form. */
  async login(credentials: LoginCredentials): Promise<void> {
    await this.form.fillEmail(credentials.email);
    await this.form.fillPassword(credentials.password);
    await this.form.submit();
  }
}
