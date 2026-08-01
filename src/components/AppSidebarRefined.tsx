import {
  BarChart3,
  Calendar,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText as FileTextIcon,
  HelpCircle,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Map as MapIcon,
  Menu,
  Receipt,
  Repeat,
  Settings2,
  Shield,
  ShieldAlert,
  TrendingUp,
  UserRound as UserRoundIcon,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
type NavGroupId = 'primary' | 'management' | 'settings';

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

type NavSectionProps = {
  id: NavGroupId;
  label: string;
  icon: LucideIcon;
  items: NavItemConfig[];
  collapsed: boolean;
  open: boolean;
  onToggle: (id: NavGroupId) => void;
  renderItems: (items: NavItemConfig[]) => JSX.Element;
  className?: string;
};

const SIDEBAR_GROUPS_STORAGE_KEY = 'gchq-sidebar-groups-v1';
const defaultGroupState: Record<NavGroupId, boolean> = {
  primary: true,
  management: false,
  settings: false,
};

const primaryOperations: NavItemConfig[] = [
  { label: 'Command Center', href: '/app/dashboard', icon: LayoutDashboard, moduleId: 'command-center' },
  { label: 'Dispatch', href: '/app/dispatch', icon: CalendarDays, moduleId: 'workflow' },
  { label: 'Scheduler', href: '/app/scheduler', icon: Calendar, moduleId: 'workflow' },
  { label: 'Workflow', href: '/app/workboard', icon: ClipboardList, moduleId: 'workflow' },
  { label: 'Open Tasks', href: '/app/open-tasks', icon: ListTodo, moduleId: 'workflow' },
];

const management: NavItemConfig[] = [
  { label: 'Team', href: '/app/employees', icon: UsersRound, moduleId: 'workflow' },
  { label: 'Properties', href: '/app/properties', icon: MapIcon, moduleId: 'command-center' },
  { label: 'Equipment', href: '/app/equipment', icon: Wrench, moduleId: 'equipment' },
  { label: 'Clients', href: '/app/clients', icon: UserRoundIcon, moduleId: 'workflow' },
  { label: 'Estimates', href: '/app/estimates', icon: FileTextIcon, moduleId: 'workflow' },
  { label: 'Invoicing', href: '/app/invoicing', icon: Receipt, moduleId: 'workflow' },
  { label: 'Contracts', href: '/app/contracts', icon: Repeat, moduleId: 'workflow' },
  { label: 'Reports', href: '/app/reports', icon: BarChart3, moduleId: 'reports' },
  { label: 'Job Costing', href: '/app/job-costing', icon: TrendingUp, moduleId: 'reports' },
];

const complianceAndSettings: NavItemConfig[] = [
  { label: 'Applications', href: '/app/applications', icon: Shield, moduleId: 'applications' },
  { label: 'Safety', href: '/app/safety', icon: ShieldAlert, moduleId: 'workflow' },
  { label: 'Settings', href: '/app/settings', icon: Settings2, moduleId: 'command-center' },
  { label: 'Help', href: 'mailto:support@groundcrewhq.com', icon: HelpCircle },
];

function readStoredGroupState(): Record<NavGroupId, boolean> {
  if (typeof window === 'undefined') return defaultGroupState;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
    if (!raw) return defaultGroupState;
    const parsed = JSON.parse(raw) as Partial<Record<NavGroupId, unknown>>;
    return {
      primary: typeof parsed.primary === 'boolean' ? parsed.primary : defaultGroupState.primary,
      management: typeof parsed.management === 'boolean' ? parsed.management : defaultGroupState.management,
      settings: typeof parsed.settings === 'boolean' ? parsed.settings : defaultGroupState.settings,
    };
  } catch {
    return defaultGroupState;
  }
}

function persistGroupState(nextState: Record<NavGroupId, boolean>) {
  try {
    window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    /* UI preference persistence is best-effort. */
  }
}

