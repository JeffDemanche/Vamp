import { useMutation } from "@apollo/client/react";
import { Loader2, Lock, Mail, User, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/button";
import { AuthShell, LabeledInput } from "@/auth/AuthShell";
import { RegisterMutation } from "@/auth/queries";
import { testIds } from "@/testIds";

export function RegisterView() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [register, { loading, error }] = useMutation(RegisterMutation);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await register({ variables: { input: { username, email, password } } });
      // Registration does not start a session; send them to log in.
      navigate("/login", { replace: true, state: { registered: true } });
    } catch {
      // Failure is surfaced through `error` below.
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start making music together on Vamp."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" to="/login">
            Log in
          </Link>
        </>
      }
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        noValidate
        data-testid={testIds.RegisterView.form}
      >
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error.message}
          </p>
        )}

        <LabeledInput
          id="username"
          label="Username"
          icon={User}
          autoComplete="username"
          required
          minLength={2}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your-handle"
          data-testid={testIds.RegisterView.username}
        />
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
          data-testid={testIds.RegisterView.email}
        />
        <LabeledInput
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          data-testid={testIds.RegisterView.password}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
          data-testid={testIds.RegisterView.submit}
        >
          {loading ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <UserPlus aria-hidden />
          )}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
