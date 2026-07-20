import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Clock,
  Home,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  ShieldCheck,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { AppSidebarRefined } from './AppSidebarRefined';
import { WorkflowTopBar } from './WorkflowTopBar';
import { FeedbackWidget } from './FeedbackWidget';
import { CommandBar } from './CommandBar';
import { PageLoader } from './PageLoader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ProgramSettings } from '@/data/seedData';
import {
  useAssignments,
  useDepartmentOptions,
  useEmployees,
  useEquipmentUnits,
  useProperties,
  useProgramSettings,
  useScheduleEntries,
} from '@/lib/supabase-queries';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { useTheme } from '@/hooks/useTheme';
import { createClient } from '@/lib/supabase';
import { applyFontTheme, resolveEffectiveTheme, THEME_VARS_STORAGE_KEY, type CustomThemeColors } from '@/lib/colorThemes';
import { applyThemeSurfaces } from '@/lib/colorConversion';
import { cn } from '@/lib/utils';

const supabase = createClient();

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

function applyBranding(
  programSetting?: ProgramSettings,
  userOverridePresetId?: string | null,
  personalCustomColors?: CustomThemeColors | null,
  isLightMode?: boolean,
  userThemeDarknessOverride?: number | null,
) {
  if (typeof document === 'undefined') return;
  const overrideTheme = resolveEffectiveTheme(userOverridePresetId, personalCustomColors, programSetting?.fontThemePreset);
  if (!programSetting && !overrideTheme) return;
  if (programSetting) {
    document.title = `${programSetting.appName || 'Ground Crew HQ'}${programSetting.clientLabel ? ` | ${programSetting.clientLabel}` : ''}`;
  }
  // Org colours still live in the legacy program_settings columns: `base` is
  // stored in sidebar_color, `accent` in primary_color (see Phase 4).
  const base = overrideTheme?.base ?? programSetting?.sidebarColor;
  const accent = overrideTheme?.accent ?? programSetting?.primaryColor;
  const contrast = userThemeDarknessOverride ?? overrideTheme?.contrast ?? programSetting?.themeDarkness ?? 50;
  const root = document.documentElement;
  // applyThemeSurfaces owns --primary/--ring/--accent/--brand-*/--sidebar-*.
  // Previously this function and SettingsPage each set an overlapping subset by
  // hand and had drifted apart (SettingsPage never set --brand-default/bright,
  // and this copy hardcoded Segoe UI, ignoring fontThemePreset entirely).
  applyThemeSurfaces(root, { base, accent }, isLightMode ?? false, contrast);
  applyFontTheme(root, overrideTheme?.fontThemePreset ?? programSetting?.fontThemePreset);
  // Cache the resolved variables so the inline boot script in app/layout.tsx can
  // paint them before hydration. Without this the first paint uses globals.css
  // defaults and visibly flashes to the org's theme once this effect runs.
  try {
    // Stored with the mode it was computed for: the boot script only replays it
    // when the booting mode matches, so a `system` preference that flipped while
    // the app was closed can't paint the wrong mode's colours.
    window.localStorage.setItem(
      THEME_VARS_STORAGE_KEY,
      JSON.stringify({ mode: isLightMode ? 'light' : 'dark', vars: root.style.cssText }),
    );
  } catch {
    /* storage unavailable (private mode / quota) — flash-prevention is best-effort */
  }
  if (programSetting?.logoUrl) {
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
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const [department, setDepartment] = useState('All Departments');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [inAppNotifications, setInAppNotifications] = useState<AppNotification[]>([]);
  const { currentUser, currentPropertyId, currentRole, setCurrentPropertyId, orgId, signOut, isPlanActive, isOrgReady } = useOrgProfile();
  const { resolvedTheme } = useTheme();
  const [showDemoBanner, setShowDemoBanner] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('gchq-demo-banner-dismissed') !== 'true' : true));
  const [orgReadyTimeout, setOrgReadyTimeout] = useState(false);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncFlashActive, setSyncFlashActive] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const prevOrgId = useRef<string | null>(null);
  const isReadOnlyDemo = String(currentUser?.role ?? '') === 'viewer';
  const deptQuery = useDepartmentOptions(orgId);
  const todayKey = currentDate.toISOString().slice(0, 10);
  const scheduleQuery = useScheduleEntries(todayKey, currentPropertyId, orgId);
  const assignmentsQuery = useAssignments(todayKey, currentPropertyId, orgId);
  const equipmentQuery = useEquipmentUnits(currentPropertyId, orgId);
  const employeesQuery = useEmployees(currentPropertyId, orgId);
  const propertiesQuery = useProperties(orgId);
  const programSettingQuery = useProgramSettings(orgId);
  const programSetting = programSettingQuery.data ?? null;
  const properties = propertiesQuery.data ?? [];

  useEffect(() => {
    if (isOrgReady) {
      setOrgReadyTimeout(false);
      return;
    }
    setOrgReadyTimeout(false);
    const timer = window.setTimeout(() => setOrgReadyTimeout(true), 2000);
    return () => window.clearTimeout(timer);
  }, [isOrgReady]);

  useEffect(() => {
    if (orgId && orgId !== prevOrgId.current) {
      prevOrgId.current = orgId;
      void queryClient.invalidateQueries();
    }
  }, [orgId, queryClient]);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }, [pathname, queryClient]);

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: ['assignments'] });
        void queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [queryClient]);

  const latestClockEventQuery = useQuery({
    queryKey: ['employee-mobile-clock-status', orgId, currentUser?.employeeId],
    enabled: currentRole === 'employee' && Boolean(orgId && currentUser?.employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clock_events')
        .select('event_type')
        .eq('org_id', orgId!)
        .eq('employee_id', currentUser!.employeeId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.event_type ?? null;
    },
  });
  const isEmployeeClockedIn = latestClockEventQuery.data === 'clock_in';

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
    applyBranding(
      programSetting ?? undefined,
      currentUser?.themePresetOverride ?? null,
      currentUser?.themeCustomColors ?? null,
      resolvedTheme === 'light',
      currentUser?.themeDarknessOverride ?? null,
    );
  }, [currentUser?.themePresetOverride, currentUser?.themeCustomColors, currentUser?.themeDarknessOverride, programSetting, resolvedTheme]);

  const computedNotifications = useMemo(() => {
    const currentDayKey = currentDate.toISOString().slice(0, 10);
    const employees = employeesQuery.data ?? [];
    const scheduleEntries = scheduleQuery.data ?? [];
    const assignments = assignmentsQuery.data ?? [];
    const equipmentUnits = equipmentQuery.data ?? [];
    const activeEmployees = employees.filter(
      (employee) =>
        employee.status === 'active' &&
        (department === 'All Departments' || employee.department === department),
    );
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
  const planTier: 'FREE' | 'PRO' = isPlanActive() ? 'PRO' : 'FREE';

  const unreadNotificationCount = useMemo(
    () => inAppNotifications.filter((entry) => !entry.read).length,
    [inAppNotifications],
  );
  const openTaskBoardCount = useMemo(() => {
    const assignments = assignmentsQuery.data ?? [];
    return assignments.filter((assignment) => {
      const status = String(assignment.status ?? '').toLowerCase();
      return status === 'planned' || status === 'in_progress';
    }).length;
  }, [assignmentsQuery.data]);
  const chemicalComplianceQuery = useQuery({
    queryKey: ['chemical-logs-pending', orgId ?? 'no-org'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 30,
    retry: false,
    queryFn: async () => {
      try {
        if (!supabase || !orgId) return 0;
        const nowIso = new Date().toISOString();
        const { count, error } = await supabase
          .from('chemical_application_logs')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .or(`supervisor_license_number.is.null,restricted_entry_until.gt.${nowIso}`);
        if (error) {
          console.error('[CHEMICAL COMPLIANCE COUNT ERROR]', error);
          return 0;
        }
        return count ?? 0;
      } catch (error) {
        console.error('[CHEMICAL COMPLIANCE COUNT ERROR]', error);
        return 0;
      }
    },
  });
  const chemicalLogsPendingCount = chemicalComplianceQuery.data ?? 0;

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

  const handleSelectProperty = (propertyId: string) => {
    setCurrentPropertyId(propertyId);
  };

  const handleSignOut = async () => {
    queryClient.clear();
    let redirectedByFallback = false;
    const fallbackTimeoutId = window.setTimeout(() => {
      redirectedByFallback = true;
      router.replace('/');
    }, 5_000);

    try {
      window.localStorage.removeItem('ground-crew-query-cache-v3');
      window.localStorage.removeItem('ground-crew-query-cache-v2');
      window.localStorage.removeItem('ground-crew-query-cache');
    } catch { /* ignore */ }
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      window.clearTimeout(fallbackTimeoutId);
      if (!redirectedByFallback) {
        router.replace('/');
      }
    }
  };

  const markAllNotificationsRead = () => {
    setInAppNotifications((previous) => previous.map((entry) => ({ ...entry, read: true })));
  };

  const handleNotificationOpen = (route: string, id: string) => {
    setInAppNotifications((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)),
    );
    router.push(route);
  };

  const closeMobileSidebar = () => setMobileSidebarOpen(false);
  const shouldShowFeedbackWidget = !(
    pathname === '/' ||
    pathname.startsWith('/app/field')
  );
  const mobilePrimaryTabs = [
    { label: 'Field View', route: '/app/field', icon: MapPin },
    { label: 'Workflow', route: '/app/workboard', icon: ClipboardList },
    { label: 'Team', route: '/app/employees', icon: Users },
  ];
  const employeeTabs = [
    { label: 'Today', icon: Home, href: '/app/field' },
    { label: 'My Jobs', icon: ClipboardList, href: '/app/scheduler' },
    { label: 'Clock', icon: Clock, href: '/app/field?tab=clock' },
    { label: 'Messages', icon: MessageSquare, href: '/app/breakroom' },
    { label: 'Profile', icon: User, href: '/app/settings?tab=Account' },
  ];
  const mobileMoreItems = [
    { label: 'Dashboard', route: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Scheduler', route: '/app/scheduler', icon: Calendar },
    { label: 'Equipment', route: '/app/equipment', icon: Wrench },
    { label: 'Applications', route: '/app/applications', icon: ShieldCheck },
    { label: 'Safety', route: '/app/safety', icon: Shield },
    { label: 'Reports', route: '/app/reports', icon: BarChart3 },
    { label: 'Breakroom', route: '/app/breakroom', icon: LayoutDashboard },
    { label: 'Messaging', route: '/app/messaging', icon: Mail },
    { label: 'Settings', route: '/app/settings', icon: Settings },
  ];

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

      if (event.shiftKey && key === 'n' && pathname === '/app/scheduler') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('ground-crew-open-add-shift'));
        return;
      }
      if (event.shiftKey && key === 't' && pathname === '/app/workboard') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('ground-crew-open-add-task'));
        return;
      }
      if (event.shiftKey) return;

      if (key === '1') {
        event.preventDefault();
        router.push('/app/dashboard');
      } else if (key === '2') {
        event.preventDefault();
        router.push('/app/workboard');
      } else if (key === '3') {
        event.preventDefault();
        router.push('/app/scheduler');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pathname, router, shortcutsOverlayOpen]);

  if (!isOrgReady && !orgReadyTimeout) {
    return <PageLoader />;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-surface-base">
        {isReadOnlyDemo && showDemoBanner ? (
          <div className="fixed inset-x-0 top-0 z-50 h-9 bg-status-complete text-text-primary">
            <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-3 text-xs md:px-4">
              <div>
                Demo Mode — Viewing sample data (read-only).{' '}
                <button type="button" className="underline underline-offset-2" onClick={() => router.push('/')}>
                  Sign Up
                </button>
              </div>
              <button
                type="button"
                className="ml-3 rounded px-2 py-0.5 hover:bg-text-primary/20"
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
        {mobileSidebarOpen && currentRole !== 'employee' ? (
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
          className={`fixed left-0 top-0 z-40 h-screen w-60 flex-col overflow-hidden border-r border-surface-border bg-surface-base transition-transform duration-200 ease-in-out ${
            currentRole === 'employee' ? 'hidden md:flex' : 'flex'
          } ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
            <AppSidebarRefined
              onNavigate={closeMobileSidebar}
              taskBoardBadgeCount={openTaskBoardCount}
              chemicalLogsBadgeCount={chemicalLogsPendingCount}
            />
        </div>
        <div className={`ml-0 md:ml-60 overflow-y-auto overflow-x-hidden flex min-w-0 flex-1 flex-col ${isReadOnlyDemo && showDemoBanner ? 'pt-9' : ''}`}>
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
            <main className="flex flex-1 flex-col h-full min-h-0 bg-surface-base pb-20 page-enter md:pb-0">
              {isOffline ? (
                <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-900">
                  ⚡ You're offline — changes will sync when connected
                </div>
              ) : null}
              <div className="border-b border-surface-border bg-surface-base/60 px-4 py-2 md:hidden">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Workflow Date</div>
                <div className="text-sm font-medium text-text-secondary">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              {children}
            </main>
            {shouldShowFeedbackWidget ? <FeedbackWidget pagePath={pathname} /> : null}
            <CommandBar
              open={commandBarOpen}
              onOpenChange={setCommandBarOpen}
              currentDate={currentDate}
              currentPropertyId={currentPropertyId}
            />
            <nav
              className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-border bg-surface-base/95 backdrop-blur-md md:hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {currentRole === 'employee' ? (
                <div className="grid h-16 grid-cols-5">
                  {employeeTabs.map((tab) => {
                    const [tabPath, tabSearch = ''] = tab.href.split('?');
                    const requiredSearch = new URLSearchParams(tabSearch);
                    const currentSearch = new URLSearchParams(searchParams?.toString() ?? '');
                    const hasRequiredSearch = [...requiredSearch.entries()].every(
                      ([key, value]) => currentSearch.get(key) === value,
                    );
                    const isActive = pathname === tabPath
                      && (tabSearch ? hasRequiredSearch : !currentSearch.has('tab'));
                    const isClockTab = tab.label === 'Clock';

                    return (
                      <button
                        key={tab.href}
                        type="button"
                        onClick={() => router.push(tab.href)}
                        className={cn(
                          'relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                          isActive ? 'text-brand' : 'text-text-muted hover:text-text-primary',
                        )}
                      >
                        {isActive ? <span className="absolute top-1 h-0.5 w-5 rounded-full bg-brand" /> : null}
                        <tab.icon
                          className={cn(
                            'h-5 w-5',
                            isClockTab && isEmployeeClockedIn ? 'text-brand-bright' : undefined,
                          )}
                        />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid h-16 grid-cols-5">
                  {mobilePrimaryTabs.map((tab) => {
                    const isActive = pathname === tab.route;
                    return (
                      <button
                        key={tab.route}
                        type="button"
                        onClick={() => router.push(tab.route)}
                        className={cn(
                          'relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                          isActive ? 'text-brand' : 'text-text-muted hover:text-text-primary',
                        )}
                      >
                        {isActive ? <span className="absolute top-1 h-0.5 w-5 rounded-full bg-brand" /> : null}
                        <tab.icon className="h-5 w-5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setMobileMoreOpen(true)}
                    className="flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs text-text-muted transition-colors hover:text-text-primary"
                  >
                    <Menu className="h-5 w-5" />
                    <span>More</span>
                  </button>
                </div>
              )}
            </nav>
            <Sheet open={currentRole !== 'employee' && mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
              <SheetContent side="bottom" className="max-h-[75vh] rounded-t-lg border-surface-border bg-surface-elevated">
                <SheetHeader>
                  <SheetTitle className="text-text-primary">More</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid gap-2 pb-4">
                  {mobileMoreItems.map((item) => (
                    <button
                      key={item.route}
                      type="button"
                      onClick={() => {
                        router.push(item.route);
                        setMobileMoreOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                        pathname === item.route
                          ? 'border-brand-dim bg-brand-ghost text-brand'
                          : 'border-surface-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                      {item.label === 'Workflow' && openTaskBoardCount > 0 ? (
                        <span className="ml-auto rounded-full bg-status-pending px-1.5 py-0.5 text-xs font-semibold text-text-inverse">
                          {openTaskBoardCount}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
        </div>
      </div>
    </SidebarProvider>
  );
}


