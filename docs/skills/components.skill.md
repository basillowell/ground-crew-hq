# Components Skill — Ground Crew HQ

## Auth — always use useAuth()
import { useAuth } from '@/contexts/AuthContext'

const {
  currentUser,        // AuthProfile | null — { authUser, appUserId, employeeId, orgId, role, status, subscriptionStatus, department, propertyId, fullName, title, email, phone }
  orgId,              // string | null — direct shortcut (same as currentUser?.orgId)
  currentPropertyId,  // string — currently selected property ('all' for admin/manager)
  setCurrentPropertyId, // (id: string) => void
  currentRole,        // AuthRole — 'admin' | 'manager' | 'employee' (never null)
  isAdmin,            // boolean
  isManager,          // boolean
  isEmployee,         // boolean
  signOut,            // async () => void
  isLoading,          // boolean — true while auth resolves
  isReady,            // boolean — true once auth is done (inverse of isLoading)
  isOrgReady,         // boolean — isReady && orgId is set
  hasSession,         // boolean — Supabase session exists
  hasProfileIssue,    // boolean — ready but no orgId (account not found)
  isPlanActive,       // () => boolean — subscription check
  authState,          // 'checking-session' | 'loading-profile' | 'authenticated' | 'no-session' | 'profile-missing' | 'network-timeout' | 'profile-error'
  authDebugMessage,   // string — human-readable debug info
  retryAuthHydration, // async () => void — retry profile load
  user,               // User | null — raw Supabase auth user
  userRole,           // AuthRole | null — role from app_users table
} = useAuth()

## Data Hooks — always from supabase-queries.ts
import {
  // --- Core operational ---
  useEmployees,               // (propertyId?, orgId?, status?: 'active'|'inactive'|'archived'|'all') => Employee[]
  useAssignments,             // (date, propertyId?, orgId?) => Assignment[]
  useAssignmentsRange,        // (startDate, endDate, propertyId?, orgId?) => Assignment[]
  useScheduleEntries,         // (date, propertyId?, orgId?) => ScheduleEntry[]
  useScheduleEntriesRange,    // (startDate, endDate, propertyId?, orgId?) => ScheduleEntry[]
  useTasks,                   // (_propertyId?, orgId?) => Task[]  — propertyId param ignored, tasks are org-wide
  useEquipmentUnits,          // (propertyId?, orgId?) => EquipmentUnit[]
  useProperties,              // (orgId?) => Property[]
  useProgramSettings,         // (orgId?) => ProgramSettings | null
  useClockEvents,             // (date, propertyId?, orgId?) => ClockEvent[]
  useClockEventsRange,        // (startDate, endDate, propertyId?, orgId?) => ClockEvent[]
  useNotes,                   // (propertyId?, orgId?) => Note[]

  // --- Workforce framework ---
  useDepartmentOptions,       // (orgId?) => DepartmentOption[]  — queries 'departments' table
  useGroupOptions,            // (orgId?) => GroupOption[]        — queries 'employee_groups' table
  useRoleOptions,             // (orgId?) => RoleOption[]         — queries 'workforce_roles' table
  useLanguageOptions,         // (orgId?) => LanguageOption[]
  useShiftTemplates,          // (orgId?) => ShiftTemplate[]
  useWorkerTypes,             // (orgId?) => { id, name }[]
  useJobDescriptions,         // (orgId?) => { id, name }[]
  useEmploymentStatuses,      // (orgId?) => { id, name }[]
  useWageCategories,          // (orgId?) => { id, name }[]
  useOvertimeRules,           // (orgId?) => { id, name }[]

  // --- Weather ---
  useWeatherLocations,        // (propertyId?, orgId?, activeOnly?) => WeatherLocation[]
  useWeatherStations,         // () => WeatherStationSummary[]
  useWeatherDailyLogs,        // () => WeatherDailyLog[]  — fetches ALL logs, no params
  useWeatherDailyLogsRange,   // (startDate, endDate, propertyId?, orgId?) => WeatherDailyLog[]
  useWeatherDailyLogsByIds,   // (ids: string[]) => WeatherDailyLog[]

  // --- Chemical / compliance ---
  useChemicalApplicationLogsAll,  // (orgId?) => ChemicalApplicationLog[]
  useChemicalApplicationLogsRange, // (startDate, endDate, propertyId?, orgId?) => ChemicalApplicationLog[]
  useChemicalApplicationLogs,     // (date, orgId?) => partial fields only (weatherLogId, license numbers)
  useChemicalProducts,            // () => ChemicalProduct[]
  useChemicalApplicationTankMixItems, // () => ChemicalApplicationTankMixItem[]
  useApplicationAreas,            // (propertyId?) => ApplicationArea[]

  // --- Config ---
  usePropertyClassOptions,    // () => PropertyClassOption[]
  useWorkLocations,           // (propertyId?, orgId?) => WorkLocation[]
} from '@/lib/supabase-queries'

