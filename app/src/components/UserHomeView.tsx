export function UserHomeView() {
  return (
    <div
      data-testid="user-home-view"
      className="min-h-screen bg-background px-6 py-8 text-foreground"
    >
      <h1 className="text-3xl font-bold tracking-tight">Your projects</h1>
      <p className="mt-1 text-muted-foreground">
        Projects you own and collaborate on will appear here.
      </p>
    </div>
  );
}
