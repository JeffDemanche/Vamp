import { useMutation } from "@apollo/client/react";
import { Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/button";
import { LogoutMutation, MeQuery } from "@/auth/queries";

export function UserHomeView() {
  const navigate = useNavigate();

  const [logout, { loading }] = useMutation(LogoutMutation, {
    // Clear the cached user so guarded routes redirect to login immediately.
    update(cache) {
      cache.writeQuery({ query: MeQuery, data: { me: null } });
    },
  });

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div
      data-testid="user-home-view"
      className="min-h-screen bg-background px-6 py-8 text-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your projects</h1>
          <p className="mt-1 text-muted-foreground">
            Projects you own and collaborate on will appear here.
          </p>
        </div>
        <Button variant="outline" onClick={onLogout} disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <LogOut aria-hidden />
          )}
          Log out
        </Button>
      </div>
    </div>
  );
}
