import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDepartmentOptions,
  useEmploymentStatuses,
  useGroupOptions,
  useJobDescriptions,
  useLanguageOptions,
  useOvertimeRules,
  useRoleOptions,
  useShiftTemplates,
  useWageCategories,
  useWorkerTypes,
  useWorkLocations,
} from '@/lib/supabase-queries';

export type FrameworkOption = { id: string; name: string; active?: boolean };
export type AccessRoleOption = { id: string; name: string; description: string };

export const WORKFORCE_FRAMEWORK_QUERY_KEYS = {
  departments: (orgId?: string) => ['department-options', orgId ?? 'all-orgs'] as const,
  groups: (orgId?: string) => ['group-options', orgId ?? 'all-orgs'] as const,
  workforceRoles: (orgId?: string) => ['role-options', orgId ?? 'all-orgs'] as const,
  workerTypes: (orgId?: string) => ['worker-types', orgId ?? 'all-orgs'] as const,
  employmentStatuses: (orgId?: string) => ['employment-statuses', orgId ?? 'all-orgs'] as const,
  jobDescriptions: (orgId?: string) => ['job-descriptions', orgId ?? 'all-orgs'] as const,
  wageCategories: (orgId?: string) => ['wage-categories', orgId ?? 'all-orgs'] as const,
  overtimeRules: (orgId?: string) => ['overtime-rules', orgId ?? 'all-orgs'] as const,
  languages: (orgId?: string) => ['language-options', orgId ?? 'all-orgs'] as const,
  shiftTemplates: (orgId?: string) => ['shift-templates', orgId ?? 'all-orgs'] as const,
  workLocations: (propertyId?: string, orgId?: string) =>
    ['work-locations', propertyId ?? 'all', orgId ?? 'all-orgs'] as const,
};

export const ACCESS_ROLE_OPTIONS: AccessRoleOption[] = [
  { id: 'admin', name: 'Platform Admin', description: 'Full system configuration and operational control.' },
  { id: 'manager', name: 'Supervisor', description: 'Day-to-day operations, assignments, and workforce management.' },
  { id: 'employee', name: 'Standard User', description: 'Field execution and personal work visibility.' },
  { id: 'read-only', name: 'Read Only', description: 'View-only reporting and audit visibility.' },
];

export function toOptionMap(options: FrameworkOption[]) {
  return new Map(options.map((entry) => [entry.name, entry.id]));
}

