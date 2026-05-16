export function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`card-skel-${index}`} className="rounded-xl border p-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
          <div className="mt-3 h-8 w-1/2 animate-pulse rounded bg-muted/40" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted/40" />
          <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-muted/40" />
        </div>
      ))}
    </div>
  );
}
