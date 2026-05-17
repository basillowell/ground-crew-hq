import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppSidebarRefined } from './AppSidebarRefined';
import { WorkflowTopBar } from './WorkflowTopBar';
import { FeedbackWidget } from './FeedbackWidget';
import { CommandBar } from './CommandBar';
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
import { supabase } from '@/lib/supabase';
import { isPro } from '@/utils/planGating';

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [department, setDepartment] = useState('Maintenance');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [inAppNotifications, setInAppNotifications] = useState<AppNotification[]>([]);
  const { currentUser, currentPropertyId, setCurrentPropertyId, signOut, orgId } = useAuth();
  const [showDemoBanner, setShowDemoBanner] = useState(() => sessionStorage.getItem('gchq-demo-banner-dismissed') !== 'true');
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncFlashActive, setSyncFlashActive] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const isReadOnlyDemo = String(currentUser?.role ?? '') === 'viewer';
  const programSettingQuery = useProgramSettings(orgId);
  const propertiesQuery = useProperties(orgId);
  const deptQuery = useDepartmentOptions();
  const todayKey = currentDate.toISOString().slice(0, 10);
  const employeesQuery = useEmployees(currentPropertyId, orgId);
  const scheduleQuery = useScheduleEntries(todayKey, currentPropertyId, orgId);
  const assignmentsQuery = useAssignments(todayKey, currentPropertyId, orgId);
  const equipmentQuery = useEquipmentUnits(currentPropertyId, orgId);

  const programSetting = programSettingQuery.data ?? null;
  const properties = propertiesQuery.data ?? [];

  useEffect(() => {
    if (!properties.length) return;
    if (properties.length === 1 && currentPropertyId !== properties[0].id) {
      setCurrentPropertyId(properties[0].id);
      return;
    }
    if (!currentPropertyId) {
      if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
        setCurrentPropertyId('all');
      } else {
        setCurrentPropertyId(properties[0].id);
      }
    }
  }, [currentPropertyId, currentUser?.role, properties, setCurrentPropertyId]);

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
  const planTier: 'FREE' | 'PRO' = isPro(subscriptionStatus) ? 'PRO' : 'FREE';

  const unreadNotificationCount = useMemo(
    () => inAppNotifications.filter((entry) => !entry.read).length,
    [inAppNotifications],
  );

  useEffect(() => {
    const readPendingSyncCount = () => {
      try {
        const raw = window.localStorage.getItem('field-sync-queue');
        if (!raw) return 0;
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    };

    const updatePendingCount = () => setPendingSyncCount(readPendingSyncCount());
    updatePendingCount();

    const onQueueChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === 'number') {
        setPendingSyncCount(detail.count);
      } else {
        updatePendingCount();
      }
    };
    const onSyncComplete = () => {
      setPendingSyncCount(0);
      setSyncFlashActive(true);
      window.setTimeout(() => setSyncFlashActive(false), 1200);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'field-sync-queue') updatePendingCount();
    };
    const onOnline = () => {
      setIsOffline(false);
      void queryClient.invalidateQueries();
    };
    const onOffline = () => setIsOffline(true);

    window.addEventListener('ground-crew-sync-queue-changed', onQueueChanged as EventListener);
    window.addEventListener('ground-crew-sync-complete', onSyncComplete as EventListener);
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('ground-crew-sync-queue-changed', onQueueChanged as EventListener);
      window.removeEventListener('ground-crew-sync-complete', onSyncComplete as EventListener);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [queryClient]);

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!supabase || !orgId) return;
      const { data } = await supabase
        .from('organizations')
        .select('subscription_status')
        .eq('id', orgId)
        .maybeSingle();
      setSubscriptionStatus(data?.subscription_status ? String(data.subscription_status) : null);
    };
    void fetchSubscriptionStatus();
  }, [orgId]);

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
  const shouldShowFeedbackWidget = !(
    location.pathname === '/' ||
    location.pathname.startsWith('/app/field')
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };

    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (key === '?') {
        event.preventDefault();
        setShortcutsOverlayOpen((current) => !current);
        return;
      }

      if (key === 'escape') {
        if (shortcutsOverlayOpen) {
          event.preventDefault();
          setShortcutsOverlayOpen(false);
        }
        window.dispatchEvent(new CustomEvent('ground-crew-close-modals'));
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;
      if (key === 'k') {
        event.preventDefault();
        setCommandBarOpen(true);
        return;
      }

      if (event.shiftKey && key === 'n' && location.pathname === '/app/scheduler') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('ground-crew-open-add-shift'));
        return;
      }
      if (event.shiftKey && key === 't' && location.pathname === '/app/workboard') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('ground-crew-open-add-task'));
        return;
      }
      if (event.shiftKey) return;

      if (key === '1') {
        event.preventDefault();
        navigate('/app/dashboard');
      } else if (key === '2') {
        event.preventDefault();
        navigate('/app/workboard');
      } else if (key === '3') {
        event.preventDefault();
        navigate('/app/scheduler');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [location.pathname, navigate, shortcutsOverlayOpen]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {isReadOnlyDemo && showDemoBanner ? (
          <div className="fixed inset-x-0 top-0 z-50 h-9 bg-blue-600 text-white">
            <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-3 text-xs md:px-4">
              <div>
                Demo Mode — Viewing sample data (read-only).{' '}
                <button type="button" className="underline underline-offset-2" onClick={() => navigate('/')}>
                  Sign Up
                </button>
              </div>
              <button
                type="button"
                className="ml-3 rounded px-2 py-0.5 hover:bg-white/20"
                onClick={() => {
                  sessionStorage.setItem('gchq-demo-banner-dismissed', 'true');
                  setShowDemoBanner(false);
                }}
                aria-label="Dismiss demo banner"
              >
                ×
              </button>
            </div>
          </div>
        ) : null}
        {mobileSidebarOpen ? (
          <button
            type="button"
            aria-label="Close menu backdrop"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={closeMobileSidebar}
          />
        ) : null}
        {shortcutsOverlayOpen ? (
          <div className="fixed inset-0 z-[75] bg-black/40" onClick={() => setShortcutsOverlayOpen(false)}>
            <div
              className="absolute right-4 top-16 w-[320px] rounded-xl border bg-popover p-4 text-sm shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="mb-2 text-sm font-semibold">Keyboard Shortcuts</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li><span className="font-medium text-foreground">Ctrl+1</span> Dashboard</li>
                <li><span className="font-medium text-foreground">Ctrl+2</span> Workboard</li>
                <li><span className="font-medium text-foreground">Ctrl+3</span> Scheduler</li>
                <li><span className="font-medium text-foreground">Ctrl+Shift+N</span> Add Shift (Scheduler)</li>
                <li><span className="font-medium text-foreground">Ctrl+Shift+T</span> Add Task (Workboard)</li>
                <li><span className="font-medium text-foreground">Esc</span> Close open modal</li>
                <li><span className="font-medium text-foreground">?</span> Toggle this help</li>
              </ul>
            </div>
          </div>
        ) : null}
        <div
          className={`fixed top-0 left-0 h-screen w-60 overflow-y-auto z-40 bg-sidebar border-r flex flex-col transform transition-transform duration-200 ease-in-out ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <AppSidebarRefined onNavigate={closeMobileSidebar} />
        </div>
        <div className={`ml-0 md:ml-60 min-h-screen overflow-y-auto flex min-w-0 flex-1 flex-col ${isReadOnlyDemo && showDemoBanner ? 'pt-9' : ''}`}>
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
            pendingSyncCount={pendingSyncCount}
            syncFlashActive={syncFlashActive}
            onMarkAllNotificationsRead={markAllNotificationsRead}
            onOpenNotification={handleNotificationOpen}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            onSignOut={handleSignOut}
            programSetting={programSetting ?? undefined}
            planTier={planTier}
            onOpenCommandBar={() => setCommandBarOpen(true)}
          />
          <OperationsProvider
            value={{
              currentDate,
              setCurrentDate,
              department,
              setDepartment,
            }}
          >
            <main className="flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,246,1))]">
              {isOffline ? (
                <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-900">
                  ⚡ You're offline — changes will sync when connected
                </div>
              ) : null}
              <div className="md:hidden border-b bg-background/85 px-4 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workflow Date</div>
                <div className="text-sm font-medium text-foreground">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              {children}
            </main>
            {shouldShowFeedbackWidget ? <FeedbackWidget pagePath={location.pathname} /> : null}
            <CommandBar
              open={commandBarOpen}
              onOpenChange={setCommandBarOpen}
              currentDate={currentDate}
              currentPropertyId={currentPropertyId}
            />
          </OperationsProvider>
        </div>
      </div>
    </SidebarProvider>
  );
}
