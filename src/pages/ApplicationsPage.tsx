import { useEffect, useMemo, useState } from 'react';
import { addHours, format } from 'date-fns';
import {
  ClipboardList,
  Download,
  FileText,
  Filter,
  FlaskConical,
  Pencil,
  Printer,
  ShieldCheck,
  Sprout,
  Trash2,
  Wind,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateInput, TimeInput } from '@/components/ui/date-input';
import { toast } from '@/components/ui/sonner';
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
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import ChemicalSettings from '@/pages/settings/ChemicalSettings';
import { useChemicalLogs } from '@/hooks/useChemicalLogs';
import { PageSkeleton } from '@/components/PageSkeleton';

const supabase = createClient();

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

type ApplicationMode = 'chemical' | 'fertilizer';

type FertilizerProductRow = {
  id: string;
  name: string;
  fertilizer_type: string;
  rate_unit: string;
  org_id: string | null;
  created_at?: string;
  updated_at?: string;
};

type FertilizerApplicationLogRow = {
  id: string;
  application_date: string;
  start_time: string;
  end_time: string;
  property_id: string;
  applicator_id: string;
  fertilizer_product_id: string;
  rate: number;
  rate_unit: string;
  application_speed: number;
  speed_unit: string;
  area_treated: number;
  area_unit: string;
  total_amount: number;
  equipment_used_id: string | null;
  notes: string;
  org_id: string | null;
  created_at?: string;
  updated_at?: string;
};

type FertilizerDraft = {
  applicationDate: string;
  startTime: string;
  endTime: string;
  propertyId: string;
  applicatorId: string;
  fertilizerProductId: string;
  rate: string;
  rateUnit: string;
  applicationSpeed: string;
  speedUnit: string;
  areaTreated: string;
  areaUnit: string;
  totalAmount: string;
  equipmentUsedId: string;
  notes: string;
};

type FertilizerProductDraft = {
  name: string;
  fertilizerType: string;
  rateUnit: string;
};

type EmployeeApplicatorLicenseRow = {
  id: string;
  applicator_license_number: string | null;
};

const emptyFertilizerProductDraft: FertilizerProductDraft = {
  name: '',
  fertilizerType: '',
  rateUnit: 'lbs/acre',
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyFertilizerDraft(): FertilizerDraft {
  return {
    applicationDate: todayInputValue(),
    startTime: '05:30',
    endTime: '07:00',
    propertyId: '',
    applicatorId: '',
    fertilizerProductId: '',
    rate: '0',
    rateUnit: 'lbs/acre',
    applicationSpeed: '0',
    speedUnit: 'mph',
    areaTreated: '0',
    areaUnit: 'acres',
    totalAmount: '0',
    equipmentUsedId: '',
    notes: '',
  };
}


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

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}


type AbortableSupabaseRequest<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
};

