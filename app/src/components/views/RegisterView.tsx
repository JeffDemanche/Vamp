import { useMutation } from "@apollo/client/react";
import { Loader2, Lock, Mail, User, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/button";
import { AuthShell, LabeledInput } from "@/auth/AuthShell";
import { RegisterMutation } from "@/auth/queries";

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
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
        />

        <Button type="submit" className="w-full" disabled={loading}>
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
