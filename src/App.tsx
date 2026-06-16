import { Component, ErrorInfo, lazy, ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";

const LandingPage = lazy(() => import("./pages/LaunchPortalPage"));
const CommandCenterPage = lazy(() => import("./pages/CommandCenterOperationalPage"));
const WorkboardPage = lazy(() => import("./pages/WorkboardShell"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const SchedulerPage = lazy(() => import("./pages/SchedulerPage"));
const EquipmentPage = lazy(() => import("./pages/EquipmentPage"));
const BreakroomPage = lazy(() => import("./pages/BreakroomPage"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TasksPage = lazy(() => import("./pages/TasksCatalogPage"));
const SafetyPage = lazy(() => import("./pages/SafetyPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WeatherPage = lazy(() => import("./pages/WeatherPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const MobileFieldPage = lazy(() => import("./pages/MobileFieldWorkspacePage"));
const DispatchPage = lazy(() => import("./pages/DispatchBoardPage"));
const InvoicingPage = lazy(() => import("./pages/InvoicingPage"));
const JobCostingPage = lazy(() => import("./pages/JobCostingPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ClientPortalPage = lazy(() => import("./pages/ClientPortalPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
});

const queryPersister = typeof window !== "undefined"
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: "ground-crew-query-cache-v3",
    })
  : undefined;

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border bg-card/90 px-5 py-4 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div>
          <div className="text-sm font-medium">Loading workspace</div>
          <div className="text-xs text-muted-foreground">
            Preparing operations modules.
          </div>
        </div>
      </div>
    </div>
  );
}

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "An unexpected error occurred." };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <div className="text-lg font-semibold">Workspace error recovered</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This page hit an unexpected error. Your session is still valid.
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
              className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground"
              onClick={() => window.location.assign("/")}
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, isLoading } = useAuth();
  const hasEverAuthed = useRef(false);

  if (currentUser) {
    hasEverAuthed.current = true;
  }

  if (isLoading && !hasEverAuthed.current) {
    return <RouteFallback />;
  }

  if (!isLoading && !currentUser) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppNotificationChannel() {
  const { currentUser } = useAuth();
  const [realtimeReady, setRealtimeReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRealtimeReady(true), 30000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const authUserId = currentUser?.authUser?.id;
    const employeeId = currentUser?.employeeId;
    const orgId = currentUser?.orgId;
    if (!supabase || !authUserId || !employeeId || !orgId || !realtimeReady) return;

    const channel = supabase
      .channel(`app-notify-${currentUser.appUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const next = payload.new as { body?: string };
          sendNotification("New message", next.body || "", "/app/messaging");
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_entries", filter: `employee_id=eq.${employeeId}` },
        () => sendNotification("Schedule updated", "Your shift changed", "/app/scheduler"),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "assignments", filter: `employee_id=eq.${employeeId}` },
        () => sendNotification("Task assigned", "New task assigned", "/app/workboard"),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser?.appUserId, currentUser?.authUser?.id, currentUser?.employeeId, currentUser?.orgId, realtimeReady]);

  return null;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RouteErrorBoundary>
        <AppLayout>
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CommandCenterPage />} />
            <Route path="dispatch" element={<DispatchPage />} />
            <Route path="workboard" element={<WorkboardPage />} />
            <Route path="scheduler" element={<SchedulerPage />} />
            <Route path="field" element={<MobileFieldPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="invoicing" element={<InvoicingPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="job-costing" element={<JobCostingPage />} />
            <Route path="weather" element={<WeatherPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="breakroom" element={<BreakroomPage />} />
            <Route path="messaging" element={<MessagingPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="safety" element={<SafetyPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Routes>
        </AppLayout>
      </RouteErrorBoundary>
    </Suspense>
  );
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        onSuccess: () => queryClient.resumePausedMutations(),
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            Array.isArray(query.queryKey) &&
            ["assignments", "schedule-entries", "clock-events",
             "properties", "tasks", "employees"].includes(
              String(query.queryKey[0])
            ),
        },
      }}
    >
      <AuthProvider>
        <AppNotificationChannel />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/auth/reset" element={<ResetPasswordPage />} />
                <Route path="/portal/:clientToken" element={<ClientPortalPage />} />
                <Route
                  path="/app/*"
                  element={
                    <ProtectedRoute>
                      <AppRoutes />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