function withDesktopTooltip(children: JSX.Element, label: string, collapsed: boolean) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" align="center">{label}</TooltipContent>
    </Tooltip>
  );
}

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
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4" />
        {collapsed && badge ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-status-pending" /> : null}
      </span>
      {!collapsed ? <span>{label}</span> : null}
      {!collapsed && badge ? (
        <span className="ml-auto rounded-full bg-status-pending px-1.5 py-0.5 text-xs text-text-inverse">
          {badge}
        </span>
      ) : null}
    </>
  );

  const itemClassName = cn(
    'relative flex items-center rounded-lg text-sm transition-colors',
    collapsed ? 'mx-auto h-10 w-10 justify-center px-0 py-0' : 'gap-3 px-3 py-3',
    isActive
      ? collapsed
        ? 'bg-brand-bright/15 text-brand ring-1 ring-brand-dim'
        : 'border-l-2 border-brand bg-brand-bright/15 font-medium text-brand'
      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  );

  if (disabled || !href) {
    return withDesktopTooltip(
      <button
        type="button"
        disabled
        title={collapsed ? undefined : `${label} coming soon`}
        className={cn(itemClassName, 'text-text-muted opacity-60')}
      >
        {content}
      </button>,
      `${label} coming soon`,
      collapsed,
    );
  }

  if (href.startsWith('mailto:')) {
    return withDesktopTooltip(
      <a
        href={href}
        onClick={onNavigate}
        title={collapsed ? undefined : undefined}
        className={itemClassName}
      >
        {content}
      </a>,
      label,
      collapsed,
    );
  }

  return withDesktopTooltip(
    <NavLink
      to={href}
      onClick={onNavigate}
      title={collapsed ? undefined : undefined}
      className={itemClassName}
    >
      {content}
    </NavLink>,
    label,
    collapsed,
  );
}

function NavSection({ id, label, icon: Icon, items, collapsed, open, onToggle, renderItems, className }: NavSectionProps) {
  if (items.length === 0) return null;

  if (collapsed) {
    return <section className={cn('py-1', className)}>{renderItems(items)}</section>;
  }

  return (
    <section className={cn('py-1', className)}>
      <button
        type="button"
        className="mb-1 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[10px] font-semibold uppercase tracking-widest text-text-muted/70 transition-colors hover:bg-surface-hover hover:text-text-secondary"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open ? 'rotate-180' : '')} />
      </button>
      {open ? renderItems(items) : null}
    </section>
  );
}