async function withChemicalLookupRequestTimeout<T>(
  request: AbortableSupabaseRequest<T>,
  timeoutMessage = 'Chemical lookup request timed out after 15 seconds.',
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(timeoutMessage);
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
  const { currentUser, currentPropertyId } = useOrgProfile();
  const queryClient = useQueryClient();
  const propertyScope = currentPropertyId === 'all' ? undefined : currentPropertyId;
  const orgScope = currentUser?.orgId;

  const employeesQuery = useEmployees(propertyScope, orgScope);
  const employeeApplicatorLicensesQuery = useQuery({
    queryKey: ['employee-applicator-licenses', orgScope ?? 'all-orgs'],
    enabled: Boolean(orgScope),
    staleTime: 1000 * 60 * 30,
    retry: 3,
    retryDelay: 1000,
    queryFn: async () => {
      if (!orgScope) return [] as EmployeeApplicatorLicenseRow[];
      const { data, error } = await withChemicalLookupRequestTimeout(
        supabase
          .from('employees')
          .select('id, applicator_license_number')
          .eq('org_id', orgScope),
      );
      if (error) throw error;
      return (data ?? []) as EmployeeApplicatorLicenseRow[];
    },
  });
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

  const fertilizerProductsQuery = useQuery<FertilizerProductRow[]>({
    queryKey: ['fertilizer-products', orgScope ?? 'no-org'],
    enabled: Boolean(orgScope),
    queryFn: async () => {
      if (!supabase || !orgScope) return [];
      const { data, error } = await withChemicalLookupRequestTimeout(
        supabase
          .from('fertilizer_products')
          .select('id, name, fertilizer_type, rate_unit, org_id, created_at, updated_at')
          .eq('org_id', orgScope)
          .order('name'),
        'Fertilizer product lookup request timed out after 15 seconds.',
      );
      if (error) throw error;
      return (data ?? []) as FertilizerProductRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const fertilizerLogsQuery = useQuery<FertilizerApplicationLogRow[]>({
    queryKey: ['fertilizer-application-logs', orgScope ?? 'no-org', propertyScope ?? 'all'],
    enabled: Boolean(orgScope),
    queryFn: async () => {
      if (!supabase || !orgScope) return [];
      let query = supabase
        .from('fertilizer_application_logs')
        .select('id, application_date, start_time, end_time, property_id, applicator_id, fertilizer_product_id, rate, rate_unit, application_speed, speed_unit, area_treated, area_unit, total_amount, equipment_used_id, notes, org_id, created_at, updated_at')
        .eq('org_id', orgScope)
        .order('application_date', { ascending: false })
        .order('start_time', { ascending: false });
      if (propertyScope) query = query.eq('property_id', propertyScope);
      const { data, error } = await withChemicalLookupRequestTimeout(
        query,
        'Fertilizer application lookup request timed out after 15 seconds.',
      );
      if (error) throw error;
      return (data ?? []) as FertilizerApplicationLogRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const applicationAreas = applicationAreasQuery.data ?? [];

  const employees = employeesQuery.data ?? [];
  const employeeApplicatorLicenses = employeeApplicatorLicensesQuery.data ?? [];
  const equipmentUnits = equipmentUnitsQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const chemicalProducts = productsQuery.data ?? [];
  const mixItems = mixItemsQuery.data ?? [];
  const fertilizerProducts = fertilizerProductsQuery.data ?? [];
  const fertilizerLogs = fertilizerLogsQuery.data ?? [];
  const [filterDate, setFilterDate] = useState('');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterApplicator, setFilterApplicator] = useState('all');
  const [applicationMode, setApplicationMode] = useState<ApplicationMode>('chemical');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChemicalLogId, setEditingChemicalLogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'settings'>('logs');
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft);
  const [draftMixItems, setDraftMixItems] = useState<DraftMixItem[]>([{ ...emptyMixItem }]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveApplicatorLicenseToProfile, setSaveApplicatorLicenseToProfile] = useState(false);
  const [fertilizerFilterProduct, setFertilizerFilterProduct] = useState('all');
  const [fertilizerDialogOpen, setFertilizerDialogOpen] = useState(false);
  const [editingFertilizerLogId, setEditingFertilizerLogId] = useState<string | null>(null);
  const [fertilizerDraft, setFertilizerDraft] = useState<FertilizerDraft>(() => createEmptyFertilizerDraft());
  const [fertilizerSaving, setFertilizerSaving] = useState(false);
  const [fertilizerValidationErrors, setFertilizerValidationErrors] = useState<string[]>([]);
  const [showInlineFertilizerProductForm, setShowInlineFertilizerProductForm] = useState(false);
  const [inlineFertilizerProductDraft, setInlineFertilizerProductDraft] = useState<FertilizerProductDraft>(emptyFertilizerProductDraft);
  const [fertilizerProductDraft, setFertilizerProductDraft] = useState<FertilizerProductDraft>(emptyFertilizerProductDraft);
  const [fertilizerProductSaving, setFertilizerProductSaving] = useState(false);
  const [editingFertilizerProductId, setEditingFertilizerProductId] = useState<string | null>(null);
  const [editingFertilizerProductDraft, setEditingFertilizerProductDraft] = useState<FertilizerProductDraft>(emptyFertilizerProductDraft);
  const selectedApplicator = employees.find((employee) => employee.id === draft.applicatorId) ?? null;
  const selectedApplicatorName = selectedApplicator
    ? `${selectedApplicator.firstName} ${selectedApplicator.lastName}`.trim()
    : 'Selected applicator';
  const selectedApplicatorLicenseNumber =
    employeeApplicatorLicenses.find((employee) => employee.id === draft.applicatorId)?.applicator_license_number?.trim() ?? '';

  useEffect(() => {
    document.title = applicationMode === 'chemical' ? 'Applications - Ground Crew HQ' : 'Fertilizer Applications - Ground Crew HQ';
  }, [applicationMode]);

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
    setSaveApplicatorLicenseToProfile(false);
    if (!draft.applicatorId || editingChemicalLogId || !selectedApplicatorLicenseNumber || draft.applicatorLicenseNumber) return;
    setDraft((current) => ({ ...current, applicatorLicenseNumber: selectedApplicatorLicenseNumber }));
  }, [draft.applicatorId, draft.applicatorLicenseNumber, editingChemicalLogId, selectedApplicatorLicenseNumber]);


  useEffect(() => {
    if (!properties.length && !employees.length && !equipmentUnits.length && !fertilizerProducts.length) {
      return;
    }
    setFertilizerDraft((current) => {
      const selectedProduct = fertilizerProducts.find((product) => product.id === current.fertilizerProductId) ?? fertilizerProducts[0];
      return {
        ...current,
        propertyId: current.propertyId || propertyScope || properties[0]?.id || '',
        applicatorId: current.applicatorId || employees[0]?.id || '',
        equipmentUsedId: current.equipmentUsedId || equipmentUnits[0]?.id || '',
        fertilizerProductId: current.fertilizerProductId || selectedProduct?.id || '',
        rateUnit: current.rateUnit || selectedProduct?.rate_unit || 'lbs/acre',
      };
    });
  }, [employees, equipmentUnits, fertilizerProducts, properties, propertyScope]);

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

  const selectedAreaIdForProperty =
    applicationAreas.find((area) => area.property === draft.propertyId)?.id ?? applicationAreas[0]?.id ?? '';

  const filteredFertilizerLogs = useMemo(() => {
    return fertilizerLogs.filter((log) => {
      const matchesDate = !filterDate || log.application_date === filterDate;
      const matchesProperty = filterProperty === 'all' || log.property_id === filterProperty;
      const matchesApplicator = filterApplicator === 'all' || log.applicator_id === filterApplicator;
      const matchesProduct = fertilizerFilterProduct === 'all' || log.fertilizer_product_id === fertilizerFilterProduct;
      return matchesDate && matchesProperty && matchesApplicator && matchesProduct;
    });
  }, [fertilizerFilterProduct, fertilizerLogs, filterApplicator, filterDate, filterProperty]);

  const totalFertilizerApplications = filteredFertilizerLogs.length;
  const totalFertilizerArea = filteredFertilizerLogs.reduce((sum, log) => sum + Number(log.area_treated ?? 0), 0);
  const totalFertilizerAmount = filteredFertilizerLogs.reduce((sum, log) => sum + Number(log.total_amount ?? 0), 0);
  const uniqueFertilizerProducts = new Set(filteredFertilizerLogs.map((log) => log.fertilizer_product_id)).size;

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


  function buildFertilizerDraftDefaults(): FertilizerDraft {
    const product = fertilizerProducts[0];
    return {
      ...createEmptyFertilizerDraft(),
      propertyId: propertyScope || properties[0]?.id || '',
      applicatorId: employees[0]?.id || '',
      equipmentUsedId: equipmentUnits[0]?.id || '',
      fertilizerProductId: product?.id || '',
      rateUnit: product?.rate_unit || 'lbs/acre',
    };
  }

  function openFertilizerDialog() {
    setEditingFertilizerLogId(null);
    setFertilizerValidationErrors([]);
    setShowInlineFertilizerProductForm(false);
    setInlineFertilizerProductDraft(emptyFertilizerProductDraft);
    setFertilizerDraft((current) => ({
      ...buildFertilizerDraftDefaults(),
      applicationDate: current.applicationDate || todayInputValue(),
      startTime: current.startTime || '05:30',
      endTime: current.endTime || '07:00',
    }));
    setFertilizerDialogOpen(true);
  }

  function handleFertilizerDialogOpenChange(open: boolean) {
    setFertilizerDialogOpen(open);
    if (!open) setEditingFertilizerLogId(null);
  }

  function openEditFertilizerLog(log: FertilizerApplicationLogRow) {
    setEditingFertilizerLogId(log.id);
    setFertilizerValidationErrors([]);
    setShowInlineFertilizerProductForm(false);
    setFertilizerDraft({
      applicationDate: log.application_date,
      startTime: log.start_time,
      endTime: log.end_time,
      propertyId: log.property_id,
      applicatorId: log.applicator_id,
      fertilizerProductId: log.fertilizer_product_id,
      rate: String(log.rate ?? 0),
      rateUnit: log.rate_unit || 'lbs/acre',
      applicationSpeed: String(log.application_speed ?? 0),
      speedUnit: log.speed_unit || 'mph',
      areaTreated: String(log.area_treated ?? 0),
      areaUnit: log.area_unit || 'acres',
      totalAmount: String(log.total_amount ?? 0),
      equipmentUsedId: log.equipment_used_id ?? '',
      notes: log.notes ?? '',
    });
    setFertilizerDialogOpen(true);
  }

  function updateFertilizerProductSelection(productId: string) {
    const selectedProduct = fertilizerProducts.find((product) => product.id === productId);
    setFertilizerDraft((current) => ({
      ...current,
      fertilizerProductId: productId,
      rateUnit: selectedProduct?.rate_unit ?? current.rateUnit,
    }));
  }

  async function insertFertilizerProduct(productDraft: FertilizerProductDraft) {
    if (!orgScope) {
      toast.error('Workspace is still loading. Please try again in a moment.');
      return null;
    }

    const payload = {
      name: productDraft.name.trim(),
      fertilizer_type: productDraft.fertilizerType.trim(),
      rate_unit: productDraft.rateUnit.trim() || 'lbs/acre',
      org_id: orgScope,
    };

    if (!payload.name || !payload.fertilizer_type) {
      toast.error('Product name and fertilizer type are required.');
      return null;
    }

    const { data, error } = await withChemicalMutationTimeout(
      supabase
        .from('fertilizer_products')
        .insert(payload)
        .select('id, name, fertilizer_type, rate_unit, org_id, created_at, updated_at')
        .single(),
    );

    if (error) {
      toast.error(`Failed to save fertilizer product: ${getErrorMessage(error, 'Unknown error')}`);
      return null;
    }

    await queryClient.invalidateQueries({ queryKey: ['fertilizer-products'] });
    return data as FertilizerProductRow;
  }

  async function saveInlineFertilizerProduct() {
    setFertilizerProductSaving(true);
    try {
      const savedProduct = await insertFertilizerProduct(inlineFertilizerProductDraft);
      if (!savedProduct) return;
      setInlineFertilizerProductDraft(emptyFertilizerProductDraft);
      setShowInlineFertilizerProductForm(false);
      setFertilizerDraft((current) => ({
        ...current,
        fertilizerProductId: savedProduct.id,
        rateUnit: savedProduct.rate_unit || current.rateUnit,
      }));
      toast.success('Fertilizer product added');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save fertilizer product.'));
    } finally {
      setFertilizerProductSaving(false);
    }
  }

  async function saveSettingsFertilizerProduct() {
    setFertilizerProductSaving(true);
    try {
      const savedProduct = await insertFertilizerProduct(fertilizerProductDraft);
      if (!savedProduct) return;
      setFertilizerProductDraft(emptyFertilizerProductDraft);
      toast.success('Fertilizer product added');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save fertilizer product.'));
    } finally {
      setFertilizerProductSaving(false);
    }
  }

  function startEditFertilizerProduct(product: FertilizerProductRow) {
    setEditingFertilizerProductId(product.id);
    setEditingFertilizerProductDraft({
      name: product.name,
      fertilizerType: product.fertilizer_type,
      rateUnit: product.rate_unit,
    });
  }

  async function saveEditedFertilizerProduct() {
    if (!editingFertilizerProductId) return;
    if (!orgScope) {
      toast.error('Workspace is still loading. Please try again in a moment.');
      return;
    }

    const payload = {
      name: editingFertilizerProductDraft.name.trim(),
      fertilizer_type: editingFertilizerProductDraft.fertilizerType.trim(),
      rate_unit: editingFertilizerProductDraft.rateUnit.trim() || 'lbs/acre',
      org_id: orgScope,
    };

    if (!payload.name || !payload.fertilizer_type) {
      toast.error('Product name and fertilizer type are required.');
      return;
    }

    setFertilizerProductSaving(true);
    try {
      const { error } = await withChemicalMutationTimeout(
        supabase
          .from('fertilizer_products')
          .update(payload)
          .eq('id', editingFertilizerProductId)
          .eq('org_id', orgScope),
      );
      if (error) {
        toast.error(`Failed to update fertilizer product: ${getErrorMessage(error, 'Unknown error')}`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['fertilizer-products'] });
      setEditingFertilizerProductId(null);
      setEditingFertilizerProductDraft(emptyFertilizerProductDraft);
      toast.success('Fertilizer product updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update fertilizer product.'));
    } finally {
      setFertilizerProductSaving(false);
    }
  }

  async function deleteFertilizerProduct(product: FertilizerProductRow) {
    if (!orgScope) {
      toast.error('Workspace is still loading. Please try again in a moment.');
      return;
    }
    setFertilizerProductSaving(true);
    try {
      const { error } = await withChemicalMutationTimeout(
        supabase
          .from('fertilizer_products')
          .delete()
          .eq('id', product.id)
          .eq('org_id', orgScope),
      );
      if (error) {
        toast.error(`Failed to delete fertilizer product: ${getErrorMessage(error, 'Unknown error')}`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['fertilizer-products'] });
      toast.success('Fertilizer product deleted');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete fertilizer product.'));
    } finally {
      setFertilizerProductSaving(false);
    }
  }

  async function saveFertilizerApplication() {
    const missingFields: string[] = [];
    if (!fertilizerDraft.applicationDate) missingFields.push('Application Date');
    if (!fertilizerDraft.startTime) missingFields.push('Start Time');
    if (!fertilizerDraft.endTime) missingFields.push('End Time');
    if (!fertilizerDraft.propertyId) missingFields.push('Property');
    if (!fertilizerDraft.applicatorId) missingFields.push('Applicator');
    if (!fertilizerDraft.fertilizerProductId) missingFields.push('Fertilizer Product');
    if (!fertilizerDraft.rate || numberValue(fertilizerDraft.rate) <= 0) missingFields.push('Rate');
    if (!fertilizerDraft.areaTreated || numberValue(fertilizerDraft.areaTreated) <= 0) missingFields.push('Area Treated');
    if (!fertilizerDraft.totalAmount || numberValue(fertilizerDraft.totalAmount) <= 0) missingFields.push('Total Amount');

    if (missingFields.length > 0) {
      setFertilizerValidationErrors([`Missing required fields: ${missingFields.join(', ')}`]);
      return;
    }
    if (fertilizerDraft.endTime <= fertilizerDraft.startTime) {
      setFertilizerValidationErrors(['End Time must be after Start Time.']);
      return;
    }
    if (!orgScope) {
      setFertilizerValidationErrors(['Workspace is still loading. Please try again in a moment.']);
      return;
    }

    setFertilizerValidationErrors([]);
    setFertilizerSaving(true);

    const payload = {
      application_date: fertilizerDraft.applicationDate,
      start_time: fertilizerDraft.startTime,
      end_time: fertilizerDraft.endTime,
      property_id: fertilizerDraft.propertyId,
      applicator_id: fertilizerDraft.applicatorId,
      fertilizer_product_id: fertilizerDraft.fertilizerProductId,
      rate: numberValue(fertilizerDraft.rate),
      rate_unit: fertilizerDraft.rateUnit.trim() || 'lbs/acre',
      application_speed: numberValue(fertilizerDraft.applicationSpeed),
      speed_unit: fertilizerDraft.speedUnit.trim() || 'mph',
      area_treated: numberValue(fertilizerDraft.areaTreated),
      area_unit: fertilizerDraft.areaUnit.trim() || 'acres',
      total_amount: numberValue(fertilizerDraft.totalAmount),
      equipment_used_id: fertilizerDraft.equipmentUsedId || null,
      notes: fertilizerDraft.notes.trim(),
      org_id: orgScope,
    };

    try {
      const saveQuery = editingFertilizerLogId
        ? supabase
            .from('fertilizer_application_logs')
            .update(payload)
            .eq('id', editingFertilizerLogId)
            .eq('org_id', orgScope)
        : supabase.from('fertilizer_application_logs').insert(payload);
      const { error } = await withChemicalMutationTimeout(saveQuery);
      if (error) {
        toast.error(`Failed to save fertilizer application: ${getErrorMessage(error, 'Unknown error')}`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['fertilizer-application-logs'] });
      toast.success(editingFertilizerLogId ? 'Fertilizer application updated' : 'Fertilizer application logged');
      setEditingFertilizerLogId(null);
      setFertilizerDialogOpen(false);
      setFertilizerDraft(buildFertilizerDraftDefaults());
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save fertilizer application.'));
    } finally {
      setFertilizerSaving(false);
    }
  }

  async function deleteFertilizerLog(log: FertilizerApplicationLogRow) {
    if (!orgScope) {
      toast.error('Workspace is still loading. Please try again in a moment.');
      return;
    }
    if (!window.confirm('Delete this fertilizer application log?')) return;

    setFertilizerSaving(true);
    try {
      const { error } = await withChemicalMutationTimeout(
        supabase
          .from('fertilizer_application_logs')
          .delete()
          .eq('id', log.id)
          .eq('org_id', orgScope),
      );
      if (error) {
        toast.error(`Failed to delete fertilizer application: ${getErrorMessage(error, 'Unknown error')}`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['fertilizer-application-logs'] });
      toast.success('Fertilizer application deleted');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete fertilizer application.'));
    } finally {
      setFertilizerSaving(false);
    }
  }


  function buildChemicalDraftDefaults(): ApplicationDraft {
    return {
      ...emptyDraft,
      propertyId: propertyScope || properties[0]?.id || '',
      applicatorId: employees[0]?.id || '',
      equipmentUsedId: equipmentUnits[0]?.id || '',
    };
  }

  function buildChemicalMixDefaults(): DraftMixItem[] {
    return [{
      ...emptyMixItem,
      productId: chemicalProducts[0]?.id ?? '',
      rateUnit: chemicalProducts[0]?.rateUnit ?? emptyMixItem.rateUnit,
    }];
  }

  function openNewChemicalApplicationDialog() {
    setEditingChemicalLogId(null);
    setValidationErrors([]);
    setSaveApplicatorLicenseToProfile(false);
    setDraft(buildChemicalDraftDefaults());
    setDraftMixItems(buildChemicalMixDefaults());
    setDialogOpen(true);
  }

  function handleChemicalDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingChemicalLogId(null);
      setSaveApplicatorLicenseToProfile(false);
    }
  }

  function openEditChemicalLog(log: ChemicalApplicationLog) {
    const dbLog = log as ChemicalApplicationLog & { property_id?: string | null };
    const areaPropertyId = applicationAreas.find((area) => area.id === log.areaId)?.property;
    const logMixItems = mixItems
      .filter((item) => item.applicationLogId === log.id)
      .sort((left, right) => (left.mixOrder ?? 0) - (right.mixOrder ?? 0));

    setEditingChemicalLogId(log.id);
    setValidationErrors([]);
    setSaveApplicatorLicenseToProfile(false);
    setDraft({
      applicationDate: log.applicationDate,
      startTime: log.startTime,
      endTime: log.endTime,
      propertyId: dbLog.property_id ?? areaPropertyId ?? propertyScope ?? properties[0]?.id ?? '',
      targetPest: log.targetPest ?? '',
      agronomicPurpose: log.agronomicPurpose ?? '',
      applicationMethod: log.applicationMethod ?? 'Ground spray',
      carrierVolume: String(log.carrierVolume ?? 0),
      totalMixVolume: String(log.totalMixVolume ?? 0),
      areaTreated: String(log.areaTreated ?? 0),
      areaUnit: log.areaUnit ?? 'acres',
      applicatorId: log.applicatorId ?? '',
      applicatorLicenseNumber: log.applicatorLicenseNumber ?? '',
      supervisorName: log.supervisorName ?? '',
      supervisorLicenseNumber: log.supervisorLicenseNumber ?? '',
      equipmentUsedId: log.equipmentUsedId ?? '',
      windDirection: log.windDirection ?? '',
      windSpeedAtApplication: String(log.windSpeedAtApplication ?? ''),
      temperatureAtApplication: String(log.temperatureAtApplication ?? ''),
      humidityAtApplication: String(log.humidityAtApplication ?? ''),
      restrictedEntryUntil: log.restrictedEntryUntil ?? '',
      siteConditions: log.siteConditions ?? '',
      notes: log.notes ?? '',
    });
    setDraftMixItems(
      logMixItems.length > 0
        ? logMixItems.map((item) => ({
            productId: item.productId,
            rateApplied: String(item.rateApplied ?? 0),
            rateUnit: item.rateUnit || chemicalProducts.find((product) => product.id === item.productId)?.rateUnit || emptyMixItem.rateUnit,
            totalQuantityUsed: String(item.totalQuantityUsed ?? 0),
          }))
        : buildChemicalMixDefaults(),
    );
    setDialogOpen(true);
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
      setValidationErrors(['Missing required fields: ' + missingFields.join(', ')]);
      return;
    }
    if (draft.endTime <= draft.startTime) {
      setValidationErrors(['End Time must be after Start Time.']);
      return;
    }
    if (!orgScope) {
      setValidationErrors(['Workspace is still loading. Please try again in a moment.']);
      return;
    }

    setValidationErrors([]);
    setSaving(true);

    const logId = editingChemicalLogId ?? crypto.randomUUID();
    const restrictedEntryUntil = buildRestrictedEntry(draft, chemicalProducts, draftMixItems);
    const applicationTimestamp = draft.applicationDate + 'T' + draft.startTime + ':00-04:00';
    const nextLogPayload: Record<string, string | number | boolean | null> = {
      id: logId,
      application_date: draft.applicationDate,
      start_time: draft.startTime,
      end_time: draft.endTime,
      application_timestamp: applicationTimestamp,
      area_id: selectedAreaIdForProperty,
      property_id: draft.propertyId,
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
      org_id: orgScope,
    };
    const nextMix = draftMixItems
      .filter((item) => item.productId)
      .map((item, index) => ({
        id: crypto.randomUUID(),
        applicationLogId: logId,
        productId: item.productId,
        rateApplied: numberValue(item.rateApplied),
        rateUnit: item.rateUnit,
        totalQuantityUsed: numberValue(item.totalQuantityUsed),
        mixOrder: index + 1,
        org_id: orgScope,
      }));

    try {
      const { error: logError } = await withChemicalMutationTimeout(
        supabase.from('chemical_application_logs').upsert(nextLogPayload),
      );
      if (logError) {
        toast.error('Failed to save application log: ' + getErrorMessage(logError, 'Unknown error'));
        return;
      }

      if (editingChemicalLogId) {
        const { error: deleteMixError } = await withChemicalMutationTimeout(
          supabase
            .from('chemical_application_tank_mix_items')
            .delete()
            .eq('applicationLogId', logId)
            .eq('org_id', orgScope),
        );
        if (deleteMixError) {
          toast.error('Failed to replace tank mix items: ' + getErrorMessage(deleteMixError, 'Unknown error'));
          return;
        }
      }

      for (const mix of nextMix) {
        const { error } = await withChemicalMutationTimeout(
          supabase.from('chemical_application_tank_mix_items').insert(mix),
        );
        if (error) {
          toast.error('Failed to save tank mix item: ' + getErrorMessage(error, 'Unknown error'));
          return;
        }
      }

      const shouldSaveApplicatorLicense =
        saveApplicatorLicenseToProfile &&
        draft.applicatorId &&
        !selectedApplicatorLicenseNumber &&
        draft.applicatorLicenseNumber.trim();
      if (shouldSaveApplicatorLicense) {
        const { error: employeeLicenseError } = await withChemicalMutationTimeout(
          supabase
            .from('employees')
            .update({ applicator_license_number: draft.applicatorLicenseNumber.trim() })
            .eq('id', draft.applicatorId)
            .eq('org_id', orgScope),
        );
        if (employeeLicenseError) {
          toast.error('Application saved, but failed to save applicator license to employee profile: ' + getErrorMessage(employeeLicenseError, 'Unknown error'));
        } else {
          toast.success(`Saved applicator license to ${selectedApplicatorName}'s profile.`);
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chemical-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['chemical-application-logs-all'] }),
        queryClient.invalidateQueries({ queryKey: ['chemical-application-tank-mix-items'] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-applicator-licenses'] }),
      ]);

      toast.success(editingChemicalLogId ? 'Chemical application updated' : 'Chemical application logged');
      setEditingChemicalLogId(null);
      setDialogOpen(false);
      setSaveApplicatorLicenseToProfile(false);
      setDraft(buildChemicalDraftDefaults());
      setDraftMixItems(buildChemicalMixDefaults());
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save application log.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteChemicalLog(log: ChemicalApplicationLog) {
    if (!orgScope) {
      toast.error('Workspace is still loading. Please try again in a moment.');
      return;
    }
    if (!window.confirm('Delete this chemical application log?')) return;

    setSaving(true);
    try {
      const { error: mixError } = await withChemicalMutationTimeout(
        supabase
          .from('chemical_application_tank_mix_items')
          .delete()
          .eq('applicationLogId', log.id)
          .eq('org_id', orgScope),
      );
      if (mixError) {
        toast.error('Failed to delete tank mix items: ' + getErrorMessage(mixError, 'Unknown error'));
        return;
      }

      const { error: logError } = await withChemicalMutationTimeout(
        supabase
          .from('chemical_application_logs')
          .delete()
          .eq('id', log.id)
          .eq('org_id', orgScope),
      );
      if (logError) {
        toast.error('Failed to delete application log: ' + getErrorMessage(logError, 'Unknown error'));
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chemical-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['chemical-application-logs-all'] }),
        queryClient.invalidateQueries({ queryKey: ['chemical-application-tank-mix-items'] }),
      ]);
      toast.success('Chemical application deleted');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete application log.'));
    } finally {
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
      ].filter(Boolean).join(' · ');

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
    mixItemsQuery.isLoading ||
    fertilizerProductsQuery.isLoading ||
    fertilizerLogsQuery.isLoading
  ) {
    return <PageSkeleton />;
  }


  const fertilizerSettingsContent = (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold">Add Fertilizer Product</p>
          <p className="text-xs text-muted-foreground">Products appear in the fertilizer application form.</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Product Name *</label>
            <Input className="mt-1" value={fertilizerProductDraft.name} onChange={(e) => setFertilizerProductDraft((current) => ({ ...current, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fertilizer Type *</label>
            <Input className="mt-1" placeholder="Granular 10-10-10" value={fertilizerProductDraft.fertilizerType} onChange={(e) => setFertilizerProductDraft((current) => ({ ...current, fertilizerType: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Default Rate Unit</label>
            <Input className="mt-1" value={fertilizerProductDraft.rateUnit} onChange={(e) => setFertilizerProductDraft((current) => ({ ...current, rateUnit: e.target.value }))} />
          </div>
          <Button onClick={saveSettingsFertilizerProduct} disabled={fertilizerProductSaving} className="w-full">
            {fertilizerProductSaving ? 'Saving...' : 'Add Product'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Fertilizer Products</p>
            <p className="text-xs text-muted-foreground">Manage fertilizer products used by your crews.</p>
          </div>
          <Badge variant="secondary">{fertilizerProducts.length} products</Badge>
        </div>
        <div className="space-y-3">
          {fertilizerProducts.map((product) => {
            const isEditing = editingFertilizerProductId === product.id;
            return (
              <div key={product.id} className="rounded-xl border bg-muted/20 p-4">
                {isEditing ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.7fr_auto]">
                    <Input value={editingFertilizerProductDraft.name} onChange={(e) => setEditingFertilizerProductDraft((current) => ({ ...current, name: e.target.value }))} />
                    <Input value={editingFertilizerProductDraft.fertilizerType} onChange={(e) => setEditingFertilizerProductDraft((current) => ({ ...current, fertilizerType: e.target.value }))} />
                    <Input value={editingFertilizerProductDraft.rateUnit} onChange={(e) => setEditingFertilizerProductDraft((current) => ({ ...current, rateUnit: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditedFertilizerProduct} disabled={fertilizerProductSaving}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingFertilizerProductId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.fertilizer_type}</p>
                      <p className="text-xs text-muted-foreground">Default unit: {product.rate_unit}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditFertilizerProduct(product)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => void deleteFertilizerProduct(product)} disabled={fertilizerProductSaving}>Delete</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {fertilizerProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No fertilizer products have been configured yet.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );

  const fertilizerLogsContent = (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fertilizer Logs</p>
          <p className="mt-2 text-3xl font-semibold">{totalFertilizerApplications}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Area Treated</p>
          <p className="mt-2 text-3xl font-semibold">{totalFertilizerArea.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">acres in current filter</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Products Used</p>
          <p className="mt-2 text-3xl font-semibold">{uniqueFertilizerProducts}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total Amount</p>
          <p className="mt-2 text-3xl font-semibold">{totalFertilizerAmount.toFixed(1)}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Filter Fertilizer Logs</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <DateInput value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)}>
              <option value="all">All Properties</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={fertilizerFilterProduct} onChange={(e) => setFertilizerFilterProduct(e.target.value)}>
              <option value="all">All Products</option>
              {fertilizerProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterApplicator} onChange={(e) => setFilterApplicator(e.target.value)}>
              <option value="all">All Applicators</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
            </select>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        {filteredFertilizerLogs.map((log) => {
          const property = properties.find((entry) => entry.id === log.property_id);
          const applicator = employees.find((employee) => employee.id === log.applicator_id);
          const product = fertilizerProducts.find((entry) => entry.id === log.fertilizer_product_id);
          const equipment = equipmentUnits.find((unit) => unit.id === log.equipment_used_id);
          return (
            <Card key={log.id} className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{property?.name ?? log.property_id}</h3>
                    <Badge variant="outline">{log.application_date}</Badge>
                    <Badge variant="secondary">{formatTime(log.start_time)} - {formatTime(log.end_time)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{product?.name ?? log.fertilizer_product_id} - {product?.fertilizer_type ?? 'Fertilizer product'}</p>
                  <div className="flex flex-wrap gap-5 text-sm">
                    <div><span className="text-muted-foreground">Applicator:</span> {applicator ? applicator.firstName + ' ' + applicator.lastName : log.applicator_id}</div>
                    <div><span className="text-muted-foreground">Rate:</span> {log.rate} {log.rate_unit}</div>
                    <div><span className="text-muted-foreground">Speed:</span> {log.application_speed} {log.speed_unit}</div>
                    <div><span className="text-muted-foreground">Area:</span> {log.area_treated} {log.area_unit}</div>
                    <div><span className="text-muted-foreground">Total:</span> {log.total_amount}</div>
                    <div><span className="text-muted-foreground">Equipment:</span> {equipment?.unitNumber ?? equipment?.name ?? 'Not recorded'}</div>
                  </div>
                </div>
                <div className="space-y-3 xl:min-w-56">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" aria-label="Edit fertilizer application log" onClick={() => openEditFertilizerLog(log)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Delete fertilizer application log" onClick={() => void deleteFertilizerLog(log)} disabled={fertilizerSaving}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Sprout className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Fertilizer Application</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{product?.rate_unit ?? log.rate_unit} default product unit</p>
                  </div>
                </div>
              </div>
              {log.notes ? (
                <div className="mt-4 rounded-xl bg-accent/30 px-4 py-3 text-sm text-muted-foreground">
                  <FileText className="mr-2 inline h-4 w-4" />
                  {log.notes}
                </div>
              ) : null}
            </Card>
          );
        })}

        {filteredFertilizerLogs.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No fertilizer application logs match the current filters.
          </Card>
        ) : null}
      </div>

      <Dialog open={fertilizerDialogOpen} onOpenChange={handleFertilizerDialogOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingFertilizerLogId ? 'Edit Fertilizer Application' : 'New Fertilizer Application'}</DialogTitle>
            <DialogDescription className="sr-only">
              Enter fertilizer application details including product, rate, area treated, timing, and equipment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Application Date *</label>
                  <DateInput className="mt-1" value={fertilizerDraft.applicationDate} onChange={(e) => setFertilizerDraft((current) => ({ ...current, applicationDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Time *</label>
                  <TimeInput className="mt-1" value={fertilizerDraft.startTime} onChange={(e) => setFertilizerDraft((current) => ({ ...current, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Time *</label>
                  <TimeInput className="mt-1" value={fertilizerDraft.endTime} onChange={(e) => setFertilizerDraft((current) => ({ ...current, endTime: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Property *</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fertilizerDraft.propertyId} onChange={(e) => setFertilizerDraft((current) => ({ ...current, propertyId: e.target.value }))}>
                    {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Applicator *</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fertilizerDraft.applicatorId} onChange={(e) => setFertilizerDraft((current) => ({ ...current, applicatorId: e.target.value }))}>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
                  </select>
                </div>
              </div>

              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Fertilizer Product</p>
                    <p className="text-xs text-muted-foreground">Choose a saved product or add one without leaving the form.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowInlineFertilizerProductForm((current) => !current)}>
                    {showInlineFertilizerProductForm ? 'Hide Add Product' : 'Add Product'}
                  </Button>
                </div>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fertilizerDraft.fertilizerProductId} onChange={(e) => updateFertilizerProductSelection(e.target.value)}>
                  <option value="">Select fertilizer product</option>
                  {fertilizerProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                {showInlineFertilizerProductForm ? (
                  <div className="mt-3 grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_0.8fr_auto]">
                    <Input placeholder="Product name" value={inlineFertilizerProductDraft.name} onChange={(e) => setInlineFertilizerProductDraft((current) => ({ ...current, name: e.target.value }))} />
                    <Input placeholder="Fertilizer type" value={inlineFertilizerProductDraft.fertilizerType} onChange={(e) => setInlineFertilizerProductDraft((current) => ({ ...current, fertilizerType: e.target.value }))} />
                    <Input placeholder="Rate unit" value={inlineFertilizerProductDraft.rateUnit} onChange={(e) => setInlineFertilizerProductDraft((current) => ({ ...current, rateUnit: e.target.value }))} />
                    <Button onClick={saveInlineFertilizerProduct} disabled={fertilizerProductSaving}>{fertilizerProductSaving ? 'Saving...' : 'Save'}</Button>
                  </div>
                ) : null}
              </Card>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Rate *</label>
                  <Input className="mt-1" type="number" value={fertilizerDraft.rate} onChange={(e) => setFertilizerDraft((current) => ({ ...current, rate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Rate Unit</label>
                  <Input className="mt-1" value={fertilizerDraft.rateUnit} onChange={(e) => setFertilizerDraft((current) => ({ ...current, rateUnit: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Application Speed</label>
                  <Input className="mt-1" type="number" value={fertilizerDraft.applicationSpeed} onChange={(e) => setFertilizerDraft((current) => ({ ...current, applicationSpeed: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Speed Unit</label>
                  <Input className="mt-1" value={fertilizerDraft.speedUnit} onChange={(e) => setFertilizerDraft((current) => ({ ...current, speedUnit: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Area Treated *</label>
                  <Input className="mt-1" type="number" value={fertilizerDraft.areaTreated} onChange={(e) => setFertilizerDraft((current) => ({ ...current, areaTreated: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Area Unit</label>
                  <Input className="mt-1" value={fertilizerDraft.areaUnit} onChange={(e) => setFertilizerDraft((current) => ({ ...current, areaUnit: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total Amount *</label>
                  <Input className="mt-1" type="number" value={fertilizerDraft.totalAmount} onChange={(e) => setFertilizerDraft((current) => ({ ...current, totalAmount: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Equipment Used</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fertilizerDraft.equipmentUsedId} onChange={(e) => setFertilizerDraft((current) => ({ ...current, equipmentUsedId: e.target.value }))}>
                    <option value="">No equipment selected</option>
                    {equipmentUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber || unit.name || unit.id}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fertilizerDraft.notes} onChange={(e) => setFertilizerDraft((current) => ({ ...current, notes: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <p className="text-sm font-semibold">Application Summary</p>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p className="rounded-lg bg-muted/40 px-3 py-3">Product: {fertilizerProducts.find((product) => product.id === fertilizerDraft.fertilizerProductId)?.name ?? 'Not selected'}</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">Rate: {fertilizerDraft.rate || 0} {fertilizerDraft.rateUnit}</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">Area: {fertilizerDraft.areaTreated || 0} {fertilizerDraft.areaUnit}</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">Total: {fertilizerDraft.totalAmount || 0}</p>
                </div>
              </Card>
            </div>
          </div>

          {fertilizerValidationErrors.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {fertilizerValidationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t bg-background/95 pt-3 backdrop-blur">
            <Button variant="outline" onClick={() => handleFertilizerDialogOpenChange(false)}>Cancel</Button>
            <Button onClick={saveFertilizerApplication} disabled={fertilizerSaving}>{fertilizerSaving ? 'Saving...' : editingFertilizerLogId ? 'Update Fertilizer Log' : 'Save Fertilizer Log'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <PropertySelector className="w-full sm:w-64" />
          <div className="flex items-center gap-2">
          <Badge variant="secondary">{applicationMode === 'chemical' ? totalApplications : totalFertilizerApplications} logs</Badge>
          <Badge className="bg-status-active/10 text-status-active border-status-active/20">
            {applicationMode === 'chemical' ? 'EPA-Compliant Record Keeping' : 'Fertilizer Application Records'}
          </Badge>
        </div>
        </div>
        {activeTab === 'logs' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (applicationMode === 'chemical') {
                  openNewChemicalApplicationDialog();
                } else {
                  openFertilizerDialog();
                }
              }}
            >
              {applicationMode === 'chemical' ? <FlaskConical className="h-3.5 w-3.5" /> : <Sprout className="h-3.5 w-3.5" />}
              {applicationMode === 'chemical' ? 'New Application' : 'New Fertilizer Application'}
            </Button>
            {applicationMode === 'chemical' ? (
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
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border bg-card p-1">
          <button
            type="button"
            className={'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (
              applicationMode === 'chemical'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            )}
            onClick={() => setApplicationMode('chemical')}
          >
            Chemical
          </button>
          <button
            type="button"
            className={'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (
              applicationMode === 'fertilizer'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            )}
            onClick={() => setApplicationMode('fertilizer')}
          >
            Fertilizer
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl border bg-card p-1">
          <button
            type="button"
            className={'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (
              activeTab === 'logs'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            )}
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
          <button
            type="button"
            className={'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (
              activeTab === 'settings'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            )}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        applicationMode === 'chemical' ? <ChemicalSettings /> : fertilizerSettingsContent
      ) : applicationMode === 'chemical' ? (
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
            <DateInput value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
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
                <div className="space-y-3 xl:max-w-sm">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" aria-label="Edit chemical application log" onClick={() => openEditChemicalLog(log)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Delete chemical application log" onClick={() => void deleteChemicalLog(log)} disabled={saving}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <Wind className="h-3.5 w-3.5" />
                    <span>Wind {log.windSpeedAtApplication ?? 0} mph ? Temp {log.temperatureAtApplication ?? 0}F</span>
                  </div>
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

          <Dialog open={dialogOpen} onOpenChange={handleChemicalDialogOpenChange}>
        <DialogContent aria-describedby="dialog-desc" className="max-h-[90vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingChemicalLogId ? 'Edit Chemical Application' : 'New Chemical Application'}</DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              Enter spray record details, compliance information, and tank mix products.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Application Date *</label>
                  <DateInput id="application-date" name="application_date" className="mt-1" value={draft.applicationDate} onChange={(e) => setDraft((current) => ({ ...current, applicationDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Time *</label>
                  <TimeInput id="application-start-time" name="start_time" className="mt-1" value={draft.startTime} onChange={(e) => setDraft((current) => ({ ...current, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Time *</label>
                  <TimeInput id="application-end-time" name="end_time" className="mt-1" value={draft.endTime} onChange={(e) => setDraft((current) => ({ ...current, endTime: e.target.value }))} />
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
                  <select
                    id="application-applicator"
                    name="applicator_id"
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={draft.applicatorId}
                    onChange={(e) => {
                      const nextApplicatorId = e.target.value;
                      const nextLicense = employeeApplicatorLicenses.find((employee) => employee.id === nextApplicatorId)?.applicator_license_number?.trim() ?? '';
                      setSaveApplicatorLicenseToProfile(false);
                      setDraft((current) => ({ ...current, applicatorId: nextApplicatorId, applicatorLicenseNumber: nextLicense }));
                    }}
                  >
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
                    <Input
                      id="applicator-license-number"
                      name="applicator_license_number"
                      className="mt-1"
                      value={draft.applicatorLicenseNumber}
                      onChange={(e) => {
                        const nextLicense = e.target.value;
                        if (!nextLicense.trim()) setSaveApplicatorLicenseToProfile(false);
                        setDraft((current) => ({ ...current, applicatorLicenseNumber: nextLicense }));
                      }}
                    />
                    {selectedApplicator && !employeeApplicatorLicensesQuery.isLoading && !selectedApplicatorLicenseNumber && !draft.applicatorLicenseNumber.trim() ? (
                      <p className="mt-2 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
                        {selectedApplicatorName} has no applicator license on file - required for pesticide application records under Florida law.
                      </p>
                    ) : null}
                    {selectedApplicator && !selectedApplicatorLicenseNumber && draft.applicatorLicenseNumber.trim() ? (
                      <label className="mt-2 flex items-start gap-2 rounded-md border border-dashed border-surface-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                          checked={saveApplicatorLicenseToProfile}
                          onChange={(event) => setSaveApplicatorLicenseToProfile(event.target.checked)}
                        />
                        <span>Save this license number to {selectedApplicatorName}'s profile</span>
                      </label>
                    ) : null}
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
            <Button variant="outline" onClick={() => handleChemicalDialogOpenChange(false)}>Cancel</Button>
            <Button onClick={saveApplication} disabled={saving}>{saving ? 'Saving...' : editingChemicalLogId ? 'Update Application Log' : 'Save Application Log'}</Button>
          </div>
        </DialogContent>
          </Dialog>
        </>
      ) : (
        fertilizerLogsContent
      )}
    </div>
  );
}










