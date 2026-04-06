import { lazy, Suspense, useEffect } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";
import { requestNotificationPermission, sendNotification } from "@/lib/notifications";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const LandingPage = lazy(() => import("./pages/LaunchPortalPage"));
const CommandCenterPage = lazy(() => import("./pages/CommandCenterOperationalPage"));
const WorkboardPage = lazy(() => import("./pages/WorkboardPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const SchedulerPage = lazy(() => import("./pages/SchedulerPage"));
const EquipmentPage = lazy(() => import("./pages/EquipmentPage"));
const BreakroomPage = lazy(() => import("./pages/BreakroomPage"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TasksPage = lazy(() => import("./pages/TasksCatalogPage"));
const SafetyPage = lazy(() => import("./pages/SafetyPage"));
import ProgramSetupHubPage from "./pages/ProgramSetupHubPage";
const WeatherPage = lazy(() => import("./pages/WeatherPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const MobileFieldPage = lazy(() => import("./pages/MobileFieldWorkspacePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
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

function AppRoutes() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <AppLayout>
        <Routes>
          <Route path="dashboard" element={<CommandCenterPage />} />
          <Route path="workboard" element={<WorkboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="scheduler" element={<SchedulerPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="breakroom" element={<BreakroomPage />} />
          <Route path="weather" element={<WeatherPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="messaging" element={<MessagingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="safety" element={<SafetyPage />} />
          <Route path="settings" element={<ProgramSetupHubPage />} />
          <Route path="field" element={<MobileFieldPage />} />
        </Routes>
      </AppLayout>
    </Suspense>
  );
}

function AppWithNotificationSetup() {
  const { currentUser } = useAuth();

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
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${currentUser.authUser.id}` },
        (payload) => {
          const next = payload.new as { subject?: string | null; body?: string | null };
          sendNotification('New message received', next.subject || next.body || 'Open Messaging to view the latest message.', '/app/messaging');
        },
      )
      .subscribe();

    const scheduleChannel = supabase
      .channel(`app-notify-schedule-${currentUser.employeeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_entries', filter: `employee_id=eq.${currentUser.employeeId}` },
        () => {
          sendNotification('Schedule updated', 'Your shift schedule changed. Open Scheduler to review.', '/app/scheduler');
        },
      )
      .subscribe();

    const assignmentsChannel = supabase
      .channel(`app-notify-assignments-${currentUser.employeeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'assignments', filter: `employee_id=eq.${currentUser.employeeId}` },
        () => {
          sendNotification('New task assigned', 'A new task was assigned to you. Open Workflow to review.', '/app/workboard');
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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app/*" element={<AppRoutes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
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
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            Array.isArray(query.queryKey) &&
            ['assignments', 'schedule-entries', 'clock-events', 'properties', 'tasks', 'employees'].includes(String(query.queryKey[0])),
        },
      }}
    >
      <AuthProvider>
        <AppWithNotificationSetup />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