export const AppSidebarRefined = memo(function AppSidebarRefined({
  onNavigate,
  taskBoardBadgeCount = 0,
  chemicalLogsBadgeCount = 0,
}: AppSidebarRefinedProps) {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentRole, orgId, signOut, currentUser } = useOrgProfile();
  const { data: programSetting } = useProgramSettings(orgId);
  const navigationTitle = programSetting?.navigationTitle || programSetting?.appName || 'Ground Crew HQ';
  const navigationSubtitle = programSetting?.navigationSubtitle || programSetting?.organizationName || 'Operations';
  const logoInitials = (programSetting?.logoInitials || navigationTitle.slice(0, 2)).toUpperCase();
  const logoUrl = programSetting?.logoUrl;
  const { data: properties = [] } = useProperties(orgId);
  const propertyClasses = usePropertyClassOptions().data ?? [];
  const sidebarPropertyId = currentUser?.role === 'employee' || currentUser?.role === 'viewer' ? currentUser?.propertyId : null;
  const currentProperty = properties.find((property) => property.id === sidebarPropertyId);
  const currentPropertyClassId = currentProperty?.propertyClassId;
  const activePropertyClass = propertyClasses.find((propertyClass) => propertyClass.id === currentPropertyClassId);
  const enabledModules = Array.isArray(activePropertyClass?.enabledModules) ? activePropertyClass.enabledModules : [];
  const navRole: NavRole = currentRole === 'admin' || currentRole === 'manager' ? 'admin' : 'employee';
  const [openGroups, setOpenGroups] = useState<Record<NavGroupId, boolean>>(() => readStoredGroupState());

  useEffect(() => {
    persistGroupState(openGroups);
  }, [openGroups]);

  const toggleGroup = (groupId: NavGroupId) => {
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

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
            : item.label === 'Applications'
              ? chemicalLogsBadgeCount
              : undefined,
      }));

  const primaryItems = withVisibility(primaryOperations);
  const managementItems = withVisibility(management);
  const footerItems = withVisibility(complianceAndSettings);
  const roleBadgeLabel = currentRole === 'admin' ? 'Admin' : currentRole === 'manager' ? 'Supervisor' : 'Field Crew';
  const userDisplayName = currentUser?.fullName || currentUser?.email || '';

  const handleSignOut = async () => {
    queryClient.clear();
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('ground-crew-query-cache-v3');
        window.localStorage.removeItem('ground-crew-query-cache-v2');
        window.localStorage.removeItem('ground-crew-query-cache');
      }
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      onNavigate?.();
      router.replace('/');
    }
  };

  const renderItems = (items: NavItemConfig[]) => (
    <SidebarMenu className={collapsed ? 'items-center gap-1' : undefined}>
      {items.map((item) => (
        <SidebarMenuItem key={item.label} className={collapsed ? 'flex justify-center' : undefined}>
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className={cn('border-b border-sidebar-border bg-sidebar', collapsed ? 'p-2' : 'p-4')}>
        <div className={cn('flex gap-2', collapsed ? 'flex-col items-center' : 'items-center justify-between')}>
          <button
            type="button"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className={cn('flex min-w-0 items-center gap-2', collapsed ? 'justify-center' : 'flex-1')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-ghost ring-1 ring-brand-dim">
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
                <h1 className="truncate text-sm font-bold text-brand-bright [-webkit-text-stroke:0.5px_oklch(var(--text-inverse))]">{navigationTitle}</h1>
                <p className="truncate text-xs uppercase text-text-muted">{navigationSubtitle}</p>
              </div>
            ) : null}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className={cn('gap-0 bg-gradient-to-b from-sidebar to-sidebar-accent px-2 py-3', collapsed ? 'items-center overflow-hidden' : '')}>
        <NavSection
          id="primary"
          label="Primary Operations"
          icon={ClipboardList}
          items={primaryItems}
          collapsed={collapsed}
          open={openGroups.primary}
          onToggle={toggleGroup}
          renderItems={renderItems}
          className="pb-2"
        />

        <NavSection
          id="management"
          label="Management"
          icon={UsersRound}
          items={managementItems}
          collapsed={collapsed}
          open={openGroups.management}
          onToggle={toggleGroup}
          renderItems={renderItems}
          className="border-t border-surface-border pt-3"
        />
      </SidebarContent>

      <SidebarFooter className={cn('border-t border-sidebar-border bg-sidebar', collapsed ? 'items-center p-2' : 'p-2')}>
        <NavSection
          id="settings"
          label="Settings & Compliance"
          icon={Shield}
          items={footerItems}
          collapsed={collapsed}
          open={openGroups.settings}
          onToggle={toggleGroup}
          renderItems={renderItems}
          className={collapsed ? '' : 'pt-1'}
        />
        <div className={cn('mt-2 border-t border-surface-border pt-3', collapsed ? 'flex flex-col items-center px-0' : 'px-3')}>
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-ghost px-2.5 py-1 text-xs font-semibold uppercase text-brand-bright">
                  {roleBadgeLabel}
                </span>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                  onClick={() => void handleSignOut()}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
              {userDisplayName ? <div className="truncate text-xs font-medium text-text-secondary">{userDisplayName}</div> : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className={cn('h-2 w-2 rounded-full', currentRole === 'employee' ? 'bg-text-muted' : 'bg-brand')} />
              {withDesktopTooltip(
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                  onClick={() => void handleSignOut()}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>,
                'Sign out',
                collapsed,
              )}
            </div>
          )}
          <div className={cn('mt-3 text-xs text-text-muted', collapsed ? 'text-center' : '')}>
            {collapsed ? `v${APP_VERSION}` : `Ground Crew HQ - v${APP_VERSION}`}
          </div>
          {!collapsed ? <div className="mt-1 text-xs text-text-muted">(c) 2026 Ground Crew HQ</div> : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
});
