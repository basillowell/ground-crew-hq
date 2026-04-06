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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import {
  type ApplicationArea,
  type ChemicalApplicationLog,
  type ChemicalApplicationTankMixItem,
  type ChemicalProduct,
  type Employee,
  type EquipmentUnit,
  type WeatherDailyLog,
  type WeatherLocation,
} from '@/data/seedData';
import { useChemicalApplicationLogsAll, useChemicalProducts, useChemicalApplicationTankMixItems } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
  areaId: string;
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
  weatherLogId: string;
  weatherConditionsSummary: string;
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
  areaId: '',
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
  weatherLogId: '',
  weatherConditionsSummary: '',
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
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const logsQuery = useChemicalApplicationLogsAll();
  const productsQuery = useChemicalProducts();
  const mixItemsQuery = useChemicalApplicationTankMixItems();
  const logs = logsQuery.data ?? [];
  const chemicalProducts = productsQuery.data ?? [];
  const mixItems = mixItemsQuery.data ?? [];
  const [applicationAreas, setApplicationAreas] = useState<ApplicationArea[]>([]);
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>(loadWeatherDailyLogs());
  const [filterDate, setFilterDate] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterApplicator, setFilterApplicator] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft);
  const [draftMixItems, setDraftMixItems] = useState<DraftMixItem[]>([{ ...emptyMixItem }]);

  useEffect(() => {
    const loadedAreas = loadApplicationAreas();
    const loadedLocations = loadWeatherLocations();
    const loadedEmployees = loadEmployees();
    const loadedEquipment = loadEquipmentUnits();
    setApplicationAreas(loadedAreas);
    setWeatherLocations(loadedLocations);
    setEmployees(loadedEmployees);
    setEquipmentUnits(loadedEquipment);
    setWeatherLogs(loadWeatherDailyLogs());
    const loadedWeatherLogs = loadWeatherDailyLogs();
    setWeatherLogs(loadedWeatherLogs);
    setDraft((current) => ({
      ...current,
      areaId: loadedAreas[0]?.id ?? current.areaId,
      applicatorId: loadedEmployees[0]?.id ?? current.applicatorId,
      equipmentUsedId: loadedEquipment[0]?.id ?? current.equipmentUsedId,
      weatherLogId: loadedWeatherLogs[0]?.id ?? current.weatherLogId,
    }));
    setDraftMixItems((current) =>
      current.map((item) => ({
        ...item,
        productId: item.productId || chemicalProducts[0]?.id || '',
        rateUnit: chemicalProducts.find((product) => product.id === item.productId)?.rateUnit ?? chemicalProducts[0]?.rateUnit ?? item.rateUnit,
      }))
    );
  }, [chemicalProducts]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logMixItems = mixItems.filter((item) => item.applicationLogId === log.id);
      const matchesDate = !filterDate || log.applicationDate === filterDate;
      const matchesArea = filterArea === 'all' || log.areaId === filterArea;
      const matchesApplicator = filterApplicator === 'all' || log.applicatorId === filterApplicator;
      const matchesProduct =
        filterProduct === 'all' || logMixItems.some((item) => item.productId === filterProduct);
      return matchesDate && matchesArea && matchesApplicator && matchesProduct;
    });
  }, [filterApplicator, filterArea, filterDate, filterProduct, logs, mixItems]);

  const selectedArea =
    applicationAreas.find((area) => area.id === draft.areaId) ?? applicationAreas[0];
  const snapshotLocation = selectedArea
    ? weatherLocations.find((location) => location.id === selectedArea.weatherLocationId) ?? weatherLocations[0]
    : weatherLocations[0];
  const locationWeatherLogs = weatherLogs
    .filter((log) => log.locationId === snapshotLocation?.id)
    .sort((left, right) => right.date.localeCompare(left.date));
  const snapshotLog =
    locationWeatherLogs.find((log) => log.id === draft.weatherLogId) ?? locationWeatherLogs[0];

  useEffect(() => {
    if (!dialogOpen || !snapshotLog) return;
    setDraft((current) => ({
      ...current,
      weatherLogId: current.weatherLogId || snapshotLog.id,
      weatherConditionsSummary:
        current.weatherConditionsSummary ||
        `${snapshotLog.currentConditions}; forecast: ${snapshotLog.forecast}`,
      temperatureAtApplication:
        current.temperatureAtApplication || String(snapshotLog.temperature),
      humidityAtApplication:
        current.humidityAtApplication || String(snapshotLog.humidity),
      windSpeedAtApplication:
        current.windSpeedAtApplication || String(snapshotLog.wind),
    }));
  }, [dialogOpen, snapshotLog]);

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
    const logId = `cal-${Date.now()}`;
    const weatherSource = weatherLogs.find((log) => log.id === draft.weatherLogId) ?? snapshotLog;
    const restrictedEntryUntil = buildRestrictedEntry(draft, chemicalProducts, draftMixItems);
    const nextLog: ChemicalApplicationLog = {
      id: logId,
      applicationDate: draft.applicationDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      applicationTimestamp: `${draft.applicationDate}T${draft.startTime}:00`,
      areaId: draft.areaId,
      targetPest: draft.targetPest,
      agronomicPurpose: draft.agronomicPurpose,
      applicationMethod: draft.applicationMethod,
      carrierVolume: numberValue(draft.carrierVolume),
      totalMixVolume: numberValue(draft.totalMixVolume),
      areaTreated: numberValue(draft.areaTreated),
      areaUnit: draft.areaUnit,
      applicatorId: draft.applicatorId,
      applicatorLicenseNumber: draft.applicatorLicenseNumber,
      supervisorName: draft.supervisorName,
      supervisorLicenseNumber: draft.supervisorLicenseNumber,
      equipmentUsedId: draft.equipmentUsedId || undefined,
      weatherLogId: draft.weatherLogId || weatherSource?.id,
      weatherConditionsSummary:
        draft.weatherConditionsSummary ||
        (weatherSource
          ? `${weatherSource.currentConditions}; forecast: ${weatherSource.forecast}`
          : ''),
      windDirection: draft.windDirection,
      windSpeedAtApplication: numberValue(
        draft.windSpeedAtApplication || String(weatherSource?.wind ?? 0)
      ),
      temperatureAtApplication: numberValue(
        draft.temperatureAtApplication || String(weatherSource?.temperature ?? 0)
      ),
      humidityAtApplication: numberValue(
        draft.humidityAtApplication || String(weatherSource?.humidity ?? 0)
      ),
      restrictedEntryUntil,
      siteConditions: draft.siteConditions,
      notes: draft.notes,
    };
    const nextMix = draftMixItems.map((item, index) => ({
      id: `mix-${Date.now()}-${index}`,
      applicationLogId: logId,
      productId: item.productId,
      rateApplied: numberValue(item.rateApplied),
      rateUnit: item.rateUnit,
      totalQuantityUsed: numberValue(item.totalQuantityUsed),
      mixOrder: index + 1,
    }));

    await supabase.from('chemical_application_logs').upsert({
      ...nextLog,
      org_id: currentUser?.orgId,
    });
    for (const mix of nextMix) {
      await supabase.from('chemical_application_tank_mix_items').upsert(mix);
    }
    await queryClient.invalidateQueries({ queryKey: ['chemical-application-logs-all'] });
    await queryClient.invalidateQueries({ queryKey: ['chemical-application-tank-mix-items'] });
    setDialogOpen(false);
    setDraft({
      ...emptyDraft,
      areaId: applicationAreas[0]?.id ?? '',
      applicatorId: employees[0]?.id ?? '',
      equipmentUsedId: equipmentUnits[0]?.id ?? '',
      weatherLogId: locationWeatherLogs[0]?.id ?? '',
    });
    setDraftMixItems([
      {
        ...emptyMixItem,
        productId: chemicalProducts[0]?.id ?? '',
        rateUnit: chemicalProducts[0]?.rateUnit ?? emptyMixItem.rateUnit,
      },
    ]);
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
      'weather',
      'wind_direction',
      'wind_speed_mph',
      'temperature_f',
      'humidity_percent',
      'restricted_entry_until',
      'notes',
    ];
    const rows = filteredLogs.map((log) => {
      const area = applicationAreas.find((item) => item.id === log.areaId)?.name ?? log.areaId;
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
        quoteCsv(area),
        quoteCsv(productNames),
        quoteCsv(applicator ? `${applicator.firstName} ${applicator.lastName}` : log.applicatorId),
        quoteCsv(log.applicatorLicenseNumber ?? ''),
        quoteCsv([log.supervisorName, log.supervisorLicenseNumber].filter(Boolean).join(' / ')),
        quoteCsv(log.applicationMethod ?? ''),
        quoteCsv(log.carrierVolume),
        quoteCsv(log.totalMixVolume ?? 0),
        quoteCsv(`${log.areaTreated} ${log.areaUnit}`),
        quoteCsv(log.weatherConditionsSummary ?? ''),
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

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <PageHeader
        title="Applications"
        subtitle="Licensed applicator-ready chemical logging with tank mix detail, timestamped weather snapshots, and exportable records."
        badge={<Badge variant="secondary">{totalApplications} logs</Badge>}
        action={{
          label: 'New Application',
          onClick: () => {
            setDialogOpen(true);
          },
          icon: <FlaskConical className="h-3.5 w-3.5" />,
        }}
      >
        <Button variant="outline" size="sm" className="gap-1" onClick={exportLogs}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
      </PageHeader>

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
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
              <option value="all">All Areas</option>
              {applicationAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
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

        {selectedArea && snapshotLocation && (
          <WeatherSnapshotCard location={snapshotLocation} log={snapshotLog} compact />
        )}
      </div>

      <div className="space-y-3">
        {filteredLogs.map((log) => {
          const area = applicationAreas.find((item) => item.id === log.areaId);
          const applicator = employees.find((employee) => employee.id === log.applicatorId);
          const equipment = equipmentUnits.find((unit) => unit.id === log.equipmentUsedId);
          const weather = weatherLogs.find((entry) => entry.id === log.weatherLogId);
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
                    <h3 className="text-base font-semibold">{area?.name ?? log.areaId}</h3>
                    <Badge variant="outline">{log.applicationDate}</Badge>
                    <Badge variant="secondary">{log.startTime} - {log.endTime}</Badge>
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
                  {weather ? `${weather.currentConditions} · ${weather.wind} mph wind · ${weather.rainfallTotal.toFixed(2)} in rain` : 'No linked weather snapshot'}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>New Chemical Application</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Application Date</label>
                  <Input className="mt-1" type="date" value={draft.applicationDate} onChange={(e) => setDraft((current) => ({ ...current, applicationDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Time</label>
                  <Input className="mt-1" type="time" value={draft.startTime} onChange={(e) => setDraft((current) => ({ ...current, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Time</label>
                  <Input className="mt-1" type="time" value={draft.endTime} onChange={(e) => setDraft((current) => ({ ...current, endTime: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Area / Location Treated</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.areaId} onChange={(e) => setDraft((current) => ({ ...current, areaId: e.target.value }))}>
                    {applicationAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Applicator</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.applicatorId} onChange={(e) => setDraft((current) => ({ ...current, applicatorId: e.target.value }))}>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Target Pest</label>
                  <Input className="mt-1" value={draft.targetPest} onChange={(e) => setDraft((current) => ({ ...current, targetPest: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Agronomic Purpose</label>
                  <Input className="mt-1" value={draft.agronomicPurpose} onChange={(e) => setDraft((current) => ({ ...current, agronomicPurpose: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Carrier Volume</label>
                  <Input className="mt-1" type="number" value={draft.carrierVolume} onChange={(e) => setDraft((current) => ({ ...current, carrierVolume: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total Mix Volume</label>
                  <Input className="mt-1" type="number" value={draft.totalMixVolume} onChange={(e) => setDraft((current) => ({ ...current, totalMixVolume: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Area Treated</label>
                  <Input className="mt-1" type="number" value={draft.areaTreated} onChange={(e) => setDraft((current) => ({ ...current, areaTreated: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Area Unit</label>
                  <Input className="mt-1" value={draft.areaUnit} onChange={(e) => setDraft((current) => ({ ...current, areaUnit: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Equipment Used</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.equipmentUsedId} onChange={(e) => setDraft((current) => ({ ...current, equipmentUsedId: e.target.value }))}>
                    <option value="">No equipment selected</option>
                    {equipmentUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}
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
                    <label className="text-xs font-medium text-muted-foreground">Application Method</label>
                    <Input className="mt-1" value={draft.applicationMethod} onChange={(e) => setDraft((current) => ({ ...current, applicationMethod: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Applicator License #</label>
                    <Input className="mt-1" value={draft.applicatorLicenseNumber} onChange={(e) => setDraft((current) => ({ ...current, applicatorLicenseNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Supervisor</label>
                    <Input className="mt-1" value={draft.supervisorName} onChange={(e) => setDraft((current) => ({ ...current, supervisorName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Supervisor License #</label>
                    <Input className="mt-1" value={draft.supervisorLicenseNumber} onChange={(e) => setDraft((current) => ({ ...current, supervisorLicenseNumber: e.target.value }))} />
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
                          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={item.productId} onChange={(e) => updateMixItem(index, { productId: e.target.value })}>
                            {chemicalProducts.map((productOption) => <option key={productOption.id} value={productOption.id}>{productOption.name}</option>)}
                          </select>
                          <Input type="number" placeholder="Rate applied" value={item.rateApplied} onChange={(e) => updateMixItem(index, { rateApplied: e.target.value })} />
                          <Input placeholder="Rate unit" value={item.rateUnit} onChange={(e) => updateMixItem(index, { rateUnit: e.target.value })} />
                          <Input type="number" placeholder="Total quantity used" value={item.totalQuantityUsed} onChange={(e) => updateMixItem(index, { totalQuantityUsed: e.target.value })} />
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
                  <p className="text-sm font-semibold">Weather At Application</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Linked Weather Log</label>
                    <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.weatherLogId} onChange={(e) => setDraft((current) => ({ ...current, weatherLogId: e.target.value }))}>
                      {locationWeatherLogs.map((log) => (
                        <option key={log.id} value={log.id}>
                          {log.date} · {log.currentConditions}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Wind Direction</label>
                    <Input className="mt-1" value={draft.windDirection} onChange={(e) => setDraft((current) => ({ ...current, windDirection: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Wind Speed (mph)</label>
                    <Input className="mt-1" type="number" value={draft.windSpeedAtApplication} onChange={(e) => setDraft((current) => ({ ...current, windSpeedAtApplication: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Temperature (F)</label>
                    <Input className="mt-1" type="number" value={draft.temperatureAtApplication} onChange={(e) => setDraft((current) => ({ ...current, temperatureAtApplication: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Humidity (%)</label>
                    <Input className="mt-1" type="number" value={draft.humidityAtApplication} onChange={(e) => setDraft((current) => ({ ...current, humidityAtApplication: e.target.value }))} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground">Weather Conditions Summary</label>
                    <Input className="mt-1" value={draft.weatherConditionsSummary} onChange={(e) => setDraft((current) => ({ ...current, weatherConditionsSummary: e.target.value }))} />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Restricted Entry Until</label>
                    <Input className="mt-1" type="datetime-local" value={draft.restrictedEntryUntil ? draft.restrictedEntryUntil.slice(0, 16) : ''} onChange={(e) => setDraft((current) => ({ ...current, restrictedEntryUntil: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Site Conditions</label>
                    <Input className="mt-1" value={draft.siteConditions} onChange={(e) => setDraft((current) => ({ ...current, siteConditions: e.target.value }))} />
                  </div>
                </div>
              </Card>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-4">
              {selectedArea && snapshotLocation && <WeatherSnapshotCard location={snapshotLocation} log={snapshotLog} compact />}
              <Card className="p-4">
                <p className="text-sm font-semibold">Compliance Checklist</p>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p className="rounded-lg bg-muted/40 px-3 py-3">1. Record every product in tank mix order with the actual use rate and total quantity used.</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">2. Capture applicator and supervisor license details for the record.</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">3. Save a weather snapshot so rainfall, wind, and application timing can be analyzed together in reports.</p>
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

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveApplication}>Save Application Log</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}





