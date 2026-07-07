import {
  BarChart3,
  Calendar,
  CalendarDays,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Receipt,
  Settings2,
  Shield,
  ShieldAlert,
  TrendingUp,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { memo } from 'react';
import { usePathname } from 'next/navigation';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { useProgramSettings, useProperties, usePropertyClassOptions } from '@/lib/supabase-queries';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/constants/version';

interface AppSidebarRefinedProps {
  onNavigate?: () => void;
  taskBoardBadgeCount?: number;
  chemicalLogsBadgeCount?: number;
}

type NavRole = 'employee' | 'admin';

type NavItemConfig = {
  label: string;
  href?: string;
  icon: LucideIcon;
  moduleId?: string;
  badge?: number;
  disabled?: boolean;
};

type NavItemProps = NavItemConfig & {
  collapsed: boolean;
  isActive: boolean;
  onNavigate?: () => void;
};

const primaryOperations: NavItemConfig[] = [
  { label: 'Command Center', href: '/app/dashboard', icon: LayoutDashboard, moduleId: 'command-center' },
  { label: 'Dispatch', href: '/app/dispatch', icon: CalendarDays, moduleId: 'workflow' },
  { label: 'Scheduler', href: '/app/scheduler', icon: Calendar, moduleId: 'workflow' },
  { label: 'Workflow', href: '/app/workboard', icon: ClipboardList, moduleId: 'workflow' },
];

const management: NavItemConfig[] = [
  { label: 'Team', href: '/app/employees', icon: UsersRound, moduleId: 'workflow' },
  { label: 'Equipment', href: '/app/equipment', icon: Wrench, moduleId: 'equipment' },
  { label: 'Invoicing', href: '/app/invoicing', icon: Receipt, moduleId: 'workflow' },
  { label: 'Reports', href: '/app/reports', icon: BarChart3, moduleId: 'reports' },
  { label: 'Job Costing', href: '/app/job-costing', icon: TrendingUp, moduleId: 'reports' },
];

const complianceAndSettings: NavItemConfig[] = [
  { label: 'Chemical Logs', href: '/app/applications', icon: Shield, moduleId: 'applications' },
  { label: 'Safety', href: '/app/safety', icon: ShieldAlert, moduleId: 'workflow' },
  { label: 'Settings', href: '/app/settings', icon: Settings2, moduleId: 'command-center' },
  { label: 'Help', href: 'mailto:support@groundcrewhq.com', icon: HelpCircle },
];

function NavItem({
  icon: Icon,
  label,
  href,
  badge,
  disabled = false,
  collapsed,
  isActive,
  onNavigate,
}: NavItemProps) {
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span>{label}</span> : null}
      {!collapsed && badge ? (
        <span className="ml-auto rounded-full bg-status-pending px-1.5 py-0.5 text-xs text-text-inverse">
          {badge}
        </span>
      ) : null}
    </>
  );

  if (disabled || !href) {
    return (
      <button
        type="button"
        disabled
        title={`${label} coming soon`}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-text-muted opacity-60"
      >
        {content}
      </button>
    );
  }

  if (href.startsWith('mailto:')) {
    return (
      <a
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        {content}
      </a>
    );
  }

  return (
    <NavLink
      to={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
        isActive
          ? 'border-l-2 border-brand bg-surface-hover font-medium text-brand'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      {content}
    </NavLink>
  );
}

