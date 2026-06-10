import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type Employee = {
  id: string;
  property_id: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  status: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  org_id: string | null;
  hourly_rate: number | null;
  job_description_id: string | null;
  job_description: string | null;
  employment_status_id: string | null;
  employment_status: string | null;
  wage_category_id: string | null;
  overtime_rule_id: string | null;
  group_id: string | null;
  group_name: string | null;
  role_id: string | null;
  department_id: string | null;
  language: string | null;
  worker_type_id: string | null;
  worker_type: string | null;
  portal_enabled: boolean;
  login_email: string | null;
  default_location_id: string | null;
  preferred_shift_template_id: string | null;
  active: boolean | null;
  employment_type: string | null;
};

export type Property = {
  id: string;
  name: string;
  short_name: string;
  logo_initials: string;
  color: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  acreage: number;
  status: string;
  created_at: string;
  org_id: string | null;
  weather_location_label: string | null;
};

export type Department = {
  id: string;
  org_id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
};

export type ProgramSettings = {
  id: string;
  app_name: string;
  client_label: string;
  primary_color: string;
  accent_color: string;
  sidebar_color: string;
  font_theme_preset: string;
  logo_url: string | null;
  default_department: string;
  created_at: string;
  org_id: string | null;
  weather_default_location_name: string | null;
  weather_default_address: string | null;
  weather_default_latitude: number | null;
  weather_default_longitude: number | null;
  weather_preferred_provider: string | null;
  weather_enabled_panels: string[] | null;
  theme_preference?: string | null;
};

type AppStoreState = {
  employees: Employee[];
  properties: Property[];
  departments: Department[];
  org: Organization | null;
  programSettings: ProgramSettings | null;
  isHydrated: boolean;
  hydrate: (orgId: string) => Promise<void>;
  reset: () => void;
};

const initialState = {
  employees: [],
  properties: [],
  departments: [],
  org: null,
  programSettings: null,
  isHydrated: false,
} satisfies Pick<
  AppStoreState,
  'employees' | 'properties' | 'departments' | 'org' | 'programSettings' | 'isHydrated'
>;

export const useAppStore = create<AppStoreState>((set) => ({
  ...initialState,
  hydrate: async (orgId) => {
    set({ isHydrated: false });

    if (!supabase) {
      console.error('[AppStore] Hydration failed: Supabase is not configured.');
      return;
    }

    try {
      const [
        employeesResult,
        propertiesResult,
        departmentsResult,
        orgResult,
        programSettingsResult,
      ] = await Promise.all([
        supabase.from('employees').select('*').eq('org_id', orgId),
        supabase.from('properties').select('*').eq('org_id', orgId),
        supabase
          .from('departments')
          .select('id, org_id, name, active, created_at')
          .eq('org_id', orgId),
        supabase
          .from('organizations')
          .select('id, name, plan, subscription_status')
          .eq('id', orgId)
          .single(),
        supabase.from('program_settings').select('*').eq('org_id', orgId).single(),
      ]);

      const error =
        employeesResult.error ??
        propertiesResult.error ??
        departmentsResult.error ??
        orgResult.error ??
        programSettingsResult.error;

      if (error) {
        console.error('[AppStore] Hydration failed:', error);
        return;
      }

      set({
        employees: (employeesResult.data ?? []) as Employee[],
        properties: (propertiesResult.data ?? []) as Property[],
        departments: (departmentsResult.data ?? []) as Department[],
        org: orgResult.data as Organization,
        programSettings: programSettingsResult.data as ProgramSettings,
        isHydrated: true,
      });
    } catch (error) {
      console.error('[AppStore] Hydration failed:', error);
    }
  },
  reset: () => set(initialState),
}));
