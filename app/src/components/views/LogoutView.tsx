import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useLogout } from "@/auth/useLogout";

/**
 * Route that ends the session as soon as it mounts, then sends the visitor back
 * to the landing view. Lets a `Link to="/logout"` act as a logout action.
 */
export function LogoutView() {
  const { logout } = useLogout();
  const startedRef = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void logout().finally(() => setDone(true));
  }, [logout]);

  if (done) {
    return <Navigate to="/" replace />;
  }

  return (
    <div
      data-testid="logout-view"
      role="status"
      aria-label="Signing you out"
      className="flex min-h-screen items-center justify-center bg-background text-muted-foreground"
    >
      <Loader2 className="size-6 animate-spin" aria-hidden />
    </div>
  );
}
