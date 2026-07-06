import { useEffect, useMemo, useState } from 'react';
import { addHours, format } from 'date-fns';
import {
  ClipboardList,
  Download,
  FileText,
  Filter,
  FlaskConical,
  Printer,
  ShieldCheck,
  Sprout,
  Wind,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { PageHeader } from '@/components/shared';
import {
  type ApplicationArea,
  type ChemicalApplicationLog,
  type ChemicalApplicationTankMixItem,
  type ChemicalProduct,
  type Employee,
  type EquipmentUnit,
} from '@/data/seedData';
import {
  useChemicalApplicationTankMixItems,
  useChemicalProducts,
  useEmployees,
  useEquipmentUnits,
  useProperties,
} from '@/lib/supabase-queries';
import { formatTime } from '@/utils/formatTime';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import ChemicalSettings from '@/pages/settings/ChemicalSettings';
import { useChemicalLogs } from '@/hooks/useChemicalLogs';
import { PageSkeleton } from '@/components/PageSkeleton';

type DraftMixItem = {
  productId: string;
  rateApplied: string;
  rateUnit: string;
  totalQuantityUsed: string;
};

type ApplicationDraft = {
  applicationDate: string;
  startTime: string;
  endTime: string;
  propertyId: string;
  targetPest: string;
  agronomicPurpose: string;
  applicationMethod: string;
  carrierVolume: string;
  totalMixVolume: string;
  areaTreated: string;
  areaUnit: string;
  applicatorId: string;
  applicatorLicenseNumber: string;
  supervisorName: string;
  supervisorLicenseNumber: string;
  equipmentUsedId: string;
  windDirection: string;
  windSpeedAtApplication: string;
  temperatureAtApplication: string;
  humidityAtApplication: string;
  restrictedEntryUntil: string;
  siteConditions: string;
  notes: string;
};

const emptyDraft: ApplicationDraft = {
  applicationDate: '2024-03-26',
  startTime: '05:30',
  endTime: '07:00',
  propertyId: '',
  targetPest: '',
  agronomicPurpose: '',
  applicationMethod: 'Ground spray',
  carrierVolume: '120',
  totalMixVolume: '120',
  areaTreated: '3.5',
  areaUnit: 'acres',
  applicatorId: '',
  applicatorLicenseNumber: '',
  supervisorName: '',
  supervisorLicenseNumber: '',
  equipmentUsedId: '',
  windDirection: '',
  windSpeedAtApplication: '',
  temperatureAtApplication: '',
  humidityAtApplication: '',
  restrictedEntryUntil: '',
  siteConditions: '',
  notes: '',
};

const emptyMixItem: DraftMixItem = {
  productId: '',
  rateApplied: '0',
  rateUnit: 'oz/acre',
  totalQuantityUsed: '0',
};

function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  link.click();
}

function quoteCsv(value: string | number) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'MMM d, yyyy h:mm a');
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type AbortableSupabaseRequest<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
};

