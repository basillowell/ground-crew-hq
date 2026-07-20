import { memo, useState } from 'react';
import { Bell, CalendarClock, CalendarDays, ClipboardList, Menu, Wrench } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AppNotification } from './AppLayout';
import type { ProgramSettings, Property } from '@/data/seedData';

interface WorkflowTopBarProps {
  department: string;
  setDepartment: (d: string) => void;
  departments: string[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  properties: Property[];
  currentPropertyId: string;
  onSelectProperty: (propertyId: string) => void;
  allowAllProperties?: boolean;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  pendingSyncCount?: number;
  syncFlashActive?: boolean;
  onMarkAllNotificationsRead: () => void;
  onOpenNotification: (route: string, id: string) => void;
  onOpenMobileSidebar: () => void;
  onSignOut: () => void;
  programSetting?: ProgramSettings;
  planTier?: 'FREE' | 'PRO';
  onOpenCommandBar?: () => void;
}

type RouteTitle = {
  title: string;
  subtitle: string;
};

const routeTitles: Record<string, RouteTitle> = {
  '/app': { title: 'Command Center', subtitle: 'Cross-property operations at a glance' },
  '/app/dashboard': { title: 'Command Center', subtitle: 'Cross-property operations at a glance' },
  '/app/dispatch': { title: 'Dispatch', subtitle: "Today's crew assignments" },
  '/app/workboard': { title: 'Workflow', subtitle: 'Assign tasks and manage daily operations.' },
  '/app/scheduler': { title: 'Scheduler', subtitle: 'Manage employee shifts.' },
  '/app/employees': { title: 'Team', subtitle: 'Manage your crew roster.' },
  '/app/equipment': { title: 'Equipment', subtitle: 'Track maintenance and availability.' },
  '/app/invoicing': { title: 'Invoicing', subtitle: 'Manage and track invoices.' },
  '/app/reports': { title: 'Reports', subtitle: 'Labor summaries and cost analysis.' },
  '/app/job-costing': { title: 'Job Costing', subtitle: 'Labor cost and margin analysis.' },
  '/app/applications': { title: 'Applications', subtitle: 'Chemical logging with tank mix and site condition detail.' },
  '/app/breakroom': { title: 'Breakroom', subtitle: 'Share updates with your team.' },
  '/app/messaging': { title: 'Messaging', subtitle: 'Compose and send a message to your crew.' },
  '/app/tasks': { title: 'Task Management', subtitle: 'Task library for Workflow assignment and operations planning.' },
  '/app/safety': { title: 'Safety', subtitle: 'Toolbox talks and compliance records.' },
  '/app/settings': { title: 'Settings', subtitle: 'Workspace settings' },
  '/app/field': { title: 'Field', subtitle: "Mobile workspace for today's work" },
};

const settingsTabs = ['Operations', 'Tasks', 'Equipment', 'Workforce', 'SOPs', 'Account', 'Help'] as const;
type SettingsTab = (typeof settingsTabs)[number];

function getRouteTitle(pathname: string): RouteTitle {
  const normalizedPath = pathname.split('?')[0] || '/app';
  const matchingRoute = Object.keys(routeTitles)
    .sort((first, second) => second.length - first.length)
    .find((route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`));

  return matchingRoute ? routeTitles[matchingRoute] : { title: 'Ground Crew HQ', subtitle: 'Operations workspace' };
}

function getSettingsTab(value: string | null): SettingsTab {
  return settingsTabs.includes(value as SettingsTab) ? (value as SettingsTab) : 'Operations';
}

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export const WorkflowTopBar = memo(function WorkflowTopBar({
  currentDate,
  setCurrentDate,
  properties,
  currentPropertyId,
  onSelectProperty,
  allowAllProperties = false,
  notifications,
  unreadNotificationCount,
  pendingSyncCount = 0,
  syncFlashActive = false,
  onMarkAllNotificationsRead,
  onOpenNotification,
  onOpenMobileSidebar,
  programSetting,
}: WorkflowTopBarProps) {
  const pathname = usePathname() ?? '/app';
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageTitle = getRouteTitle(pathname);
  const isSettingsRoute = pathname === '/app/settings' || pathname.startsWith('/app/settings/');
  const activeSettingsTab = getSettingsTab(searchParams.get('tab'));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selectedProperty = properties.find((property) => property.id === currentPropertyId);
  const selectedPropertyName = currentPropertyId === 'all' ? 'All Properties' : selectedProperty?.name ?? 'Select property';
  const canSwitchProperties = allowAllProperties || properties.length > 1;
  const formatTimestamp = (isoTimestamp: string) =>
    new Date(isoTimestamp).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });

  const updateSettingsTab = (nextTab: SettingsTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('tab', nextTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const getNotificationIcon = (icon: AppNotification['icon']) => {
    if (icon === 'task') return <ClipboardList className="h-3.5 w-3.5 text-blue-600" />;
    if (icon === 'equipment') return <Wrench className="h-3.5 w-3.5 text-amber-600" />;
    return <CalendarClock className="h-3.5 w-3.5 text-emerald-600" />;
  };
  const bellBadgeLabel = pendingSyncCount > 0 ? `${pendingSyncCount} pending syncs` : String(unreadNotificationCount);

  return (
    <header className={`sticky top-0 z-20 shrink-0 border-b border-surface-border bg-surface-base/80 px-3 py-3 backdrop-blur-md ${isSettingsRoute ? 'md:h-[104px]' : 'md:h-[85px]'}`}>
      <div className="flex h-full items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-text-muted hover:bg-surface-hover hover:text-text-primary md:hidden" onClick={onOpenMobileSidebar} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <div className="min-w-0 shrink-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-text-primary">{pageTitle.title}</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{pageTitle.subtitle}</p>
          </div>

          {isSettingsRoute ? (
            <nav className="scrollbar-hide flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Settings sections">
              {settingsTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => updateSettingsTab(tab)}
                  className={`h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors ${
                    activeSettingsTab === tab
                      ? 'bg-surface-hover text-brand ring-1 ring-brand/30'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <div className="hidden min-w-[220px] lg:block">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Property</div>
            {canSwitchProperties ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="mt-1 h-10 w-full justify-between rounded-xl border-surface-border bg-surface-card/80 px-3 text-left font-medium text-text-primary hover:bg-surface-elevated/80 hover:text-text-primary">
                    <span className="truncate">{selectedPropertyName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Property</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allowAllProperties ? (
                    <DropdownMenuItem onClick={() => onSelectProperty('all')} className={currentPropertyId === 'all' ? 'bg-surface-hover font-medium text-brand' : undefined}>
                      All Properties
                    </DropdownMenuItem>
                  ) : null}
                  {properties.map((property) => (
                    <DropdownMenuItem
                      key={property.id}
                      onClick={() => onSelectProperty(property.id)}
                      className={currentPropertyId === property.id ? 'bg-surface-hover font-medium text-brand' : undefined}
                    >
                      {property.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="mt-1 flex h-10 items-center rounded-xl border border-surface-border bg-surface-card/80 px-3 text-sm font-medium text-text-primary">
                <span className="truncate">{selectedPropertyName}</span>
              </div>
            )}
          </div>
          <div className="hidden min-w-[250px] lg:block">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Workflow Date</div>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="mt-1 h-10 w-full justify-between rounded-xl border-surface-border bg-surface-card/80 px-3 text-left font-medium text-text-primary hover:bg-surface-elevated/80 hover:text-text-primary">
                  <span>{formatDate(currentDate)}</span>
                  <CalendarDays className="h-4 w-4 text-text-muted" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => {
                    if (!date) return;
                    setCurrentDate(date);
                    setDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu onOpenChange={(open) => open && onMarkAllNotificationsRead()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full border border-transparent text-text-muted hover:border-surface-border hover:bg-surface-hover hover:text-text-primary" aria-label="Open notifications">
                <Bell className="h-4 w-4" />
                <span
                  className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    syncFlashActive ? 'bg-brand text-text-inverse' : 'bg-red-500 text-text-primary'
                  } ${bellBadgeLabel === '0' ? 'hidden' : ''}`}
                >
                  {bellBadgeLabel}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <span className="text-[11px] font-normal text-muted-foreground">{programSetting?.clientLabel || 'Active club'}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`items-start gap-3 py-3 ${notification.read ? 'opacity-75' : 'bg-muted/20'}`}
                  onClick={() => onOpenNotification(notification.route, notification.id)}
                >
                  <div className="mt-0.5">{getNotificationIcon(notification.icon)}</div>
                  <div
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      notification.severity === 'critical'
                        ? 'bg-red-500'
                        : notification.severity === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-brand'
                    }`}
                  />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{notification.title}</div>
                    <div className="text-xs text-muted-foreground">{notification.description}</div>
                    <div className="text-[11px] text-muted-foreground">{formatTimestamp(notification.timestamp)}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </header>
  );
});
