import { lazy, Suspense } from "react";

const WorkboardContent = lazy(() => import("./WorkboardContent"));

export default function WorkboardShell() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading workflow...</div>
        </div>
      }
    >
      <WorkboardContent />
    </Suspense>
  );
}
