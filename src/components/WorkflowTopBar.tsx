import { memo } from 'react';
import { Bell, CalendarDays, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
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
  onSignOut: () => void;
  programSetting?: ProgramSettings;
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
  onSignOut,
  programSetting,
}: WorkflowTopBarProps) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const firstName = (currentUser as { firstName?: string } | null)?.firstName ?? currentUser?.fullName?.split(' ')[0] ?? '';
  const lastName = (currentUser as { lastName?: string } | null)?.lastName ?? currentUser?.fullName?.split(' ').slice(1).join(' ') ?? '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || currentUser?.fullName || 'WorkForce User';
  const displayRole = (currentUser?.role || 'admin').toUpperCase();
  const today = () => setCurrentDate(new Date());
  const sameDayAsToday = currentDate.toDateString() === new Date().toDateString();
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-border/80 bg-card/92 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="flex flex-wrap items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="h-9 w-[170px] rounded-lg border-border/80 bg-background/90 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {departments.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {entry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentPropertyId} onValueChange={onSelectProperty}>
          <SelectTrigger className="h-9 w-[190px] rounded-lg border-border/80 bg-background/90 text-sm">
            <SelectValue placeholder="Select property" />
          </SelectTrigger>
          <SelectContent>
            {allowAllProperties ? (
              <SelectItem value="all">All Properties</SelectItem>
            ) : null}
            {properties.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="min-w-[250px]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workflow Date</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="mt-1 h-10 w-full justify-between rounded-xl border-border/80 bg-background/90 px-3 text-left font-medium">
                <span>{formatDate(currentDate)}</span>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
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

        <Button variant="outline" size="sm" className="h-9 rounded-xl border-border/80 bg-background/90 text-xs" onClick={today}>
          {sameDayAsToday ? 'Today Selected' : 'Jump to Today'}
        </Button>

        {programSetting?.clientLabel ? (
          <Badge variant="outline" className="hidden rounded-full px-3 py-1 text-[11px] lg:inline-flex">
            {programSetting.clientLabel}
          </Badge>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full border border-transparent hover:border-border/70 hover:bg-muted/50">
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]">
                {notifications.length}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Admin Notifications</span>
              <span className="text-[11px] font-normal text-muted-foreground">{programSetting?.clientLabel || 'Active club'}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} className="items-start gap-3 py-3" onClick={() => navigate(notification.route)}>
                <div
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    notification.severity === 'critical'
                      ? 'bg-red-500'
                      : notification.severity === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium">{notification.title}</div>
                  <div className="text-xs text-muted-foreground">{notification.description}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {notification.route.replace('/app/', '')}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <div className="hidden text-right md:block">
          <div className="text-sm font-semibold text-foreground">{displayName}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{displayRole}</div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          onClick={onSignOut}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
});
