import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebarRefined } from './AppSidebarRefined';
import { WorkflowTopBar } from './WorkflowTopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { ProgramSettings } from '@/data/seedData';
import {
  useAssignments,
  useDepartmentOptions,
  useEmployees,
  useEquipmentUnits,
  useProgramSettings,
  useProperties,
  useScheduleEntries,
} from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { OperationsProvider } from '@/contexts/OperationsContext';

interface AppLayoutProps {
  children: ReactNode;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  route: string;
  icon: 'task' | 'schedule' | 'equipment';
  timestamp: string;
  read: boolean;
}

function hexToHslValues(hex: string | undefined, fallback: string) {
  if (!hex) return fallback;
  const sanitized = hex.replace('#', '').trim();
  if (![3, 6].includes(sanitized.length)) return fallback;
  const normalized = sanitized.length === 3
    ? sanitized.split('').map((char) => char + char).join('')
    : sanitized;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  if ([r, g, b].some((value) => Number.isNaN(value))) return fallback;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
  }
  const hue = Math.round(h * 60 < 0 ? h * 60 + 360 : h * 60);
  const sat = Math.round(s * 100);
  const light = Math.round(l * 100);
  return `${hue} ${sat}% ${light}%`;
}

function applyBranding(programSetting?: ProgramSettings) {
  if (typeof document === 'undefined' || !programSetting) return;
  document.title = `${programSetting.appName || 'Ground Crew HQ'}${programSetting.clientLabel ? ` | ${programSetting.clientLabel}` : ''}`;
  const root = document.documentElement;
  root.style.setProperty('--primary', hexToHslValues(programSetting.primaryColor, '152 55% 38%'));
  root.style.setProperty('--ring', hexToHslValues(programSetting.primaryColor, '152 55% 38%'));
  root.style.setProperty('--accent', hexToHslValues(programSetting.accentColor, '152 30% 94%'));
  root.style.setProperty('--sidebar-background', hexToHslValues(programSetting.sidebarColor, '220 20% 14%'));
  root.style.setProperty('--sidebar-primary', hexToHslValues(programSetting.primaryColor, '152 55% 48%'));
  const fontThemes: Record<string, { body: string; heading: string }> = {
    'modern-sans': {
      body: '"Inter", "Segoe UI", sans-serif',
      heading: '"Inter", "Segoe UI", sans-serif',
    },
    'editorial-serif': {
      body: '"Inter", "Segoe UI", sans-serif',
      heading: '"Georgia", "Times New Roman", serif',
    },
    'classic-club': {
      body: '"Trebuchet MS", "Segoe UI", sans-serif',
      heading: '"Palatino Linotype", "Book Antiqua", serif',
    },
    'compact-ops': {
      body: '"Segoe UI", "Arial", sans-serif',
      heading: '"Segoe UI", "Arial", sans-serif',
    },
  };
  const chosenFontTheme = fontThemes[programSetting.fontThemePreset || 'modern-sans'] || fontThemes['modern-sans'];
  root.style.setProperty('--brand-body-font', chosenFontTheme.body);
  root.style.setProperty('--brand-heading-font', chosenFontTheme.heading);
  if (programSetting.logoUrl) {
    let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = programSetting.logoUrl;
  }
}

const inAppNotificationEventName = 'ground-crew-in-app-notification';

