import { useQuery } from "@apollo/client/react";
import { ArrowRight, Loader2, LogIn, LogOut, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { MeQuery } from "@/auth/queries";
import { Button } from "@/components/primitives/button";
import { graphql } from "@/generated";
import { logError } from "@/lib/errors";
import { testIds } from "@/testIds";

export const UsersQuery = graphql(`
  query Users {
    users {
      _id
      username
      email
    }
  }
`);

export function LandingView() {
  const { data, loading, error } = useQuery(UsersQuery);
  const { data: meData } = useQuery(MeQuery);
  const isSignedIn = Boolean(meData?.me);

  useEffect(() => {
    if (error) logError("Failed to load users for the landing view", error);
  }, [error]);

  return (
    <div
      data-testid={testIds.LandingView.root}
      className="min-h-screen bg-background px-6 py-8 text-foreground"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vamp</h1>
          <p className="mt-1 text-muted-foreground">Collaborative music-making</p>
        </div>
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <>
              <Button asChild>
                <Link to="/home">
                  Go to your Vamps
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/logout">
                  <LogOut aria-hidden />
                  Log out
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">
                  <LogIn aria-hidden />
                  Log in
                </Link>
              </Button>
              <Button asChild>
                <Link to="/register">
                  <UserPlus aria-hidden />
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div
          role="status"
          aria-label="Loading users"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading users…
        </div>
      )}

      {error && (
        <p data-testid={testIds.LandingView.error} className="text-destructive">
          Something went wrong loading users.
        </p>
      )}

      {data && (
        <ul data-testid={testIds.LandingView.userList} className="divide-y divide-border">
          {data.users.length === 0 ? (
            <li className="py-3 text-muted-foreground">No users yet.</li>
          ) : (
            data.users.map((user) => (
              <li key={user._id} className="py-3">
                <p className="font-semibold">{user.username}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
