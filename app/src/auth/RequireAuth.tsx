import { useQuery } from "@apollo/client/react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { MeQuery } from "./queries";

/**
 * Route guard: renders its children only when a user is signed in, otherwise
 * redirects to the login view. While the `me` query is in flight it shows a
 * spinner so we don't flash the protected content (or a wrongful redirect).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, loading } = useQuery(MeQuery);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Checking your session"
        className="flex min-h-screen items-center justify-center bg-background text-muted-foreground"
      >
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!data?.me) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