export const AppSidebarRefined = memo(function AppSidebarRefined({
  onNavigate,
  taskBoardBadgeCount = 0,
  chemicalLogsBadgeCount = 0,
}: AppSidebarRefinedProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const pathname = usePathname() ?? '/';
  const { currentRole, currentPropertyId, orgId } = useOrgProfile();
  const { data: programSetting } = useProgramSettings(orgId);
  const navigationTitle = programSetting?.navigationTitle || programSetting?.appName || 'Ground Crew HQ';
  const navigationSubtitle = programSetting?.navigationSubtitle || programSetting?.organizationName || 'Operations';
  const logoInitials = (programSetting?.logoInitials || navigationTitle.slice(0, 2)).toUpperCase();
  const logoUrl = programSetting?.logoUrl;
  const { data: properties = [] } = useProperties(orgId);
  const propertyClasses = usePropertyClassOptions().data ?? [];
  const currentProperty = properties.find((property) => property.id === currentPropertyId);
  const currentPropertyClassId = currentProperty?.propertyClassId;
  const activePropertyClass = propertyClasses.find((propertyClass) => propertyClass.id === currentPropertyClassId);
  const enabledModules = Array.isArray(activePropertyClass?.enabledModules) ? activePropertyClass.enabledModules : [];
  const navRole: NavRole = currentRole === 'admin' || currentRole === 'manager' ? 'admin' : 'employee';

  const withVisibility = (items: NavItemConfig[]) =>
    items
      .filter((item) => {
        if (navRole === 'employee' && management.includes(item)) return false;
        if (!activePropertyClass || item.disabled || item.label === 'Settings') return true;
        return item.moduleId ? enabledModules.includes(item.moduleId) : true;
      })
      .map((item) => ({
        ...item,
        badge:
          item.label === 'Workflow'
            ? taskBoardBadgeCount
            : item.label === 'Chemical Logs'
              ? chemicalLogsBadgeCount
              : undefined,
      }));

  const primaryItems = withVisibility(primaryOperations);
  const managementItems = withVisibility(management);
  const footerItems = withVisibility(complianceAndSettings);
  const roleBadgeLabel = currentRole === 'admin' ? 'Admin' : currentRole === 'manager' ? 'Supervisor' : 'Field Crew';

  const renderItems = (items: NavItemConfig[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.label}>
          <NavItem
            {...item}
            collapsed={collapsed}
            isActive={Boolean(item.href && pathname.startsWith(item.href))}
            onNavigate={onNavigate}
          />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-surface-border bg-surface-base">
      <SidebarHeader className="border-b border-surface-border bg-surface-base p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-ghost ring-1 ring-brand-dim">
            {logoUrl ? (
              <img src={logoUrl} alt={`${navigationTitle} logo`} className="h-7 w-7 rounded-md object-contain" />
            ) : collapsed ? (
              <span className="text-xs font-bold text-brand-bright">{logoInitials.slice(0, 2)}</span>
            ) : (
              <span className="text-sm font-extrabold text-brand-bright">HQ</span>
            )}
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-text-primary">{navigationTitle}</h1>
              <p className="truncate text-xs uppercase text-text-muted">{navigationSubtitle}</p>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 bg-gradient-to-b from-surface-card to-surface-base px-2 py-3">
        <section className="pb-3">
          {!collapsed ? (
            <div className="mb-1 px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted/60">Primary Operations</div>
          ) : null}
          {renderItems(primaryItems)}
        </section>

        {managementItems.length > 0 ? (
          <section className="border-t border-surface-border pt-3">
            {!collapsed ? (
              <div className="mb-1 px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted/60">Management</div>
            ) : null}
            {renderItems(managementItems)}
          </section>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-surface-border bg-surface-base p-2">
        {!collapsed ? (
          <div className="mb-1 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted/60">Settings & Compliance</div>
        ) : null}
        {renderItems(footerItems)}
        <div className="mt-2 border-t border-surface-border px-3 pt-3">
          {!collapsed ? (
            <span className="rounded-full bg-brand-ghost px-2.5 py-1 text-xs font-semibold uppercase text-brand-bright">
              {roleBadgeLabel}
            </span>
          ) : (
            <div className="flex justify-center">
              <span className={cn('h-2 w-2 rounded-full', currentRole === 'employee' ? 'bg-text-muted' : 'bg-brand')} />
            </div>
          )}
          <div className="mt-3 text-xs text-text-muted">
            {collapsed ? `v${APP_VERSION}` : `Ground Crew HQ · v${APP_VERSION}`}
          </div>
          {!collapsed ? <div className="mt-1 text-xs text-text-muted">© 2026 Ground Crew HQ</div> : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
});

