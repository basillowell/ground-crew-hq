import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebarRefined } from './AppSidebarRefined';
import { WorkflowTopBar } from './WorkflowTopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { ProgramSettings } from '@/data/seedData';
import {
  useAssignments,
  useChemicalApplicationLogs,
  useEmployees,
  useEquipmentUnits,
  useProgramSettings,
  useProperties,
  useScheduleEntries,
  useWeatherStations,
} from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

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
  const { currentUser, currentPropertyId, setCurrentPropertyId, signOut, isAdmin, isManager } = useAuth();
  const programSettingsQuery = useProgramSettings();
  const propertiesQuery = useProperties();
  const todayKey = currentDate.toISOString().slice(0, 10);
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const employeesQuery = useEmployees(propertyScope);
  const scheduleEntriesQuery = useScheduleEntries(todayKey, propertyScope);
  const assignmentsQuery = useAssignments(todayKey, propertyScope);
  const equipmentUnitsQuery = useEquipmentUnits(propertyScope);
  const weatherStationsQuery = useWeatherStations();
  const chemicalApplicationLogsQuery = useChemicalApplicationLogs(todayKey);

  const programSetting = programSettingsQuery.data ?? null;
  const allProperties = propertiesQuery.data ?? [];
  const properties = useMemo(() => {
    if (isAdmin || isManager) return allProperties;
    if (!currentUser?.propertyId) return [];
    return allProperties.filter((entry) => entry.id === currentUser.propertyId);
  }, [allProperties, currentUser?.propertyId, isAdmin, isManager]);
  const employees = employeesQuery.data ?? [];
  const scheduleEntries = scheduleEntriesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const equipmentUnits = equipmentUnitsQuery.data ?? [];
  const weatherStations = weatherStationsQuery.data ?? [];
  const applicationLogs = chemicalApplicationLogsQuery.data ?? [];

  useEffect(() => {
    if (isAdmin || isManager) {
      if (!currentPropertyId) {
        setCurrentPropertyId('all');
      }
      return;
    }
    const fallbackProperty = properties.find((entry) => entry.status === 'active') || properties[0] || null;
    const resolvedProperty = properties.find((entry) => entry.id === currentPropertyId) || fallbackProperty || null;
    if (resolvedProperty?.id && resolvedProperty.id !== currentPropertyId) {
      setCurrentPropertyId(resolvedProperty.id);
    }
  }, [currentPropertyId, isAdmin, isManager, properties, setCurrentPropertyId]);

  useEffect(() => {
    const derivedDepartments = [...new Set([
      ...(programSetting?.defaultDepartment ? [programSetting.defaultDepartment] : []),
      ...employees.map((employee) => employee.department).filter(Boolean),
      ...(currentUser?.department ? [currentUser.department] : []),
    ])];
    const nextDepartmentOptions = derivedDepartments.length > 0 ? derivedDepartments : ['Maintenance'];
    setDepartmentOptions(nextDepartmentOptions);
    setDepartment((currentDepartment) => {
      if (currentUser?.department) return currentUser.department;
      if (nextDepartmentOptions.includes(currentDepartment)) return currentDepartment;
      return nextDepartmentOptions[0] ?? 'Maintenance';
    });
  }, [currentUser?.department, employees, programSetting?.defaultDepartment]);

  useEffect(() => {
    applyBranding(programSetting ?? undefined);
  }, [programSetting]);

  const notifications = useMemo(() => {
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
  }, [applicationLogs, assignments, currentUser?.role, department, employees, equipmentUnits, scheduleEntries, todayKey, weatherStations]);

  const handleSelectProperty = (propertyId: string) => {
    setCurrentPropertyId(propertyId);
  };

  const handleSignOut = async () => {
    await signOut();
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
            properties={properties}
            currentPropertyId={currentPropertyId}
            onSelectProperty={handleSelectProperty}
            allowAllProperties={isAdmin || isManager}
            appUsers={currentUser ? [{
              id: currentUser.appUserId,
              fullName: currentUser.fullName,
              email: currentUser.email,
              role: currentUser.role === 'employee' ? 'crew' : currentUser.role,
              title: currentUser.title,
              department: currentUser.department,
              clubId: currentUser.propertyId || 'default-property',
              clubLabel: programSetting?.clientLabel || 'Client profile',
              avatarInitials: currentUser.fullName.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() || 'WF',
              status: 'active',
            }] : []}
            currentUser={currentUser ? {
              id: currentUser.appUserId,
              fullName: currentUser.fullName,
              email: currentUser.email,
              role: currentUser.role === 'employee' ? 'crew' : currentUser.role,
              title: currentUser.title,
              department: currentUser.department,
              clubId: currentUser.propertyId || 'default-property',
              clubLabel: programSetting?.clientLabel || 'Client profile',
              avatarInitials: currentUser.fullName.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() || 'WF',
              status: 'active',
            } : undefined}
            notifications={notifications}
            onSelectUser={() => {}}
            onSignOut={handleSignOut}
            programSetting={programSetting ?? undefined}
          />
          <main className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,248,1))]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
