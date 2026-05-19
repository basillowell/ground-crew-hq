import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Wrench,
  Shield,
  ShieldCheck,
  BarChart3,
  Settings,
  MessageCircle,
  Mail,
  CloudSun,
  MapPin,
} from 'lucide-react';
import { memo } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useProgramSettings, useProperties, usePropertyClassOptions } from '@/lib/supabase-queries';
import { APP_VERSION } from '@/constants/version';

interface AppSidebarRefinedProps {
  onNavigate?: () => void;
  hasSevereWeatherAlert?: boolean;
  taskBoardBadgeCount?: number;
  chemicalLogsBadgeCount?: number;
}

type NavRole = 'employee' | 'admin';

type NavSection = {
  title: string;
  items: {
    title: string;
    url: string;
    icon: typeof Calendar;
    moduleId: string;
  }[];
};

const adminNavSections: NavSection[] = [
  {
    title: 'Command Center',
    items: [
      { title: 'Dashboard', url: '/app/dashboard', icon: LayoutDashboard, moduleId: 'command-center' },
    ],
  },
  {
    title: 'Field Ops',
    items: [
      { title: 'Scheduler', url: '/app/scheduler', icon: Calendar, moduleId: 'workflow' },
      { title: 'Workflow', url: '/app/workboard', icon: ClipboardList, moduleId: 'workflow' },
      { title: 'Field View', url: '/app/field', icon: MapPin, moduleId: 'field' },
    ],
  },
  {
    title: 'Crew & Assets',
    items: [
      { title: 'Team', url: '/app/employees', icon: Users, moduleId: 'workflow' },
      { title: 'Equipment', url: '/app/equipment', icon: Wrench, moduleId: 'equipment' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { title: 'Chemical Logs', url: '/app/applications', icon: ShieldCheck, moduleId: 'applications' },
      { title: 'Safety', url: '/app/safety', icon: Shield, moduleId: 'workflow' },
      { title: 'Reports', url: '/app/reports', icon: BarChart3, moduleId: 'reports' },
    ],
  },
  {
    title: 'Weather',
    items: [
      { title: 'Weather', url: '/app/weather', icon: CloudSun, moduleId: 'weather' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { title: 'Team Chat', url: '/app/breakroom', icon: MessageCircle, moduleId: 'breakroom' },
      { title: 'Messaging', url: '/app/messaging', icon: Mail, moduleId: 'workflow' },
    ],
  },
  {
    title: 'Configure',
    items: [
      { title: 'Settings', url: '/app/settings', icon: Settings, moduleId: 'command-center' },
    ],
  },
];

const employeeNavSections: NavSection[] = [
  {
    title: 'My Work',
    items: [
      { title: 'Dashboard', url: '/app/dashboard', icon: LayoutDashboard, moduleId: 'command-center' },
      { title: 'Scheduler', url: '/app/scheduler', icon: Calendar, moduleId: 'workflow' },
      { title: 'Workflow', url: '/app/workboard', icon: ClipboardList, moduleId: 'workflow' },
      { title: 'Field View', url: '/app/field', icon: MapPin, moduleId: 'field' },
    ],
  },
  {
    title: 'Connect',
    items: [
      { title: 'Team Chat', url: '/app/breakroom', icon: MessageCircle, moduleId: 'breakroom' },
      { title: 'Messaging', url: '/app/messaging', icon: Mail, moduleId: 'workflow' },
    ],
  },
];

export const AppSidebarRefined = memo(function AppSidebarRefined({
  onNavigate,
  hasSevereWeatherAlert = false,
  taskBoardBadgeCount = 0,
  chemicalLogsBadgeCount = 0,
}: AppSidebarRefinedProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { currentRole, currentPropertyId, currentUser } = useAuth();
  const { data: programSetting } = useProgramSettings(currentUser?.orgId);
  const navigationTitle = programSetting?.navigationTitle || programSetting?.appName || 'Ground Crew HQ';
  const navigationSubtitle = programSetting?.navigationSubtitle || programSetting?.organizationName || 'Operations';
  const logoInitials = (programSetting?.logoInitials || navigationTitle.slice(0, 2)).toUpperCase();
  const logoUrl = programSetting?.logoUrl;
  const properties = useProperties(currentUser?.orgId).data ?? [];
  const propertyClasses = usePropertyClassOptions().data ?? [];
  const currentProperty = properties.find((property) => property.id === currentPropertyId);
  const activePropertyClass = propertyClasses.find((propertyClass) => propertyClass.id === currentProperty?.propertyClassId);
  const enabledModules = Array.isArray(activePropertyClass?.enabledModules) ? activePropertyClass.enabledModules : [];
  const navRole: NavRole = currentRole === 'admin' || currentRole === 'manager' ? 'admin' : 'employee';
  const baseSections = navRole === 'admin' ? adminNavSections : employeeNavSections;
  const visibleSections = baseSections
    .map((section) => ({
      ...section,
      items: activePropertyClass
        ? section.items.filter((item) => item.title === 'Settings' || enabledModules.includes(item.moduleId))
        : [...section.items],
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/80 bg-sidebar p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
            {logoUrl ? (
              <img src={logoUrl} alt={`${navigationTitle} logo`} className="h-7 w-7 rounded-md object-contain" />
            ) : collapsed ? (
              <span className="text-xs font-bold text-sidebar-primary-foreground">{logoInitials.slice(0, 2)}</span>
            ) : (
              <span className="text-primary-foreground text-sm font-extrabold tracking-tight">HQ</span>
            )}
          </div>
          {!collapsed ? (
            <div>
              <h1 className="text-sm font-bold text-sidebar-accent-foreground">{navigationTitle}</h1>
              <p className="text-[11px] uppercase tracking-[0.12em] text-sidebar-foreground/80">{navigationSubtitle}</p>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {visibleSections.map((section) => (
          <SidebarGroup key={section.title}>
            {!collapsed ? (
              <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                {section.title}
              </div>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        onClick={onNavigate}
                        className="relative rounded-lg border border-transparent px-2.5 py-2 text-sidebar-foreground transition-colors duration-150 hover:bg-muted/30 hover:text-sidebar-accent-foreground"
                        activeClassName="border-l-2 border-primary bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed ? (
                          <span className="inline-flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.title === 'Workflow' && taskBoardBadgeCount > 0 ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                {taskBoardBadgeCount}
                              </span>
                            ) : null}
                            {item.title === 'Chemical Logs' && chemicalLogsBadgeCount > 0 ? (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                {chemicalLogsBadgeCount}
                              </span>
                            ) : null}
                            {item.title === 'Weather' && hasSevereWeatherAlert ? (
                              <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Severe weather alert active" />
                            ) : null}
                          </span>
                        ) : null}
                        {collapsed && item.title === 'Weather' && hasSevereWeatherAlert ? (
                          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" aria-label="Severe weather alert active" />
                        ) : null}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/80 bg-sidebar p-4">
        <div className="text-[11px] text-sidebar-foreground/85">
          {collapsed ? `v${APP_VERSION}` : `Ground Crew HQ · v${APP_VERSION}`}
        </div>
        {!collapsed ? <div className="mt-1 text-[10px] text-sidebar-foreground/70">© 2026 Ground Crew HQ</div> : null}
      </SidebarFooter>
    </Sidebar>
  );
});
