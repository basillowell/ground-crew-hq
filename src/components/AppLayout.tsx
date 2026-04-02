import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebarRefined } from './AppSidebarRefined';
import { WorkflowTopBar } from './WorkflowTopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import {
  DATA_STORE_UPDATED_EVENT,
  loadAppUsers,
  loadAssignments,
  loadChemicalApplicationLogs,
  loadCurrentAppUserId,
  loadDepartmentOptions,
  loadEmployees,
  loadEquipmentUnits,
  loadProgramSettings,
  loadScheduleEntries,
  loadWeatherStations,
  saveCurrentAppUserId,
} from '@/lib/dataStore';
import type { AppUser, ProgramSettings } from '@/data/seedData';

interface AppLayoutProps {
  children: ReactNode;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  route: string;
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
  document.title = `${programSetting.appName || 'WorkForce App'}${programSetting.clientLabel ? ` | ${programSetting.clientLabel}` : ''}`;
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

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(['Maintenance']);
  const [department, setDepartment] = useState('Maintenance');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [programSetting, setProgramSetting] = useState<ProgramSettings | null>(null);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [dataRefreshTick, setDataRefreshTick] = useState(0);

  useEffect(() => {
    const refreshProgramSetup = () => {
      const nextDepartments = loadDepartmentOptions().map((entry) => entry.name);
      const settings = loadProgramSettings()[0];
      const nextUsers = loadAppUsers();
      const savedUserId = loadCurrentAppUserId();
      const fallbackUser = nextUsers.find((entry) => entry.status === 'active') || nextUsers[0] || null;
      const resolvedUser = nextUsers.find((entry) => entry.id === savedUserId) || fallbackUser || null;
      const fallbackDepartment = nextDepartments[0] ?? 'Maintenance';
      setProgramSetting(settings ?? null);
      setDepartmentOptions(nextDepartments.length > 0 ? nextDepartments : ['Maintenance']);
      setAppUsers(nextUsers);
      setCurrentUser(resolvedUser);
      if (resolvedUser && resolvedUser.id !== savedUserId) {
        saveCurrentAppUserId(resolvedUser.id);
      }
      setDepartment(resolvedUser?.department || settings?.defaultDepartment || fallbackDepartment);
    };

    refreshProgramSetup();
    window.addEventListener(DATA_STORE_UPDATED_EVENT, refreshProgramSetup as EventListener);
    window.addEventListener('program-setup-updated', refreshProgramSetup);
    window.addEventListener('user-session-updated', refreshProgramSetup);
    return () => {
      window.removeEventListener(DATA_STORE_UPDATED_EVENT, refreshProgramSetup as EventListener);
      window.removeEventListener('program-setup-updated', refreshProgramSetup);
      window.removeEventListener('user-session-updated', refreshProgramSetup);
    };
  }, []);

