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

  const roleBadgeLabel = currentRole === 'admin' ? 'Admin' : currentRole === 'manager' ? 'Supervisor' : 'Field Crew';
  const roleBadgeClass = currentRole === 'employee'
    ? 'bg-slate-400/10 text-slate-400'
    : 'bg-lime-400/10 text-lime-400';

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-[#0f1a14]">
      <SidebarHeader className="border-b border-white/[0.06] bg-[#0f1a14] p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10 ring-1 ring-lime-400/20">
            {logoUrl ? (
              <img src={logoUrl} alt={`${navigationTitle} logo`} className="h-7 w-7 rounded-md object-contain" />
            ) : collapsed ? (
              <span className="text-xs font-bold text-lime-400">{logoInitials.slice(0, 2)}</span>
            ) : (
              <span className="text-sm font-extrabold tracking-tight text-lime-400">HQ</span>
            )}
          </div>
          {!collapsed ? (
            <div>
              <h1 className="text-sm font-bold text-slate-100">{navigationTitle}</h1>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{navigationSubtitle}</p>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-[#0f1a14] pt-2">
        {visibleSections.map((section) => (
          <SidebarGroup key={section.title}>
            {!collapsed ? (
              <div className="mb-1 mt-4 px-3 text-[10px] uppercase tracking-widest text-slate-600">
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
                        className="relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-slate-400 transition-colors duration-200 hover:bg-white/5 hover:text-slate-100"
                        activeClassName="border-l-2 border-lime-400 bg-lime-400/10 !text-lime-400 font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? (
                          <span className="inline-flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.title === 'Workflow' && taskBoardBadgeCount > 0 ? (
                              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                {taskBoardBadgeCount}
                              </span>
                            ) : null}
                            {item.title === 'Chemical Logs' && chemicalLogsBadgeCount > 0 ? (
                              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
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

      <SidebarFooter className="border-t border-white/[0.06] bg-[#0f1a14] p-4">
        {!collapsed ? (
          <div className="mb-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${roleBadgeClass}`}>
              {roleBadgeLabel}
            </span>
          </div>
        ) : (
          <div className="mb-2 flex justify-center">
            <span className={`h-2 w-2 rounded-full ${currentRole === 'employee' ? 'bg-slate-500' : 'bg-lime-400'}`} />
          </div>
        )}
        <div className="text-[11px] text-slate-600">
          {collapsed ? `v${APP_VERSION}` : `Ground Crew HQ · v${APP_VERSION}`}
        </div>
        {!collapsed ? <div className="mt-1 text-[10px] text-slate-700">© 2026 Ground Crew HQ</div> : null}
      </SidebarFooter>
    </Sidebar>
  );
});
