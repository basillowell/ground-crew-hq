import { Component, ErrorInfo, lazy, ReactNode, Suspense, useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { toast, Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { SafeRender } from "@/components/SafeRender";
import { Loader2 } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { requestNotificationPermission, sendNotification } from "@/lib/notifications";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatTime } from "@/utils/formatTime";

const LandingPage = lazy(() => import("./pages/LaunchPortalPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const CommandCenterPage = lazy(() => import("./pages/CommandCenterOperationalPage"));
const WorkboardPage = lazy(() => import("./pages/WorkboardPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const SchedulerPage = lazy(() => import("./pages/SchedulerPage"));
const EquipmentPage = lazy(() => import("./pages/EquipmentPage"));
const BreakroomPage = lazy(() => import("./pages/BreakroomPage"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SafetyPage = lazy(() => import("./pages/SafetyPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WeatherPage = lazy(() => import("./pages/WeatherPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const MobileFieldPage = lazy(() => import("./pages/MobileFieldWorkspacePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60 * 4,
      refetchOnWindowFocus: false,
    },
  },
});
const queryPersister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: "ground-crew-query-cache",
      })
    : undefined;
const NOTIFICATION_PERMISSION_KEY = "ground-crew-notification-permission-requested";
const IN_APP_NOTIFICATION_EVENT = "ground-crew-in-app-notification";

type InAppNotificationDetail = {
  id: string;
  title: string;
  description: string;
  route: string;
  severity: "critical" | "warning" | "info";
  icon: "task" | "schedule" | "equipment";
  timestamp: string;
};

function publishInAppNotification(detail: InAppNotificationDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(IN_APP_NOTIFICATION_EVENT, { detail }));
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,245,1))]">
      <div className="flex items-center gap-3 rounded-2xl border bg-card/95 px-5 py-4 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div>
          <div className="text-sm font-medium">Loading workspace</div>
          <div className="text-xs text-muted-foreground">Preparing the next screen.</div>
        </div>
      </div>
    </div>
  );
}

function PageRouteFallback() {
  return <PageSkeleton />;
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "An unexpected page error occurred." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, info);
    // Auto-clear stale cached query state to avoid persistent crash loops after deploys.
    try {
      window.localStorage.removeItem("ground-crew-query-cache");
    } catch {
      // No-op: recovery continues even if storage is unavailable.
    }

  }

  private reportIssue = () => {
    const message = this.state.message || "Unknown runtime error";
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(message);
    }
    const subject = encodeURIComponent("Ground Crew HQ — Runtime Error Report");
    const body = encodeURIComponent(`Please review this runtime error:\n\n${message}`);
    if (typeof window !== "undefined") {
      window.location.href = `mailto:support@groundcrewhq.com?subject=${subject}&body=${body}`;
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,245,1))] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <div className="text-lg font-semibold">Workspace error recovered</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This page hit an unexpected runtime error. Your session is still valid.
          </p>
          <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {this.state.message}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              className="h-10 rounded-md border px-4 text-sm"
              onClick={() => window.location.assign("/app/dashboard")}
            >
              Go to Dashboard
            </button>
            <button
              className="h-10 rounded-md border px-4 text-sm"
              onClick={() => {
                try {
                  window.localStorage.clear();
                } catch {
                  // Ignore and continue with reload.
                }
                window.location.assign("/app/dashboard");
              }}
            >
              Clear Cache & Reload
            </button>
            <button
              className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground"
              onClick={async () => {
                try {
                  window.localStorage.removeItem("ground-crew-query-cache");
                  Object.keys(window.localStorage).forEach((key) => {
                    if (key.startsWith("ground-crew") || key.startsWith("workflow") || key.startsWith("field-cache")) {
                      window.localStorage.removeItem(key);
                    }
                  });
                  await supabase.auth.signOut();
                } catch {
                  // Ignore and continue to hard redirect.
                }
                window.location.assign("/");
              }}
            >
              Return to Login
            </button>
            <button
              className="h-10 rounded-md border px-4 text-sm"
              onClick={this.reportIssue}
            >
              Report Issue
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function RouteElementBoundary({ children }: { children: ReactNode }) {
  return <RouteErrorBoundary>{children}</RouteErrorBoundary>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, isLoading, hasSession, authState, authDebugMessage, retryAuthHydration } = useAuth();
  const navigate = useNavigate();
  const [loadingTimeoutReached, setLoadingTimeoutReached] = useState(false);

  useEffect(() => {
    const shouldTrackLoadingTimeout =
      !currentUser && (isLoading || authState === "checking-session" || authState === "loading-profile");
    if (!shouldTrackLoadingTimeout) {
      setLoadingTimeoutReached(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setLoadingTimeoutReached(true);
      navigate("/", { replace: true });
    }, 15000);
    return () => window.clearTimeout(timeoutId);
  }, [authState, currentUser, isLoading, navigate]);

  if (loadingTimeoutReached) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,245,1))] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <div className="text-lg font-semibold">Still loading your workspace</div>
          <p className="mt-2 text-sm text-muted-foreground">We&apos;re redirecting you to sign in again.</p>
        </div>
      </div>
    );
  }
  if (!currentUser && (isLoading || authState === "checking-session" || authState === "loading-profile")) return <RouteFallback />;
  if (!currentUser && hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,245,1))] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <div className="text-lg font-semibold">Loading workspace profile</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Your session is valid, but profile loading did not complete yet.
          </p>
          {authDebugMessage ? (
            <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{authDebugMessage}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              className="h-10 rounded-md border px-4 text-sm"
              onClick={() => void retryAuthHydration()}
            >
              Retry profile load
            </button>
            <button
              className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Refresh app
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LandingRoute() {
  const { currentUser, isLoading, hasSession, authState } = useAuth();
  if (!currentUser && (isLoading || authState === "checking-session" || authState === "loading-profile")) return <RouteFallback />;
  if (currentUser) return <Navigate to="/app/dashboard" replace />;
  if (hasSession) return <Navigate to="/app/dashboard" replace />;
  return (
    <Suspense fallback={<RouteFallback />}>
      <LandingPage />
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><CommandCenterPage /></Suspense></RouteElementBoundary>} />
        <Route path="workboard" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><WorkboardPage /></Suspense></RouteElementBoundary>} />
        <Route path="employees" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><EmployeesPage /></Suspense></RouteElementBoundary>} />
        <Route path="scheduler" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><SchedulerPage key="scheduler-route" /></Suspense></RouteElementBoundary>} />
        <Route path="equipment" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><EquipmentPage /></Suspense></RouteElementBoundary>} />
        <Route path="breakroom" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><BreakroomPage /></Suspense></RouteElementBoundary>} />
        <Route path="weather" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><WeatherPage /></Suspense></RouteElementBoundary>} />
        <Route path="applications" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><ApplicationsPage /></Suspense></RouteElementBoundary>} />
        <Route path="messaging" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><MessagingPage /></Suspense></RouteElementBoundary>} />
        <Route path="reports" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><ReportsPage /></Suspense></RouteElementBoundary>} />
        <Route path="safety" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><SafetyPage /></Suspense></RouteElementBoundary>} />
        <Route path="settings" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><SettingsPage /></Suspense></RouteElementBoundary>} />
        <Route path="field" element={<RouteElementBoundary><Suspense fallback={<PageRouteFallback />}><MobileFieldPage /></Suspense></RouteElementBoundary>} />
      </Routes>
    </AppLayout>
  );
}

