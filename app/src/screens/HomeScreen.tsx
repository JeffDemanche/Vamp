import { useQuery } from "@apollo/client/react";
import { Loader2 } from "lucide-react";
import { graphql } from "../generated";

export const UsersQuery = graphql(`
  query Users {
    users {
      _id
      username
      email
    }
  }
`);

export function HomeScreen() {
  const { data, loading, error } = useQuery(UsersQuery);

  return (
    <div
      data-testid="home-screen"
      className="min-h-screen bg-background px-6 py-8 text-foreground"
    >
      <h1 className="text-3xl font-bold tracking-tight">Vamp</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        Collaborative music-making
      </p>

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
        <p data-testid="error" className="text-destructive">
          Could not load users: {error.message}
        </p>
      )}

      {data && (
        <ul data-testid="user-list" className="divide-y divide-border">
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
