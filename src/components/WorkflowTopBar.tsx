import { memo } from 'react';
import { Bell, CalendarDays, LogOut, ShieldCheck } from 'lucide-react';
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
import type { AppUser, ProgramSettings, Property } from '@/data/seedData';

interface WorkflowTopBarProps {
  department: string;
  setDepartment: (d: string) => void;
  departments: string[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  properties: Property[];
  currentPropertyId: string;
  onSelectProperty: (propertyId: string) => void;
  appUsers: AppUser[];
  currentUser?: AppUser;
  notifications: AppNotification[];
  onSelectUser: (userId: string) => void;
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
  appUsers,
  currentUser,
  notifications,
  onSelectUser,
  onSignOut,
  programSetting,
}: WorkflowTopBarProps) {
  const navigate = useNavigate();
  const today = () => setCurrentDate(new Date());
  const sameDayAsToday = currentDate.toDateString() === new Date().toDateString();

  return (
    <header className="border-b bg-card px-3 py-2 shrink-0">
      <div className="flex flex-wrap items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />

        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="h-9 w-[170px] text-sm">
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
          <SelectTrigger className="h-9 w-[190px] text-sm">
            <SelectValue placeholder="Select property" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="min-w-[250px]">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Workflow Date</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="mt-1 h-10 w-full justify-between rounded-xl px-3 text-left font-medium">
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

        <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs" onClick={today}>
          {sameDayAsToday ? 'Today Selected' : 'Jump to Today'}
        </Button>

        {programSetting?.clientLabel ? (
          <Badge variant="outline" className="hidden rounded-full px-3 py-1 text-[11px] lg:inline-flex">
            {programSetting.clientLabel}
          </Badge>
        ) : null}

        <div className="flex-1" />

        <div className="hidden text-right xl:block">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Active Profile</div>
          <div className="text-sm font-medium">{currentUser?.fullName || 'Select User'}</div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative rounded-full">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 rounded-full px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <span className="text-xs font-semibold text-primary-foreground">
                  {(currentUser?.avatarInitials || 'WF').slice(0, 2)}
                </span>
              </div>
              <div className="hidden text-left md:block">
                <div className="text-xs font-semibold leading-none">{currentUser?.fullName || 'Select User'}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{currentUser?.title || 'Launch profile'}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div>
                  <div>{currentUser?.fullName || 'WorkForce User'}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">
                    {(currentUser?.role || 'admin').toUpperCase()} · {currentUser?.clubLabel || programSetting?.clientLabel || 'Client profile'}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {appUsers.map((user) => (
              <DropdownMenuItem key={user.id} onClick={() => onSelectUser(user.id)} className="justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold">
                    {user.avatarInitials.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm">{user.fullName}</div>
                    <div className="text-[11px] text-muted-foreground">{user.title}</div>
                  </div>
                </div>
                {currentUser?.id === user.id ? <Badge variant="secondary">Active</Badge> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="gap-2 text-red-600 focus:text-red-700">
              <LogOut className="h-4 w-4" />
              Return to Launch Screen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});