function AppWithNotificationSetup() {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: PromiseRejectionEvent) => {
      console.error("[UnhandledRejection]", event.reason);
      toast.error("Something went wrong. Your data is safe.");
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !currentUser) return;
    if (window.localStorage.getItem(NOTIFICATION_PERMISSION_KEY)) return;
    void requestNotificationPermission().then(() => {
      window.localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "true");
    });
  }, [currentUser]);

  useEffect(() => {
    if (!supabase || !currentUser) return;

    const messagesChannel = supabase
      .channel(`app-notify-messages-${currentUser.appUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${currentUser.authUser.id}` },
        (payload) => {
          const next = payload.new as { subject?: string | null; body?: string | null };
          sendNotification("New message received", next.subject || next.body || "Open Messaging to view the latest message.", "/app/messaging");
        },
      )
      .subscribe();

    const scheduleChannel = supabase
      .channel(`app-notify-schedule-${currentUser.employeeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_entries", filter: `employee_id=eq.${currentUser.employeeId}` },
        () => {
          sendNotification("Schedule updated", "Your shift schedule changed. Open Scheduler to review.", "/app/scheduler");
          publishInAppNotification({
            id: `schedule-${Date.now()}`,
            title: "Schedule updated",
            description: "Your shift schedule changed. Open Scheduler to review.",
            route: "/app/scheduler",
            severity: "warning",
            icon: "schedule",
            timestamp: new Date().toISOString(),
          });
        },
      )
      .subscribe();

    const assignmentsChannel = supabase
      .channel(`app-notify-assignments-${currentUser.employeeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "assignments", filter: `employee_id=eq.${currentUser.employeeId}` },
        async (payload) => {
          const next = payload.new as {
            title?: string | null;
            start_time?: string | null;
            property_id?: string | null;
            assigned_by_name?: string | null;
            created_by_name?: string | null;
          };
          const assignmentTitle = next.title?.trim() || "Task";
          const dispatcherName = next.assigned_by_name?.trim() || next.created_by_name?.trim() || "Supervisor";
          const startLabel = formatTime(next.start_time).trim() || "Not set";
          let propertyName = "Property not set";
          if (next.property_id) {
            const { data: property } = await supabase
              .from("properties")
              .select("name")
              .eq("id", next.property_id)
              .maybeSingle();
            if (property?.name) {
              propertyName = property.name;
            }
          }

          const notificationBody = `Assigned by ${dispatcherName} · Start: ${startLabel} · ${propertyName}`;
          sendNotification(`New Task: ${assignmentTitle}`, notificationBody, "/app/workboard");
          publishInAppNotification({
            id: `assignment-${Date.now()}`,
            title: `New Task: ${assignmentTitle}`,
            description: notificationBody,
            route: "/app/workboard",
            severity: "info",
            icon: "task",
            timestamp: new Date().toISOString(),
          });
        },
      )
      .subscribe();

    return () => {
      void messagesChannel.unsubscribe();
      void scheduleChannel.unsubscribe();
      void assignmentsChannel.unsubscribe();
    };
  }, [currentUser]);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RouteElementBoundary><LandingRoute /></RouteElementBoundary>} />
          <Route path="/pricing" element={<RouteElementBoundary><Suspense fallback={<RouteFallback />}><PricingPage /></Suspense></RouteElementBoundary>} />
          <Route
            path="/app/*"
            element={(
              <ProtectedRoute>
                <AppRoutes />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<RouteElementBoundary><Suspense fallback={<RouteFallback />}><NotFound /></Suspense></RouteElementBoundary>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        buster: "v2.5.143",
        onError: () => {
          queryPersister?.removeClient?.();
        },
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            Array.isArray(query.queryKey) &&
            ["assignments", "schedule-entries", "clock-events", "properties", "tasks", "employees"].includes(String(query.queryKey[0])),
        },
      }}
    >
      <AuthProvider>
        <AppWithNotificationSetup />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
