export function PageSkeleton() {
  return (
    <div className="min-h-[calc(100vh-120px)] p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted/50" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-40 animate-pulse rounded-2xl border bg-card/70" />
          <div className="h-40 animate-pulse rounded-2xl border bg-card/70" />
          <div className="h-40 animate-pulse rounded-2xl border bg-card/70" />
        </div>
        <div className="h-72 animate-pulse rounded-2xl border bg-card/70" />
      </div>
    </div>
  );
}