type IncomingNotification = Omit<AppNotification, 'read'>;

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const [department, setDepartment] = useState('Maintenance');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [inAppNotifications, setInAppNotifications] = useState<AppNotification[]>([]);
  const { currentUser, currentPropertyId, setCurrentPropertyId, signOut, orgId } = useAuth();
  const programSettingQuery = useProgramSettings(orgId);
  const propertiesQuery = useProperties(orgId);
  const deptQuery = useDepartmentOptions();
  const todayKey = currentDate.toISOString().slice(0, 10);
  const employeesQuery = useEmployees(currentPropertyId, orgId);
  const scheduleQuery = useScheduleEntries(todayKey, currentPropertyId);
  const assignmentsQuery = useAssignments(todayKey, currentPropertyId);
  const equipmentQuery = useEquipmentUnits(currentPropertyId, orgId);

  const programSetting = programSettingQuery.data ?? null;

  useEffect(() => {
    applyBranding(programSetting ?? undefined);
  }, [programSetting]);

  const computedNotifications = useMemo(() => {
    const currentDayKey = currentDate.toISOString().slice(0, 10);
    const employees = employeesQuery.data ?? [];
    const scheduleEntries = scheduleQuery.data ?? [];
    const assignments = assignmentsQuery.data ?? [];
    const equipmentUnits = equipmentQuery.data ?? [];
    const activeEmployees = employees.filter((employee) => employee.status === 'active' && employee.department === department);
    const scheduledToday = scheduleEntries.filter(
      (entry) => entry.date === currentDayKey && entry.status === 'scheduled' && activeEmployees.some((employee) => employee.id === entry.employeeId),
    );
    const assignmentsToday = assignments.filter((entry) => entry.date === currentDayKey);
    const equipmentIssues = equipmentUnits.filter((unit) => unit.status === 'maintenance' || unit.status === 'out-of-service');
    const unassignedCrew = scheduledToday.filter(
      (entry) => !assignmentsToday.some((assignment) => assignment.employeeId === entry.employeeId),
    );
    const unscheduledCrew = activeEmployees.filter(
      (employee) => !scheduledToday.some((entry) => entry.employeeId === employee.id),
    );

    const nextNotifications: AppNotification[] = [];
    const now = new Date().toISOString();

    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      if (unscheduledCrew.length > 0) {
        nextNotifications.push({
          id: 'unscheduled-crew',
          title: `${unscheduledCrew.length} crew members still need shifts`,
          description: `${unscheduledCrew.slice(0, 3).map((entry) => `${entry.firstName} ${entry.lastName}`).join(', ')}${unscheduledCrew.length > 3 ? ' and more' : ''}`,
          severity: 'warning',
          route: '/app/scheduler',
          icon: 'schedule',
          timestamp: now,
          read: false,
        });
      }
      if (unassignedCrew.length > 0) {
        nextNotifications.push({
          id: 'unassigned-crew',
          title: `${unassignedCrew.length} scheduled crew members lack assignments`,
          description: 'Open the workflow board to finish dispatching today\'s labor plan.',
          severity: 'critical',
          route: '/app/workboard',
          icon: 'task',
          timestamp: now,
          read: false,
        });
      }
      if (equipmentIssues.length > 0) {
        nextNotifications.push({
          id: 'equipment-issues',
          title: `${equipmentIssues.length} equipment units need attention`,
          description: 'Maintenance or out-of-service equipment can affect labor and spray plans.',
          severity: 'warning',
          route: '/app/equipment',
          icon: 'equipment',
          timestamp: now,
          read: false,
        });
      }
    }

    return nextNotifications;
  }, [employeesQuery.data, scheduleQuery.data, assignmentsQuery.data, equipmentQuery.data, currentDate, currentUser?.role, department]);

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<IncomingNotification>).detail;
      if (!detail) return;
      setInAppNotifications((previous) => [{ ...detail, read: false }, ...previous].slice(0, 40));
    };

    window.addEventListener(inAppNotificationEventName, handleNotification as EventListener);
    return () => window.removeEventListener(inAppNotificationEventName, handleNotification as EventListener);
  }, []);

  useEffect(() => {
    if (!computedNotifications.length) return;
    setInAppNotifications((previous) => {
      const byId = new Map(previous.map((item) => [item.id, item]));
      const merged = [...previous];
      computedNotifications.forEach((item) => {
        if (!byId.has(item.id)) {
          merged.unshift(item);
        }
      });
      return merged.slice(0, 40);
    });
  }, [computedNotifications]);

  const notificationsForDisplay = useMemo(() => {
    if (inAppNotifications.length > 0) return inAppNotifications;
    return [{
      id: 'all-clear',
      title: 'Operations look clean',
      description: 'No urgent admin issues were detected for the current date and department.',
      severity: 'info' as const,
      route: '/app/workboard',
      icon: 'schedule' as const,
      timestamp: new Date().toISOString(),
      read: true,
    }];
  }, [inAppNotifications]);

  const unreadNotificationCount = useMemo(
    () => inAppNotifications.filter((entry) => !entry.read).length,
    [inAppNotifications],
  );

  const handleSelectProperty = (propertyId: string) => {
    setCurrentPropertyId(propertyId);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const markAllNotificationsRead = () => {
    setInAppNotifications((previous) => previous.map((entry) => ({ ...entry, read: true })));
  };

  const handleNotificationOpen = (route: string, id: string) => {
    setInAppNotifications((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)),
    );
    navigate(route);
  };

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {mobileSidebarOpen ? (
          <button
            type="button"
            aria-label="Close menu backdrop"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={closeMobileSidebar}
          />
        ) : null}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <AppSidebarRefined onNavigate={closeMobileSidebar} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <WorkflowTopBar
            department={department}
            setDepartment={setDepartment}
            departments={deptQuery.data?.map((d) => d.name) ?? ['Maintenance']}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            properties={propertiesQuery.data ?? []}
            currentPropertyId={currentPropertyId}
            onSelectProperty={handleSelectProperty}
            allowAllProperties={currentUser?.role === 'admin' || currentUser?.role === 'manager'}
            notifications={notificationsForDisplay}
            unreadNotificationCount={unreadNotificationCount}
            onMarkAllNotificationsRead={markAllNotificationsRead}
            onOpenNotification={handleNotificationOpen}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            onSignOut={handleSignOut}
            programSetting={programSetting ?? undefined}
          />
          <OperationsProvider
            value={{
              currentDate,
              setCurrentDate,
              department,
              setDepartment,
            }}
          >
            <main className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,246,1))]">
              <div className="md:hidden border-b bg-background/85 px-4 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workflow Date</div>
                <div className="text-sm font-medium text-foreground">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              {children}
            </main>
          </OperationsProvider>
        </div>
      </div>
    </SidebarProvider>
  );
}
