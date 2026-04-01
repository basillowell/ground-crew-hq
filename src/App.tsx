import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import LandingPage from "./pages/LandingPage";
import WorkboardPage from "./pages/WorkboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import SchedulerPage from "./pages/SchedulerPage";
import EquipmentPage from "./pages/EquipmentPage";
import MessagingPage from "./pages/MessagingPage";
import ReportsPage from "./pages/ReportsPage";
import TasksPage from "./pages/TasksPage";
import SafetyPage from "./pages/SafetyPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="workboard" element={<WorkboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="scheduler" element={<SchedulerPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="messaging" element={<MessagingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="safety" element={<SafetyPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app/*" element={<AppRoutes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
