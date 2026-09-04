import { lazy, Suspense, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

const WorkboardContent = lazy(() => import("./WorkboardContent"));
const OpenTasksBacklogView = lazy(() =>
  import("@/components/workboard/OpenTasksBacklogView").then((module) => ({ default: module.OpenTasksBacklogView })),
);
const WorkboardWeekView = lazy(() =>
  import("@/components/workboard/WorkboardWeekView").then((module) => ({ default: module.WorkboardWeekView })),
);
const WorkboardTodayView = lazy(() =>
  import("@/components/workboard/WorkboardTodayView").then((module) => ({ default: module.WorkboardTodayView })),
);

function WorkboardModeContent() {
  const searchParams = useSearchParams();
  const workflowMode = searchParams.get("mode") || "";

  if (workflowMode === "backlog") return <OpenTasksBacklogView />;
  if (workflowMode === "week") return <WorkboardWeekView />;
  if (workflowMode === "today") return <WorkboardTodayView />;
  return <WorkboardContent />;
}

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
        <div className="flex h-full min-h-0 items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading workflow...</div>
        </div>
      }
    >
      <WorkboardModeContent />
    </Suspense>
  );
}
