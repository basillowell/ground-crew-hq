export function TableSkeleton() {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={`table-skel-head-${index}`} className="h-3 animate-pulse rounded bg-muted/60" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={`table-skel-row-${row}`} className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, col) => (
              <div key={`table-skel-cell-${row}-${col}`} className="h-9 animate-pulse rounded bg-muted/40" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
