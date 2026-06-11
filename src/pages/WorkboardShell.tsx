import { lazy, Suspense, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const WorkboardContent = lazy(() => import("./WorkboardContent"));

export default function WorkboardShell() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: ["assignments"] });
        void queryClient.invalidateQueries({ queryKey: ["schedule-entries"] });
        void queryClient.invalidateQueries({ queryKey: ["employees"] });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [queryClient]);

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
