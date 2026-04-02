import {
  LayoutDashboard,
  Clock,
  Users,
  ListChecks,
  Wrench,
  Shield,
  BarChart3,
  Settings,
  MessageSquare,
  Leaf,
  CloudSun,
  FlaskConical,
  MonitorSmartphone,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { loadProgramSettings } from '@/lib/dataStore';

const navItems = [
  { title: 'Workflow', url: '/app/workboard', icon: LayoutDashboard },
  { title: 'Time Management', url: '/app/scheduler', icon: Clock },
  { title: 'Employee Management', url: '/app/employees', icon: Users },
  { title: 'Task Management', url: '/app/tasks', icon: ListChecks },
  { title: 'Equipment Management', url: '/app/equipment', icon: Wrench },
  { title: 'Breakroom', url: '/app/breakroom', icon: MonitorSmartphone },
  { title: 'Weather', url: '/app/weather', icon: CloudSun },
  { title: 'Applications', url: '/app/applications', icon: FlaskConical },
  { title: 'Safety Management', url: '/app/safety', icon: Shield },
  { title: 'Report Tracking', url: '/app/reports', icon: BarChart3 },
  { title: 'Messaging', url: '/app/messaging', icon: MessageSquare },
  { title: 'Program Setup', url: '/app/settings', icon: Settings },
];

export function AppSidebarRefined() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const programSetting = loadProgramSettings()[0];
  const navigationTitle = programSetting?.navigationTitle || programSetting?.appName || 'WorkForce App';
  const navigationSubtitle = programSetting?.navigationSubtitle || programSetting?.organizationName || 'Operations';
  const logoInitials = (programSetting?.logoInitials || navigationTitle.slice(0, 2)).toUpperCase();
  const logoUrl = programSetting?.logoUrl;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            {logoUrl ? (
              <img src={logoUrl} alt={`${navigationTitle} logo`} className="h-7 w-7 rounded-md object-contain" />
            ) : collapsed ? (
              <span className="text-xs font-bold text-sidebar-primary-foreground">{logoInitials.slice(0, 2)}</span>
            ) : (
              <Leaf className="h-5 w-5 text-sidebar-primary-foreground" />
            )}
          </div>
          {!collapsed ? (
            <div>
              <h1 className="text-sm font-bold text-sidebar-accent-foreground">{navigationTitle}</h1>
              <p className="text-xs text-sidebar-foreground">{navigationSubtitle}</p>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url} tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed ? <span>{item.title}</span> : null}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed ? (
          <div className="text-xs text-sidebar-foreground">
            {programSetting?.clientLabel || programSetting?.organizationName || 'Client profile'} · v2.4.1
          </div>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
