import { useMutation } from "@apollo/client/react";
import { Loader2, Lock, LogIn, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/button";
import { AuthShell, LabeledInput } from "@/auth/AuthShell";
import { LoginMutation, MeQuery } from "@/auth/queries";
import { testIds } from "@/testIds";

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = Boolean(
    (location.state as { registered?: boolean } | null)?.registered,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [login, { loading, error }] = useMutation(LoginMutation, {
    // Prime the `me` query so route guards see the user without a round-trip.
    update(cache, { data }) {
      if (data?.login) {
        cache.writeQuery({ query: MeQuery, data: { me: data.login } });
      }
    },
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await login({ variables: { input: { email, password } } });
      navigate("/home", { replace: true });
    } catch {
      // Failure is surfaced through `error` below.
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your Vamp account."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link className="font-medium text-primary hover:underline" to="/register">
            Create one
          </Link>
        </>
      }
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        noValidate
        data-testid={testIds.LoginView.form}
      >
        {justRegistered && (
          <p
            data-testid={testIds.LoginView.registeredNotice}
            className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            Account created — please log in.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error.message}
          </p>
        )}

        <LabeledInput
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          data-testid={testIds.LoginView.email}
        />
        <LabeledInput
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          data-testid={testIds.LoginView.password}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
          data-testid={testIds.LoginView.submit}
        >
          {loading ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <LogIn aria-hidden />
          )}
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
