import { memo } from 'react';
import { Bell, CalendarDays, ClipboardList, LogOut, Wrench, CalendarClock, Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/contexts/AuthContext';

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

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export const WorkflowTopBar = memo(function WorkflowTopBar({
  department,
  setDepartment,
  departments,
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
  onSignOut,
  programSetting,
  planTier = 'FREE',
  onOpenCommandBar,
}: WorkflowTopBarProps) {
  const { currentUser } = useAuth();
  const firstName = (currentUser as { firstName?: string } | null)?.firstName ?? currentUser?.fullName?.split(' ')[0] ?? '';
  const lastName = (currentUser as { lastName?: string } | null)?.lastName ?? currentUser?.fullName?.split(' ').slice(1).join(' ') ?? '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || currentUser?.fullName || 'WorkForce User';
  const displayRole = (currentUser?.role || 'admin').toUpperCase();
  const today = () => setCurrentDate(new Date());
  const sameDayAsToday = currentDate.toDateString() === new Date().toDateString();
  const formatTimestamp = (isoTimestamp: string) =>
    new Date(isoTimestamp).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });

  const getNotificationIcon = (icon: AppNotification['icon']) => {
    if (icon === 'task') return <ClipboardList className="h-3.5 w-3.5 text-blue-600" />;
    if (icon === 'equipment') return <Wrench className="h-3.5 w-3.5 text-amber-600" />;
    return <CalendarClock className="h-3.5 w-3.5 text-emerald-600" />;
  };
  const showAllPropertiesOption = allowAllProperties && properties.length > 1;
  const allPropertiesLabel = `All Properties (${properties.length})`;
  const bellBadgeLabel = pendingSyncCount > 0 ? `${pendingSyncCount} pending syncs` : String(unreadNotificationCount);

  const rolePillLabel = displayRole === 'MANAGER' ? 'Supervisor' : displayRole === 'ADMIN' ? 'Admin' : 'Field Crew';

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-white/[0.08] bg-[#0f1a14]/80 px-3 py-2 backdrop-blur-md">
      <div className="flex items-center gap-2 md:gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:bg-white/5 hover:text-slate-100 md:hidden" onClick={onOpenMobileSidebar} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden md:block">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="h-9 w-[170px] rounded-lg border-white/[0.10] bg-[#1a2d1f]/80 text-sm text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Departments">All Departments</SelectItem>
              {departments.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 flex-1 md:flex-none">
          <Select value={currentPropertyId} onValueChange={onSelectProperty}>
            <SelectTrigger className="h-9 w-full rounded-lg border-white/[0.10] bg-[#1a2d1f]/80 text-sm text-slate-200 md:w-[190px]">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {showAllPropertiesOption ? (
                <SelectItem value="all">{allPropertiesLabel}</SelectItem>
              ) : null}
              {properties.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden min-w-[250px] md:block">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow Date</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="mt-1 h-10 w-full justify-between rounded-xl border-white/[0.10] bg-[#1a2d1f]/80 px-3 text-left font-medium text-slate-200 hover:bg-[#243828]/80 hover:text-slate-100">
                <span>{formatDate(currentDate)}</span>
                <CalendarDays className="h-4 w-4 text-slate-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={(date) => date && setCurrentDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button variant="outline" size="sm" className="hidden h-9 rounded-xl border-white/[0.10] bg-[#1a2d1f]/80 text-xs text-slate-300 hover:bg-[#243828]/80 hover:text-slate-100 md:inline-flex" onClick={today}>
          {sameDayAsToday ? 'Today Selected' : 'Jump to Today'}
        </Button>

        {programSetting?.clientLabel ? (
          <span className="hidden rounded-full border border-white/[0.08] bg-[#1a2d1f]/60 px-3 py-1 text-[11px] text-slate-400 lg:inline-flex">
            {programSetting.clientLabel}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu onOpenChange={(open) => open && onMarkAllNotificationsRead()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-100">
                <Bell className="h-4 w-4" />
                <span
                  className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    syncFlashActive ? 'bg-lime-400 text-black' : 'bg-red-500 text-white'
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
                          : 'bg-lime-400'
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

          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 rounded-xl border-white/[0.10] bg-[#1a2d1f]/80 text-xs text-slate-300 hover:bg-[#243828]/80 hover:text-slate-100 md:inline-flex"
            onClick={onOpenCommandBar}
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Ask anything
          </Button>

          <div className="hidden text-right md:block">
            <div className="flex items-center justify-end gap-2">
              <div className="text-sm font-semibold text-slate-100">{displayName}</div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  planTier === 'PRO' ? 'bg-lime-400/10 text-lime-400' : 'bg-white/[0.06] text-slate-500'
                }`}
              >
                {planTier}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="rounded-full bg-[#243828] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                {rolePillLabel}
              </span>
            </div>
          </div>

          {/* Mobile avatar */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#243828] text-xs font-semibold text-lime-400 ring-1 ring-lime-400/20 transition-colors duration-200 hover:ring-lime-400/40 md:hidden"
            onClick={onSignOut}
            aria-label="Account"
          >
            {displayName.slice(0, 1).toUpperCase()}
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 rounded-full text-slate-400 hover:bg-white/5 hover:text-slate-100 md:inline-flex"
            onClick={onSignOut}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
});