async function withChemicalLookupRequestTimeout<T>(request: AbortableSupabaseRequest<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Chemical lookup request timed out after 15 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function withChemicalMutationTimeout<T extends { error: unknown }>(request: AbortableSupabaseRequest<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      return { data: null, error: new Error('Save timed out — please try again') } as T;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
function buildRestrictedEntry(
  draft: ApplicationDraft,
  products: ChemicalProduct[],
  draftMixItems: DraftMixItem[]
) {
  if (draft.restrictedEntryUntil) return draft.restrictedEntryUntil;
  const maxReentry = Math.max(
    0,
    ...draftMixItems.map((item) => products.find((product) => product.id === item.productId)?.reentryIntervalHours ?? 0)
  );
  if (!draft.applicationDate || !draft.endTime || maxReentry <= 0) return '';
  return addHours(new Date(`${draft.applicationDate}T${draft.endTime}:00`), maxReentry).toISOString();
}

export default function ApplicationsPage() {
  const { currentUser, currentPropertyId } = useAuth();
  const queryClient = useQueryClient();
  const propertyScope = currentPropertyId === 'all' ? undefined : currentPropertyId;
  const orgScope = currentUser?.orgId;

  const employeesQuery = useEmployees(propertyScope, orgScope);
  const propertiesQuery = useProperties(orgScope);
  const equipmentUnitsQuery = useEquipmentUnits(propertyScope, orgScope);
  const logsQuery = useChemicalLogs(orgScope, propertyScope);
  const productsQuery = useChemicalProducts();
  const mixItemsQuery = useChemicalApplicationTankMixItems();
  const applicationAreasQuery = useQuery<ApplicationArea[]>({
    queryKey: ['chemical-application-areas', orgScope ?? 'no-org'],
    enabled: Boolean(orgScope),
    queryFn: async () => {
      if (!supabase || !orgScope) return [];
      const { data, error } = await withChemicalLookupRequestTimeout(
        supabase
          .from('application_areas')
          .select('*')
          .eq('org_id', orgScope)
          .order('name'),
      );
      if (error) throw error;
      return (data ?? []) as ApplicationArea[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const applicationAreas = applicationAreasQuery.data ?? [];

  const employees = employeesQuery.data ?? [];
  const equipmentUnits = equipmentUnitsQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const chemicalProducts = productsQuery.data ?? [];
  const mixItems = mixItemsQuery.data ?? [];
  const [filterDate, setFilterDate] = useState('');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterApplicator, setFilterApplicator] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'settings'>('logs');
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft);
  const [draftMixItems, setDraftMixItems] = useState<DraftMixItem[]>([{ ...emptyMixItem }]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    document.title = 'Chemical Logs — Ground Crew HQ';
  }, []);

  useEffect(() => {
    if (!applicationAreas.length && !employees.length && !equipmentUnits.length && !chemicalProducts.length) {
      return;
    }
    setDraft((current) => ({
      ...current,
      propertyId: current.propertyId || propertyScope || properties[0]?.id || '',
      applicatorId: current.applicatorId || employees[0]?.id || '',
      equipmentUsedId: current.equipmentUsedId || equipmentUnits[0]?.id || '',

    }));
    setDraftMixItems((current) =>
      current.map((item) => ({
        ...item,
        productId: item.productId || chemicalProducts[0]?.id || '',
        rateUnit:
          chemicalProducts.find((product) => product.id === item.productId)?.rateUnit
          ?? chemicalProducts[0]?.rateUnit
          ?? item.rateUnit,
      })),
    );
  }, [chemicalProducts, employees, equipmentUnits, properties, propertyScope]);

  useEffect(() => {
    if (!draft.applicatorId) return;
    const selectedEmployee = employees.find((employee) => employee.id === draft.applicatorId);
    if (!selectedEmployee) return;
    const knownLicense = (selectedEmployee as Employee & { licenseNumber?: string }).licenseNumber;
    if (!knownLicense || draft.applicatorLicenseNumber) return;
    setDraft((current) => ({ ...current, applicatorLicenseNumber: knownLicense }));
  }, [draft.applicatorId, draft.applicatorLicenseNumber, employees]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logMixItems = mixItems.filter((item) => item.applicationLogId === log.id);
      const matchesDate = !filterDate || log.applicationDate === filterDate;
      const matchesProperty =
        filterProperty === 'all' ||
        String((log as ChemicalApplicationLog & { property_id?: string | null }).property_id ?? '') === filterProperty;
      const matchesApplicator = filterApplicator === 'all' || log.applicatorId === filterApplicator;
      const matchesProduct =
        filterProduct === 'all' || logMixItems.some((item) => item.productId === filterProduct);
      return matchesDate && matchesProperty && matchesApplicator && matchesProduct;
    });
  }, [filterApplicator, filterDate, filterProduct, filterProperty, logs, mixItems]);

  const totalApplications = filteredLogs.length;
  const totalArea = filteredLogs.reduce((sum, log) => sum + (log.areaTreated ?? 0), 0);
  const uniqueProducts = new Set(
    filteredLogs.flatMap((log) =>
      mixItems.filter((item) => item.applicationLogId === log.id).map((item) => item.productId)
    )
  ).size;
  const restrictedUseLogs = filteredLogs.filter((log) =>
    mixItems
      .filter((item) => item.applicationLogId === log.id)
      .some((item) => chemicalProducts.find((product) => product.id === item.productId)?.restrictedUse)
  ).length;

  function addMixItem() {
    setDraftMixItems((current) => [
      ...current,
      {
        ...emptyMixItem,
        productId: chemicalProducts[0]?.id ?? '',
        rateUnit: chemicalProducts[0]?.rateUnit ?? emptyMixItem.rateUnit,
      },
    ]);
  }

  function removeMixItem(index: number) {
    setDraftMixItems((current) =>
      current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateMixItem(index: number, next: Partial<DraftMixItem>) {
    setDraftMixItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const product = chemicalProducts.find((entry) => entry.id === (next.productId ?? item.productId));
        return {
          ...item,
          ...next,
          rateUnit: next.rateUnit ?? product?.rateUnit ?? item.rateUnit,
        };
      })
    );
  }

  async function saveApplication() {
    const missingFields: string[] = [];
    if (!draft.applicationDate) missingFields.push('Application Date');
    if (!draft.startTime) missingFields.push('Start Time');
    if (!draft.endTime) missingFields.push('End Time');
    if (!draft.propertyId) missingFields.push('Property');
    if (!draft.applicatorId) missingFields.push('Applicator');
    if (!draft.areaTreated || numberValue(draft.areaTreated) <= 0) missingFields.push('Area Treated');
    if (!draft.areaUnit) missingFields.push('Area Unit');
    if (!draft.applicationMethod) missingFields.push('Application Method');
    if (!selectedAreaIdForProperty) missingFields.push('Area / Location mapping');

    if (missingFields.length > 0) {
      setValidationErrors([`Missing required fields: ${missingFields.join(', ')}`]);
      return;
    }
    if (draft.endTime <= draft.startTime) {
      setValidationErrors(['End Time must be after Start Time.']);
      return;
    }

    setValidationErrors([]);
    setSaving(true);

    const logId = crypto.randomUUID();

    const restrictedEntryUntil = buildRestrictedEntry(draft, chemicalProducts, draftMixItems);
    const applicationTimestamp = `${draft.applicationDate}T${draft.startTime}:00-04:00`;
    const nextLogPayload: Record<string, string | number | boolean | null> = {
      id: logId,
      application_date: draft.applicationDate,
      start_time: draft.startTime,
      end_time: draft.endTime,
      application_timestamp: applicationTimestamp,
      area_id: selectedAreaIdForProperty,
      target_pest: draft.targetPest.trim(),
      agronomic_purpose: draft.agronomicPurpose.trim(),
      application_method: draft.applicationMethod,
      carrier_volume: numberValue(draft.carrierVolume),
      total_mix_volume: numberValue(draft.totalMixVolume),
      area_treated: numberValue(draft.areaTreated),
      area_unit: draft.areaUnit,
      applicator_id: draft.applicatorId,
      applicator_license_number: draft.applicatorLicenseNumber.trim(),
      supervisor_name: draft.supervisorName.trim(),
      supervisor_license_number: draft.supervisorLicenseNumber.trim(),
      equipment_used_id: draft.equipmentUsedId || null,
      wind_direction: draft.windDirection,
      wind_speed_at_application: numberValue(draft.windSpeedAtApplication),
      temperature_at_application: numberValue(draft.temperatureAtApplication),
      humidity_at_application: numberValue(draft.humidityAtApplication),
      restricted_entry_until: restrictedEntryUntil,
      site_conditions: draft.siteConditions,
      notes: draft.notes,
      org_id: currentUser?.orgId ?? null,
    };
    const nextMix = draftMixItems
      .filter((item) => item.productId)
      .map((item, index) => ({
      id: crypto.randomUUID(),
      application_log_id: logId,
      product_id: item.productId,
      rate_applied: numberValue(item.rateApplied),
      rate_unit: item.rateUnit,
      total_quantity_used: numberValue(item.totalQuantityUsed),
      mix_order: index + 1,
      org_id: currentUser?.orgId,
    }));

    try {
      if (import.meta.env.DEV) {
        console.debug('[chemical-save] started', { logId, payload: nextLogPayload, mixCount: nextMix.length });
      }

      const { error: logError } = await withChemicalMutationTimeout(
        supabase.from('chemical_application_logs').upsert(nextLogPayload),
      );
      if (logError) {
        if (import.meta.env.DEV) console.error('[chemical-save] main log error', logError);
        toast.error(`Failed to save application log: ${logError.message}`);
        return;
      }

      if (import.meta.env.DEV) console.debug('[chemical-save] main log saved');

      for (const mix of nextMix) {
        const { error } = await withChemicalMutationTimeout(
          supabase.from('chemical_application_tank_mix_items').upsert(mix),
        );
        if (error) {
          if (import.meta.env.DEV) console.error('[chemical-save] tank mix error', { mix, error });
          toast.error(`Failed to save tank mix item: ${error.message}`);
          return;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['chemical-logs'] });
      await queryClient.invalidateQueries({ queryKey: ['chemical-application-logs-all'] });
      await queryClient.invalidateQueries({ queryKey: ['chemical-application-tank-mix-items'] });

      toast.success('Chemical application logged');
      setDialogOpen(false);
      setDraft({
        ...emptyDraft,
        propertyId: propertyScope || properties[0]?.id || '',
        applicatorId: employees[0]?.id ?? '',
        equipmentUsedId: equipmentUnits[0]?.id ?? '',

      });
      setDraftMixItems([
        {
          ...emptyMixItem,
          productId: chemicalProducts[0]?.id ?? '',
          rateUnit: chemicalProducts[0]?.rateUnit ?? emptyMixItem.rateUnit,
        },
      ]);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[chemical-save] unexpected error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save application log.');
    } finally {
      if (import.meta.env.DEV) console.debug('[chemical-save] finished');
      setSaving(false);
    }
  }

  function exportLogs() {
    const header = [
      'application_date',
      'application_timestamp',
      'area',
      'products',
      'applicator',
      'license_number',
      'supervisor',
      'method',
      'carrier_volume_gal',
      'total_mix_volume_gal',
      'area_treated',
      'wind_direction',
      'wind_speed_mph',
      'temperature_f',
      'humidity_percent',
      'restrictedEntryUntil',
      'notes',
    ];
    const rows = filteredLogs.map((log) => {
      const propertyName =
        properties.find((property) => property.id === (log as ChemicalApplicationLog & { property_id?: string }).property_id)?.name
        ?? (log as ChemicalApplicationLog & { property_id?: string }).property_id
        ?? log.areaId;
      const applicator = employees.find((employee) => employee.id === log.applicatorId);
      const productNames = mixItems
        .filter((item) => item.applicationLogId === log.id)
        .sort((left, right) => (left.mixOrder ?? 0) - (right.mixOrder ?? 0))
        .map((item) => {
          const product = chemicalProducts.find((productEntry) => productEntry.id === item.productId);
          return `${product?.name ?? item.productId} (${item.rateApplied} ${item.rateUnit}; ${item.totalQuantityUsed} total)`;
        })
        .join(' | ');
      return [
        quoteCsv(log.applicationDate),
        quoteCsv(log.applicationTimestamp ?? `${log.applicationDate}T${log.startTime}:00`),
        quoteCsv(propertyName),
        quoteCsv(productNames),
        quoteCsv(applicator ? `${applicator.firstName} ${applicator.lastName}` : log.applicatorId),
        quoteCsv(log.applicatorLicenseNumber ?? ''),
        quoteCsv([log.supervisorName, log.supervisorLicenseNumber].filter(Boolean).join(' / ')),
        quoteCsv(log.applicationMethod ?? ''),
        quoteCsv(log.carrierVolume),
        quoteCsv(log.totalMixVolume ?? 0),
        quoteCsv(`${log.areaTreated} ${log.areaUnit}`),
        quoteCsv(log.windDirection ?? ''),
        quoteCsv(log.windSpeedAtApplication ?? 0),
        quoteCsv(log.temperatureAtApplication ?? 0),
        quoteCsv(log.humidityAtApplication ?? 0),
        quoteCsv(log.restrictedEntryUntil ?? ''),
        quoteCsv(log.notes),
      ].join(',');
    });
    downloadCsv('licensed-application-log.csv', [header.join(','), ...rows]);
  }

  function exportForAudit() {
    const header = [
      'date',
      'product_name',
      'epa_registration_number',
      'applicator_name',
      'area_treated',
      'application_rate',
      'field_conditions',
      'supervisorLicenseNumber',
      'rei_hours',
      'phi_days',
    ];

    const rows = filteredLogs.map((log) => {
      const applicator = employees.find((employee) => employee.id === log.applicatorId);
      const logMixItems = mixItems
        .filter((item) => item.applicationLogId === log.id)
        .sort((left, right) => (left.mixOrder ?? 0) - (right.mixOrder ?? 0));
      const primaryMixItem = logMixItems[0];
      const product = chemicalProducts.find((entry) => entry.id === primaryMixItem?.productId);
      const productNames = logMixItems
        .map((item) => chemicalProducts.find((entry) => entry.id === item.productId)?.name)
        .filter(Boolean)
        .join(' | ');
      const rateText = logMixItems
        .map((item) => `${item.rateApplied ?? 0} ${item.rateUnit ?? ''}`.trim())
        .join(' | ');
      const conditionText = [
        log.siteConditions ?? '',
        `Wind ${log.windSpeedAtApplication ?? 0} mph`,
        `Temp ${log.temperatureAtApplication ?? 0}F`,
      ].filter(Boolean).join(' Â· ');

      return [
        quoteCsv(log.applicationDate),
        quoteCsv(productNames || 'Not recorded'),
        quoteCsv(product?.epaRegistrationNumber ?? 'Not recorded'),
        quoteCsv(applicator ? `${applicator.firstName} ${applicator.lastName}` : 'Not recorded'),
        quoteCsv(`${log.areaTreated ?? 0} ${log.areaUnit ?? ''}`.trim()),
        quoteCsv(rateText || 'Not recorded'),
        quoteCsv(conditionText || 'Not recorded'),
        quoteCsv(log.supervisorLicenseNumber ?? 'Not recorded'),
        quoteCsv(product?.reentryIntervalHours ?? 0),
        quoteCsv(product?.preHarvestIntervalHours ?? 0),
      ].join(',');
    });

    downloadCsv('chemical-audit-export.csv', [header.join(','), ...rows]);
  }

  if (
    employeesQuery.isLoading ||
    propertiesQuery.isLoading ||
    equipmentUnitsQuery.isLoading ||
    logsQuery.isLoading ||
    productsQuery.isLoading ||
    mixItemsQuery.isLoading
  ) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <PageHeader
        title="Applications"
        subtitle="Licensed applicator-ready chemical logging with tank mix detail, site condition detail, and exportable records."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{totalApplications} logs</Badge>
            <Badge className="bg-status-active/10 text-status-active border-status-active/20">EPA-Compliant Record Keeping</Badge>
          </div>
        }
        action={
          activeTab === 'logs'
            ? {
                label: 'New Application',
                onClick: () => {
                  setDialogOpen(true);
                },
                icon: <FlaskConical className="h-3.5 w-3.5" />,
              }
            : undefined
        }
      >
        {activeTab === 'logs' ? (
          <>
            <Button variant="outline" size="sm" className="gap-1" onClick={exportForAudit}>
              <Download className="h-3.5 w-3.5" /> Export for Audit
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={exportLogs}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </>
        ) : null}
      </PageHeader>

      <div className="flex items-center gap-2 rounded-xl border bg-card p-1">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
          }`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'settings' ? (
        <ChemicalSettings />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Application Logs</p>
          <p className="mt-2 text-3xl font-semibold">{totalApplications}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Area Treated</p>
          <p className="mt-2 text-3xl font-semibold">{totalArea.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">acres in current filter</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Products Used</p>
          <p className="mt-2 text-3xl font-semibold">{uniqueProducts}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Restricted Use Logs</p>
          <p className="mt-2 text-3xl font-semibold">{restrictedUseLogs}</p>
        </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Filter Application Logs</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)}>
              <option value="all">All Properties</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
              <option value="all">All Products</option>
              {chemicalProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterApplicator} onChange={(e) => setFilterApplicator(e.target.value)}>
              <option value="all">All Applicators</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
            </select>
          </div>
        </Card>
      </div>

          <div className="space-y-3">
        {filteredLogs.map((log) => {
          const propertyName =
            properties.find((property) => property.id === (log as ChemicalApplicationLog & { property_id?: string }).property_id)?.name
            ?? (log as ChemicalApplicationLog & { property_id?: string }).property_id
            ?? log.areaId;
          const applicator = employees.find((employee) => employee.id === log.applicatorId);
          const equipment = equipmentUnits.find((unit) => unit.id === log.equipmentUsedId);

          const logMixItems = mixItems
            .filter((item) => item.applicationLogId === log.id)
            .sort((left, right) => (left.mixOrder ?? 0) - (right.mixOrder ?? 0));
          const hasRestrictedUse = logMixItems.some(
            (item) => chemicalProducts.find((product) => product.id === item.productId)?.restrictedUse
          );

          return (
            <Card key={log.id} className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{propertyName}</h3>
                    <Badge variant="outline">{log.applicationDate}</Badge>
                    <Badge variant="secondary">{formatTime(log.startTime)} - {formatTime(log.endTime)}</Badge>
                    {hasRestrictedUse && <Badge variant="destructive">Restricted Use</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{log.targetPest} - {log.agronomicPurpose}</p>
                  <div className="flex flex-wrap gap-5 text-sm">
                    <div><span className="text-muted-foreground">Applicator:</span> {applicator ? `${applicator.firstName} ${applicator.lastName}` : log.applicatorId}</div>
                    <div><span className="text-muted-foreground">License:</span> {log.applicatorLicenseNumber ?? 'Not recorded'}</div>
                    <div><span className="text-muted-foreground">Method:</span> {log.applicationMethod ?? 'Not recorded'}</div>
                    <div><span className="text-muted-foreground">Equipment:</span> {equipment?.unitNumber ?? 'Not recorded'}</div>
                    <div><span className="text-muted-foreground">Area:</span> {log.areaTreated} {log.areaUnit}</div>
                    <div><span className="text-muted-foreground">Carrier:</span> {log.carrierVolume} gal</div>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground xl:max-w-sm">
                  <Wind className="h-3.5 w-3.5" />
                  <span>Wind {log.windSpeedAtApplication ?? 0} mph ? Temp {log.temperatureAtApplication ?? 0}F</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {logMixItems.map((item) => {
                  const product = chemicalProducts.find((entry) => entry.id === item.productId);
                  return (
                    <div key={item.id} className="rounded-xl border bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Sprout className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">{product?.name ?? item.productId}</p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{product?.productType}</p>
                      <p className="mt-1 text-sm">{item.rateApplied} {item.rateUnit}</p>
                      <p className="text-xs text-muted-foreground">{item.totalQuantityUsed} total used</p>
                    </div>
                  );
                })}
              </div>

              {log.notes && (
                <div className="mt-4 rounded-xl bg-accent/30 px-4 py-3 text-sm text-muted-foreground">
                  <FileText className="mr-2 inline h-4 w-4" />
                  {log.notes}
                </div>
              )}
            </Card>
          );
        })}

        {filteredLogs.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No application logs match the current filters.
          </Card>
        )}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby="dialog-desc" className="max-h-[90vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>New Chemical Application</DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              Enter spray record details, compliance information, and tank mix products.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Application Date *</label>
                  <Input id="application-date" name="application_date" className="mt-1" type="date" value={draft.applicationDate} onChange={(e) => setDraft((current) => ({ ...current, applicationDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Time *</label>
                  <Input id="application-start-time" name="start_time" className="mt-1" type="time" value={draft.startTime} onChange={(e) => setDraft((current) => ({ ...current, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Time *</label>
                  <Input id="application-end-time" name="end_time" className="mt-1" type="time" value={draft.endTime} onChange={(e) => setDraft((current) => ({ ...current, endTime: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Property *</label>
                  {properties.length > 0 ? (
                    <select id="application-property" name="property_id" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.propertyId} onChange={(e) => setDraft((current) => ({ ...current, propertyId: e.target.value }))}>
                      {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                  ) : (
                    <div className="mt-1 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      No properties configured
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Applicator *</label>
                  <select id="application-applicator" name="applicator_id" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.applicatorId} onChange={(e) => setDraft((current) => ({ ...current, applicatorId: e.target.value }))}>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Target Pest</label>
                  <Input id="target-pest" name="target_pest" className="mt-1" value={draft.targetPest} onChange={(e) => setDraft((current) => ({ ...current, targetPest: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Agronomic Purpose</label>
                  <Input id="agronomic-purpose" name="agronomic_purpose" className="mt-1" value={draft.agronomicPurpose} onChange={(e) => setDraft((current) => ({ ...current, agronomicPurpose: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Carrier Volume</label>
                  <Input id="carrier-volume" name="carrier_volume" className="mt-1" type="number" value={draft.carrierVolume} onChange={(e) => setDraft((current) => ({ ...current, carrierVolume: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total Mix Volume</label>
                  <Input id="total-mix-volume" name="total_mix_volume" className="mt-1" type="number" value={draft.totalMixVolume} onChange={(e) => setDraft((current) => ({ ...current, totalMixVolume: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Area Treated *</label>
                  <Input id="area-treated" name="area_treated" className="mt-1" type="number" value={draft.areaTreated} onChange={(e) => setDraft((current) => ({ ...current, areaTreated: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Area Unit *</label>
                  <Input id="area-unit" name="area_unit" className="mt-1" value={draft.areaUnit} onChange={(e) => setDraft((current) => ({ ...current, areaUnit: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Equipment Used</label>
                  <select id="equipment-used" name="equipment_used_id" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.equipmentUsedId} onChange={(e) => setDraft((current) => ({ ...current, equipmentUsedId: e.target.value }))}>
                    <option value="">No equipment selected</option>
                    {equipmentUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber || unit.name || unit.id}</option>)}
                  </select>
                </div>
              </div>

              <Card className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Licensed Applicator Compliance</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Application Method *</label>
                    <Input id="application-method" name="application_method" className="mt-1" value={draft.applicationMethod} onChange={(e) => setDraft((current) => ({ ...current, applicationMethod: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Applicator License #</label>
                    <Input id="applicator-license-number" name="applicator_license_number" className="mt-1" value={draft.applicatorLicenseNumber} onChange={(e) => setDraft((current) => ({ ...current, applicatorLicenseNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Supervisor</label>
                    <Input id="supervisor-name" name="supervisor_name" className="mt-1" value={draft.supervisorName} onChange={(e) => setDraft((current) => ({ ...current, supervisorName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Supervisor License #</label>
                    <Input id="supervisor-license-number" name="supervisor_license_number" className="mt-1" value={draft.supervisorLicenseNumber} onChange={(e) => setDraft((current) => ({ ...current, supervisorLicenseNumber: e.target.value }))} />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Tank Mix</p>
                    <p className="text-xs text-muted-foreground">Log each product in order with the actual rate and total quantity used.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addMixItem}>Add Product</Button>
                </div>
                <div className="space-y-3">
                  {draftMixItems.map((item, index) => {
                    const product = chemicalProducts.find((entry) => entry.id === item.productId);
                    return (
                      <div key={`${item.productId}-${index}`} className="rounded-xl border p-3">
                        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto]">
                          <select id={`tank-mix-product-${index}`} name={`tank_mix[${index}].product_id`} className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={item.productId} onChange={(e) => updateMixItem(index, { productId: e.target.value })}>
                            {chemicalProducts.map((productOption) => <option key={productOption.id} value={productOption.id}>{productOption.name}</option>)}
                          </select>
                          <Input id={`tank-mix-rate-${index}`} name={`tank_mix[${index}].rate_applied`} type="number" placeholder="Rate" value={item.rateApplied} onChange={(e) => updateMixItem(index, { rateApplied: e.target.value })} />
                          <Input id={`tank-mix-unit-${index}`} name={`tank_mix[${index}].rate_unit`} placeholder="Unit" value={item.rateUnit} onChange={(e) => updateMixItem(index, { rateUnit: e.target.value })} />
                          <Input id={`tank-mix-total-${index}`} name={`tank_mix[${index}].total_quantity_used`} type="number" placeholder="Total amount" value={item.totalQuantityUsed} onChange={(e) => updateMixItem(index, { totalQuantityUsed: e.target.value })} />
                          <Button variant="ghost" size="sm" onClick={() => removeMixItem(index)}>Remove</Button>
                        </div>
                        {product && (
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                            <p>EPA: {product.epaRegistrationNumber || 'Not recorded'}</p>
                            <p>Formulation: {product.formulation || 'Not recorded'}</p>
                            <p>Signal Word: {product.signalWord || 'Not recorded'}</p>
                            <p>REI: {product.reentryIntervalHours ?? 0} hrs</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Wind className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Application Conditions</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Wind Direction</label>
                    <Input id="wind-direction" name="wind_direction" className="mt-1" value={draft.windDirection} onChange={(e) => setDraft((current) => ({ ...current, windDirection: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Wind Speed (mph)</label>
                    <Input id="wind-speed-at-application" name="wind_speed_at_application" className="mt-1" type="number" value={draft.windSpeedAtApplication} onChange={(e) => setDraft((current) => ({ ...current, windSpeedAtApplication: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Temperature (F)</label>
                    <Input id="temperature-at-application" name="temperature_at_application" className="mt-1" type="number" value={draft.temperatureAtApplication} onChange={(e) => setDraft((current) => ({ ...current, temperatureAtApplication: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Humidity (%)</label>
                    <Input id="humidity-at-application" name="humidity_at_application" className="mt-1" type="number" value={draft.humidityAtApplication} onChange={(e) => setDraft((current) => ({ ...current, humidityAtApplication: e.target.value }))} />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Restricted Entry Until</label>
                    <Input id="restricted-entry-until" name="restricted_entry_until" className="mt-1" type="datetime-local" value={draft.restrictedEntryUntil ? draft.restrictedEntryUntil.slice(0, 16) : ''} onChange={(e) => setDraft((current) => ({ ...current, restrictedEntryUntil: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Site Conditions</label>
                    <Input id="site-conditions" name="site_conditions" className="mt-1" value={draft.siteConditions} onChange={(e) => setDraft((current) => ({ ...current, siteConditions: e.target.value }))} />
                  </div>
                </div>
              </Card>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea id="application-notes" name="notes" className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-4">

              <Card className="p-4">
                <p className="text-sm font-semibold">Compliance Checklist</p>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p className="rounded-lg bg-muted/40 px-3 py-3">1. Record every product in tank mix order with the actual use rate and total quantity used.</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">2. Capture applicator and supervisor license details for the record.</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">3. Record site conditions and timing notes so the application record is ready for review.</p>
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-sm font-semibold">Selected Mix Summary</p>
                <div className="mt-3 space-y-3">
                  {draftMixItems.map((item, index) => {
                    const product = chemicalProducts.find((entry) => entry.id === item.productId);
                    return (
                      <div key={`${item.productId}-${index}-summary`} className="rounded-lg border px-3 py-3 text-sm">
                        <p className="font-medium">{index + 1}. {product?.name ?? 'Product not selected'}</p>
                        <p className="text-xs text-muted-foreground">{item.rateApplied} {item.rateUnit} · {item.totalQuantityUsed} total</p>
                        <p className="mt-1 text-xs text-muted-foreground">EPA {product?.epaRegistrationNumber ?? 'n/a'} · {product?.signalWord ?? 'No signal word'} · {product?.restrictedUse ? 'Restricted use' : 'General use'}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>

          {validationErrors.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {validationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t bg-background/95 pt-3 backdrop-blur">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveApplication} disabled={saving}>{saving ? 'Saving...' : 'Save Application Log'}</Button>
          </div>
        </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}




