# Components Skill — Ground Crew HQ

## Auth — always use useAuth()
import { useAuth } from '@/contexts/AuthContext'

const {
  currentUser,        // { id, firstName, lastName, role, orgId, employeeId }
  currentPropertyId,  // string — currently selected property
  setCurrentPropertyId, // (id: string) => void
  orgId,              // string — shortcut for currentUser?.orgId
  signOut,            // async () => void
  isLoading,          // boolean — true while auth resolves
  isPlanActive,       // () => boolean — subscription check
} = useAuth()

## Data Hooks — always from supabase-queries.ts
import {
  useEmployees,           // (propertyId?, orgId?) => Employee[]
  useAssignments,         // (date, propertyId?) => Assignment[]
  useScheduleEntries,     // (date, propertyId?) => ScheduleEntry[]
  useTasks,               // (propertyId?, orgId?) => Task[]
  useEquipmentUnits,      // (propertyId?, orgId?) => EquipmentUnit[]
  useProperties,          // (orgId?) => Property[]
  useProgramSettings,     // (orgId?) => ProgramSettings
  useClockEvents,         // (employeeId, date?) => ClockEvent[]
  useClockEventsRange,    // (startDate, endDate, propertyId?) => ClockEvent[]
  useNotes,               // (propertyId?) => Note[]
  useChemicalApplicationLogsAll, // () => ChemicalApplicationLog[]
  useChemicalProducts,    // () => ChemicalProduct[]
  useWeatherLocations,    // (propertyId?) => WeatherLocation[]
  useWeatherStations,     // () => WeatherStation[]
  useWeatherDailyLogs,    // () => WeatherDailyLog[]
} from '@/lib/supabase-queries'

## Query Client
import { useQueryClient } from '@tanstack/react-query'
const queryClient = useQueryClient()

## Query Key Conventions
['employees'], ['assignments', date, propertyId],
['schedule-entries', date, propertyId], ['tasks'],
['equipment-units'], ['properties'], ['program-settings'],
['clock-events'], ['notes'], ['weather-locations'],
['weather-stations'], ['weather-daily-logs'],
['chemical-application-logs'], ['chemical-products']

## Standard Component Structure
export default function MyPage() {
  const { currentUser, currentPropertyId, orgId } = useAuth()
  const queryClient = useQueryClient()
  const { data: items = [], isLoading } = useItems(currentPropertyId, orgId)

  async function handleSave(item) {
    const { error } = await supabase.from('items').upsert({
      ...item,
      org_id: orgId,
      property_id: currentPropertyId,
    })
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['items'] })
    toast('Saved successfully')
  }

  if (isLoading) return <LoadingState />
  return <div>...</div>
}

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
