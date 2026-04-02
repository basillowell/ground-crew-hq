import { Bell, ChevronLeft, ChevronRight, LogOut, Save, ShieldCheck } from 'lucide-react';
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
import type { AppNotification } from './AppLayout';
import type { AppUser, ProgramSettings } from '@/data/seedData';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  department: string;
  setDepartment: (d: string) => void;
  departments: string[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  appUsers: AppUser[];
  currentUser?: AppUser;
  notifications: AppNotification[];
  onSelectUser: (userId: string) => void;
  onSignOut: () => void;
  programSetting?: ProgramSettings;
}

const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export function TopBar({
  department,
  setDepartment,
  departments,
  currentDate,
  setCurrentDate,
  appUsers,
  currentUser,
  notifications,
  onSelectUser,
  onSignOut,
  programSetting,
}: TopBarProps) {
  const navigate = useNavigate();
  const prevDay = () => setCurrentDate(new Date(currentDate.getTime() - 86400000));
  const nextDay = () => setCurrentDate(new Date(currentDate.getTime() + 86400000));
  const today = () => setCurrentDate(new Date());

  return (
    <header className="h-14 border-b bg-card flex items-center px-3 gap-3 shrink-0">
      <SidebarTrigger className="text-muted-foreground" />

      <Select value={department} onValueChange={setDepartment}>
        <SelectTrigger className="w-40 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {departments.map(d => (
            <SelectItem key={d} value={d}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[220px] text-center">{formatDate(currentDate)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextDay}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={today}>
          Today
        </Button>
      </div>

      <div className="flex-1" />

      <div className="hidden xl:flex items-center gap-3 rounded-2xl border bg-background px-4 py-2 shadow-sm">
        {programSetting?.logoUrl ? (
          <img
            src={programSetting.logoUrl}
            alt={`${programSetting.clientLabel || programSetting.organizationName || 'Client'} logo`}
            className="h-12 w-12 rounded-xl object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            {(programSetting?.logoInitials || 'WF').slice(0, 2)}
          </div>
        )}
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Client</div>
          <div className="text-sm font-semibold">{programSetting?.clientLabel || programSetting?.organizationName || 'WorkForce App'}</div>
          <div className="text-[11px] text-muted-foreground">{programSetting?.appName || 'WorkForce App'}</div>
        </div>
      </div>

      <Button size="sm" className="h-8 gap-1.5">
        <Save className="h-3.5 w-3.5" />
        Save Board
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 relative">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]">
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
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{notification.route.replace('/app/', '')}</div>
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
    </header>
  );
}
