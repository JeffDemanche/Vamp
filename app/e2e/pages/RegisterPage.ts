import { testIds } from "@/testIds";
import { AuthForm } from "../components/AuthForm";
import { BasePage } from "./BasePage";

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

/** POM for the registration view at `/register` (`RegisterView`). */
export class RegisterPage extends BasePage {
  readonly path = "/register";

  readonly form = new AuthForm(this.page, testIds.RegisterView);

  /** Fill in every field and submit the registration form. */
  async register(credentials: RegisterCredentials): Promise<void> {
    await this.form.fillUsername(credentials.username);
    await this.form.fillEmail(credentials.email);
    await this.form.fillPassword(credentials.password);
    await this.form.submit();
  }
}
