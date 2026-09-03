import type { ProgramSettings as ProgramSettingsView } from '@/data/seedData';
import type { Organization, ProgramSettings } from '@/store/appStore';

export function toProgramSettingsView(
  settings: ProgramSettings | null,
  org: Organization | null,
): ProgramSettingsView | null {
  if (!settings) return null;

  const appName = settings.app_name || 'Ground Crew HQ';
  const clientLabel = settings.client_label || '';

  return {
    id: settings.id,
    organizationName: org?.name || appName,
    appName,
    navigationTitle: appName,
    navigationSubtitle: org?.name || 'Operations',
    clientLabel,
    logoInitials: (clientLabel || appName).slice(0, 2).toUpperCase(),
    logoUrl: settings.logo_url ?? undefined,
    fontThemePreset: settings.font_theme_preset,
    primaryColor: settings.primary_color,
    accentColor: settings.accent_color,
    sidebarColor: settings.sidebar_color,
    defaultDepartment: settings.default_department,
    timeZone: '',
    fiscalYearStart: '',
    payPeriodLengthDays: Number(settings.pay_period_length_days ?? 14),
    payPeriodAnchorDate: settings.pay_period_anchor_date ?? '2024-01-01',
    onboardingDismissed: settings.onboarding_dismissed ?? false,
    billingEnabled: settings.billing_enabled ?? true,
    enableMobileApp: true,
    overtimeTracking: true,
    equipmentQrCodes: true,
  };
}
