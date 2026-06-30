import { useQuery } from "@apollo/client/react";
import { Loader2, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { CreateProjectButton } from "@/components/features/CreateProjectButton";
import { ProjectsTable } from "@/components/features/ProjectsTable";
import { Button } from "@/components/primitives/button";
import { MeQuery } from "@/auth/queries";
import { useLogout } from "@/auth/useLogout";
import { testIds } from "@/testIds";

export function UserHomeView() {
  const navigate = useNavigate();

  const { data } = useQuery(MeQuery);
  const userId = data?.me?._id;

  const { logout, loading } = useLogout();

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div
      data-testid={testIds.UserHomeView.root}
      className="min-h-screen bg-background px-6 py-8 text-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Vamp
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Your Vamps</h1>
          <p className="mt-1 text-muted-foreground">
            Vamps you own and collaborate on will appear here.
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

      <div className="mt-8">
        <div
          data-testid={testIds.UserHomeView.projectsToolbar}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          {userId && <CreateProjectButton ownerId={userId} />}
        </div>

        {userId && (
          <div className="mt-3 rounded-lg border border-border">
            <ProjectsTable userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}
