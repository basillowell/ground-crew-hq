import {
  LayoutDashboard, Clock, Users, ListChecks, Wrench, Shield,
  BarChart3, Settings, MessageSquare, Leaf, CloudSun, FlaskConical, MonitorSmartphone
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Workboard', url: '/app/workboard', icon: LayoutDashboard },
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Leaf className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-sidebar-accent-foreground">GroundsCrew</h1>
              <p className="text-xs text-sidebar-foreground">Task Tracker</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {!collapsed && (
          <div className="text-xs text-sidebar-foreground">
            v2.4.1 • Demo Mode
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