export function sanitizeFrameworkOptions(options: FrameworkOption[]) {
  const unique = new Map<string, FrameworkOption>();
  options.forEach((entry) => {
    const name = entry.name?.trim();
    if (!name) return;
    unique.set(name.toLowerCase(), { ...entry, name });
  });
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getActiveOptions(options: FrameworkOption[]) {
  return sanitizeFrameworkOptions(options.filter((entry) => entry.active ?? true));
}

export function useWorkforceFramework(orgId?: string, propertyId?: string) {
  const departmentsQuery = useDepartmentOptions(orgId);
  const groupsQuery = useGroupOptions(orgId);
  const workforceRolesQuery = useRoleOptions(orgId);
  const workerTypesQuery = useWorkerTypes(orgId);
  const employmentStatusesQuery = useEmploymentStatuses(orgId);
  const jobDescriptionsQuery = useJobDescriptions(orgId);
  const wageCategoriesQuery = useWageCategories(orgId);
  const overtimeRulesQuery = useOvertimeRules(orgId);
  const languagesQuery = useLanguageOptions(orgId);
  const shiftTemplatesQuery = useShiftTemplates(orgId);
  const workLocationsQuery = useWorkLocations(propertyId, orgId);

  const isLoading =
    departmentsQuery.isLoading ||
    groupsQuery.isLoading ||
    workforceRolesQuery.isLoading ||
    workerTypesQuery.isLoading ||
    employmentStatusesQuery.isLoading ||
    jobDescriptionsQuery.isLoading ||
    wageCategoriesQuery.isLoading ||
    overtimeRulesQuery.isLoading ||
    languagesQuery.isLoading ||
    shiftTemplatesQuery.isLoading ||
    workLocationsQuery.isLoading;

  const hasError = Boolean(
    departmentsQuery.error ||
      groupsQuery.error ||
      workforceRolesQuery.error ||
      workerTypesQuery.error ||
      employmentStatusesQuery.error ||
      jobDescriptionsQuery.error ||
      wageCategoriesQuery.error ||
      overtimeRulesQuery.error ||
      languagesQuery.error ||
      shiftTemplatesQuery.error ||
      workLocationsQuery.error,
  );

  const errorMessage =
    (departmentsQuery.error as { message?: string } | null)?.message ||
    (groupsQuery.error as { message?: string } | null)?.message ||
    (workforceRolesQuery.error as { message?: string } | null)?.message ||
    (workerTypesQuery.error as { message?: string } | null)?.message ||
    (employmentStatusesQuery.error as { message?: string } | null)?.message ||
    (jobDescriptionsQuery.error as { message?: string } | null)?.message ||
    (wageCategoriesQuery.error as { message?: string } | null)?.message ||
    (overtimeRulesQuery.error as { message?: string } | null)?.message ||
    (languagesQuery.error as { message?: string } | null)?.message ||
    (shiftTemplatesQuery.error as { message?: string } | null)?.message ||
    (workLocationsQuery.error as { message?: string } | null)?.message ||
    '';

  const workforce = useMemo(
    () => ({
      departments: sanitizeFrameworkOptions(departmentsQuery.data ?? []),
      groups: sanitizeFrameworkOptions(groupOptionsToFramework(groupsQuery.data ?? [])),
      workforceRoles: sanitizeFrameworkOptions(workforceRolesQuery.data ?? []),
      workerTypes: sanitizeFrameworkOptions(workerTypesQuery.data ?? []),
      employmentStatuses: sanitizeFrameworkOptions(employmentStatusesQuery.data ?? []),
      jobDescriptions: sanitizeFrameworkOptions(jobDescriptionsQuery.data ?? []),
      wageCategories: sanitizeFrameworkOptions(wageCategoriesQuery.data ?? []),
      overtimeRules: sanitizeFrameworkOptions(overtimeRulesQuery.data ?? []),
      languages: sanitizeFrameworkOptions(languagesQuery.data ?? []),
      shiftTemplates: sanitizeFrameworkOptions(shiftTemplatesQuery.data ?? []),
      workLocations: sanitizeFrameworkOptions(workLocationsToFramework(workLocationsQuery.data ?? [])),
    }),
    [
      departmentsQuery.data,
      groupsQuery.data,
      workforceRolesQuery.data,
      workerTypesQuery.data,
      employmentStatusesQuery.data,
      jobDescriptionsQuery.data,
      wageCategoriesQuery.data,
      overtimeRulesQuery.data,
      languagesQuery.data,
      shiftTemplatesQuery.data,
      workLocationsQuery.data,
    ],
  );

  return {
    ...workforce,
    isLoading,
    hasError,
    errorMessage,
    queries: {
      departmentsQuery,
      groupsQuery,
      workforceRolesQuery,
      workerTypesQuery,
      employmentStatusesQuery,
      jobDescriptionsQuery,
      wageCategoriesQuery,
      overtimeRulesQuery,
      languagesQuery,
      shiftTemplatesQuery,
      workLocationsQuery,
    },
  };
}

function groupOptionsToFramework(groups: Array<{ id: string; name: string }>): FrameworkOption[] {
  return groups.map((entry) => ({ id: entry.id, name: entry.name }));
}

function workLocationsToFramework(locations: Array<{ id: string; name: string }>): FrameworkOption[] {
  return locations.map((entry) => ({ id: entry.id, name: entry.name }));
}

export function useInvalidateWorkforceFramework() {
  const queryClient = useQueryClient();
  return async (orgId?: string, propertyId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.departments(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.groups(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.workforceRoles(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.workerTypes(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.employmentStatuses(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.jobDescriptions(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.wageCategories(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.overtimeRules(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.languages(orgId) }),
      queryClient.invalidateQueries({ queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.shiftTemplates(orgId) }),
      queryClient.invalidateQueries({
        queryKey: WORKFORCE_FRAMEWORK_QUERY_KEYS.workLocations(propertyId, orgId),
      }),
    ]);
  };
}
