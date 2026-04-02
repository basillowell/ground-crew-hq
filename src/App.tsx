import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

const LandingPage = lazy(() => import("./pages/LaunchpadPage"));
const CommandCenterPage = lazy(() => import("./pages/CommandCenterPage"));
const WorkboardPage = lazy(() => import("./pages/WorkboardPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const SchedulerPage = lazy(() => import("./pages/SchedulerPage"));
const EquipmentPage = lazy(() => import("./pages/EquipmentPage"));
const BreakroomPage = lazy(() => import("./pages/BreakroomPage"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TasksPage = lazy(() => import("./pages/TasksCatalogPage"));
const SafetyPage = lazy(() => import("./pages/SafetyPage"));
const SettingsPage = lazy(() => import("./pages/ProgramSetupHubPage"));
const WeatherPage = lazy(() => import("./pages/WeatherPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const MobileFieldPage = lazy(() => import("./pages/MobileFieldPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.08),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,245,1))]">
      <div className="flex items-center gap-3 rounded-2xl border bg-card/90 px-5 py-4 shadow-sm backdrop-blur">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div>
          <div className="text-sm font-medium">Loading workspace</div>
          <div className="text-xs text-muted-foreground">Preparing operations modules and dashboard tools.</div>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <AppLayout>
        <Routes>
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
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </AppLayout>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