## Query Client
import { useQueryClient } from '@tanstack/react-query'
const queryClient = useQueryClient()

## Query Key Conventions
['employees', propertyId, orgId, status]
['assignments', date, propertyId, orgId]
['assignments-range', startDate, endDate, propertyId, orgId]
['schedule-entries', date, propertyId, orgId]
['schedule-entries-range', startDate, endDate, propertyId, orgId]
['tasks', orgId]
['equipment-units', propertyId, orgId]
['properties', orgId]
['program-settings', orgId]
['clock-events', date, propertyId, orgId]
['clock-events-range', startDate, endDate, propertyId, orgId]
['notes', propertyId, orgId]
['department-options', orgId]
['group-options', orgId]
['role-options', orgId]
['language-options', orgId]
['shift-templates', orgId]
['worker-types', orgId]
['job-descriptions', orgId]
['employment-statuses', orgId]
['wage-categories', orgId]
['overtime-rules', orgId]
['weather-locations', propertyId, orgId, activeOnly]
['weather-stations']
['weather-daily-logs-all']
['weather-daily-logs-range', startDate, endDate, propertyId, orgId]
['weather-daily-logs-by-ids', sortedKey]
['chemical-application-logs', date, orgId]
['chemical-application-logs-range', startDate, endDate, propertyId, orgId]
['chemical-application-logs-all', orgId]
['chemical-products']
['chemical-application-tank-mix-items']
['application-areas', propertyId]
['property-class-options']
['work-locations', propertyId, orgId]

## Standard Component Structure
export default function MyPage() {
  const { currentUser, currentPropertyId, orgId } = useAuth()
  const queryClient = useQueryClient()
  const { data: items = [], isLoading } = useItems(currentPropertyId, orgId)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSave(item) {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('items').upsert({
        ...item,
        org_id: orgId,
        property_id: currentPropertyId,
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['items'] })
      toast('Saved successfully')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingState />
  return <div>...</div>
}

Property insert forms must use this submitting/loading guard pattern and disable the save action while the insert is in flight.

## Offline Pattern (field page only)
const PENDING_KEY = 'gcrew-pending-clocks'
// Save locally first, sync on reconnect
// See MobileFieldWorkspacePage.tsx for full implementation

## Navigation
import { useNavigate } from 'react-router-dom'
const navigate = useNavigate()
navigate('/app/workboard')

## Toast
import { toast } from '@/components/ui/sonner'
toast('Success message')
toast.error('Error message')

## Loading States
Every page that fetches data must handle isLoading:
  if (isLoading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

## Error States
Every Supabase mutation must handle errors:
  const { error } = await supabase.from('table').upsert({...})
  if (error) {
    toast.error('Save failed: ' + error.message)
    return
  }

## Empty States
Every list that could be empty must show a helpful message:
  if (!items?.length) return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        No items yet. Add your first one to get started.
      </p>
    </div>
  )