  useEffect(() => {
    applyBranding(programSetting ?? undefined);
  }, [programSetting]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('operations-context-updated', {
        detail: {
          department,
          date: currentDate.toISOString().slice(0, 10),
          currentUserId: currentUser?.id || '',
        },
      }),
    );
  }, [currentDate, currentUser?.id, department]);

  useEffect(() => {
    const handleDataUpdated = () => setDataRefreshTick((current) => current + 1);
    window.addEventListener(DATA_STORE_UPDATED_EVENT, handleDataUpdated as EventListener);
    return () => window.removeEventListener(DATA_STORE_UPDATED_EVENT, handleDataUpdated as EventListener);
  }, []);

  const notifications = useMemo(() => {
    const todayKey = currentDate.toISOString().slice(0, 10);
    const employees = loadEmployees();
    const scheduleEntries = loadScheduleEntries();
    const assignments = loadAssignments();
    const equipmentUnits = loadEquipmentUnits();
    const weatherStations = loadWeatherStations();
    const applicationLogs = loadChemicalApplicationLogs();

    const activeEmployees = employees.filter((employee) => employee.status === 'active' && employee.department === department);
    const scheduledToday = scheduleEntries.filter(
      (entry) => entry.date === todayKey && entry.status === 'scheduled' && activeEmployees.some((employee) => employee.id === entry.employeeId),
    );
    const assignmentsToday = assignments.filter((entry) => entry.date === todayKey);
    const primaryStationsOffline = weatherStations.filter((station) => station.isPrimary && station.status === 'offline');
    const equipmentIssues = equipmentUnits.filter((unit) => unit.status === 'maintenance' || unit.status === 'out-of-service');
    const unassignedCrew = scheduledToday.filter(
      (entry) => !assignmentsToday.some((assignment) => assignment.employeeId === entry.employeeId),
    );
    const unscheduledCrew = activeEmployees.filter(
      (employee) => !scheduledToday.some((entry) => entry.employeeId === employee.id),
    );
    const complianceGaps = applicationLogs.filter(
      (log) =>
        log.applicationDate === todayKey &&
        (!log.applicatorLicenseNumber || !log.supervisorLicenseNumber || !log.weatherLogId),
    );

    const nextNotifications: AppNotification[] = [];

    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      if (unscheduledCrew.length > 0) {
        nextNotifications.push({
          id: 'unscheduled-crew',
          title: `${unscheduledCrew.length} crew members still need shifts`,
          description: `${unscheduledCrew.slice(0, 3).map((entry) => `${entry.firstName} ${entry.lastName}`).join(', ')}${unscheduledCrew.length > 3 ? ' and more' : ''}`,
          severity: 'warning',
          route: '/app/scheduler',
        });
      }
      if (unassignedCrew.length > 0) {
        nextNotifications.push({
          id: 'unassigned-crew',
          title: `${unassignedCrew.length} scheduled crew members lack assignments`,
          description: 'Open the workflow board to finish dispatching today’s labor plan.',
          severity: 'critical',
          route: '/app/workboard',
        });
      }
      if (equipmentIssues.length > 0) {
        nextNotifications.push({
          id: 'equipment-issues',
          title: `${equipmentIssues.length} equipment units need attention`,
          description: 'Maintenance or out-of-service equipment can affect labor and spray plans.',
          severity: 'warning',
          route: '/app/equipment',
        });
      }
    }

    if (primaryStationsOffline.length > 0) {
      nextNotifications.push({
        id: 'weather-station',
        title: `${primaryStationsOffline.length} primary weather stations are offline`,
        description: 'Weather should be reviewed or manually overridden before planning applications.',
        severity: 'warning',
        route: '/app/weather',
      });
    }

    if (complianceGaps.length > 0) {
      nextNotifications.push({
        id: 'application-compliance',
        title: `${complianceGaps.length} application logs are missing compliance fields`,
        description: 'Finish applicator license, supervisor, or weather linkage before exporting reports.',
        severity: 'critical',
        route: '/app/applications',
      });
    }

    if (nextNotifications.length === 0) {
      nextNotifications.push({
        id: 'all-clear',
        title: 'Operations look clean',
        description: 'No urgent admin issues were detected for the current date and department.',
        severity: 'info',
        route: '/app/workboard',
      });
    }

    return nextNotifications;
  }, [currentDate, currentUser?.role, dataRefreshTick, department]);

  const handleSelectUser = (userId: string) => {
    const selected = appUsers.find((entry) => entry.id === userId);
    if (!selected) return;
    setCurrentUser(selected);
    saveCurrentAppUserId(selected.id);
    setDepartment(selected.department || programSetting?.defaultDepartment || departmentOptions[0] || 'Maintenance');
    window.dispatchEvent(new CustomEvent('user-session-updated'));
  };

  const handleSignOut = () => {
    saveCurrentAppUserId('');
    window.dispatchEvent(new CustomEvent('user-session-updated'));
    navigate('/');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebarRefined />
        <div className="flex-1 flex flex-col min-w-0">
          <WorkflowTopBar
            department={department}
            setDepartment={setDepartment}
            departments={departmentOptions}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            appUsers={appUsers}
            currentUser={currentUser ?? undefined}
            notifications={notifications}
            onSelectUser={handleSelectUser}
            onSignOut={handleSignOut}
            programSetting={programSetting ?? undefined}
          />
          {programSetting ? (
            <div
              className="border-b px-4 py-3"
              style={{
                backgroundImage: programSetting.shellImageUrl
                  ? `linear-gradient(90deg, rgba(15,23,42,0.82), rgba(15,23,42,0.58)), url(${programSetting.shellImageUrl})`
                  : `linear-gradient(90deg, ${programSetting.sidebarColor || '#203127'}, ${programSetting.primaryColor || '#2f855a'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 text-white">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
                    {programSetting.logoUrl ? (
                      <img
                        src={programSetting.logoUrl}
                        alt={`${programSetting.clientLabel || programSetting.organizationName || 'Client'} logo`}
                        className="h-12 w-12 rounded-xl object-contain"
                      />
                    ) : (
                      <span className="text-lg font-semibold">{(programSetting.logoInitials || 'WF').slice(0, 2)}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">
                      {programSetting.clientLabel || programSetting.organizationName || 'Client profile'}
                    </div>
                    <div className="brand-heading text-2xl font-semibold">
                      {programSetting.appName || 'WorkForce App'}
                    </div>
                    <div className="text-sm text-white/80">
                      {programSetting.navigationSubtitle || programSetting.organizationName || 'Operations platform'}
                    </div>
                  </div>
                </div>
                <div className="max-w-xl text-sm text-white/75">
                  {programSetting.themeNotes || 'Client branding is now active across the shell, headers, and browser identity.'}
                </div>
              </div>
            </div>
          ) : null}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
