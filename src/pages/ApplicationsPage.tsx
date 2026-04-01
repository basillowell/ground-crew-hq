import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, FileText, Filter, FlaskConical, Printer, Sprout, Wind } from 'lucide-react';
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
  type WeatherLocation,
} from '@/data/seedData';
import {
  loadApplicationAreas,
  loadChemicalApplicationLogs,
  loadChemicalApplicationTankMixItems,
  loadChemicalProducts,
  loadEmployees,
  loadEquipmentUnits,
  loadWeatherDailyLogs,
  loadWeatherLocations,
  saveChemicalApplicationLogs,
  saveChemicalApplicationTankMixItems,
} from '@/lib/dataStore';

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
  carrierVolume: string;
  areaTreated: string;
  areaUnit: string;
  applicatorId: string;
  equipmentUsedId: string;
  weatherLogId: string;
  notes: string;
};

const emptyDraft: ApplicationDraft = {
  applicationDate: '2024-03-26',
  startTime: '05:30',
  endTime: '07:00',
  areaId: '',
  targetPest: '',
  agronomicPurpose: '',
  carrierVolume: '120',
  areaTreated: '3.5',
  areaUnit: 'acres',
  applicatorId: '',
  equipmentUsedId: '',
  weatherLogId: '',
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

export default function ApplicationsPage() {
  const [applicationAreas, setApplicationAreas] = useState<ApplicationArea[]>([]);
  const [chemicalProducts, setChemicalProducts] = useState<ChemicalProduct[]>([]);
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipmentUnits, setEquipmentUnits] = useState<EquipmentUnit[]>([]);
  const [logs, setLogs] = useState<ChemicalApplicationLog[]>([]);
  const [mixItems, setMixItems] = useState<ChemicalApplicationTankMixItem[]>([]);
  const [weatherLogs, setWeatherLogs] = useState(loadWeatherDailyLogs());
  const [filterDate, setFilterDate] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterApplicator, setFilterApplicator] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft);
  const [draftMixItems, setDraftMixItems] = useState<DraftMixItem[]>([{ ...emptyMixItem }]);

  useEffect(() => {
    const loadedAreas = loadApplicationAreas();
    const loadedProducts = loadChemicalProducts();
    const loadedLocations = loadWeatherLocations();
    const loadedEmployees = loadEmployees();
    const loadedEquipment = loadEquipmentUnits();
    setApplicationAreas(loadedAreas);
    setChemicalProducts(loadedProducts);
    setWeatherLocations(loadedLocations);
    setEmployees(loadedEmployees);
    setEquipmentUnits(loadedEquipment);
    setLogs(loadChemicalApplicationLogs());
    setMixItems(loadChemicalApplicationTankMixItems());
    setWeatherLogs(loadWeatherDailyLogs());
    setDraft((current) => ({
      ...current,
      areaId: loadedAreas[0]?.id ?? current.areaId,
      applicatorId: loadedEmployees[0]?.id ?? current.applicatorId,
      equipmentUsedId: loadedEquipment[0]?.id ?? current.equipmentUsedId,
    }));
    setDraftMixItems((current) =>
      current.map((item) => ({
        ...item,
        productId: item.productId || loadedProducts[0]?.id || '',
        rateUnit: loadedProducts.find((product) => product.id === item.productId)?.rateUnit ?? loadedProducts[0]?.rateUnit ?? item.rateUnit,
      }))
    );
  }, []);

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

  const selectedArea = applicationAreas.find((area) => area.id === draft.areaId) ?? applicationAreas[0];
  const snapshotLocation = weatherLocations.find((location) => location.id === selectedArea.weatherLocationId) ?? weatherLocations[0];
  const snapshotLog = weatherLogs
    .filter((log) => log.locationId === snapshotLocation.id)
    .sort((left, right) => right.date.localeCompare(left.date))[0];

  const totalApplications = filteredLogs.length;
  const totalArea = filteredLogs.reduce((sum, log) => sum + log.areaTreated, 0);
  const uniqueProducts = new Set(filteredLogs.flatMap((log) => mixItems.filter((item) => item.applicationLogId === log.id).map((item) => item.productId))).size;

  function addMixItem() {
    setDraftMixItems((current) => [...current, { ...emptyMixItem }]);
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

  function saveApplication() {
    const logId = `cal-${Date.now()}`;
    const nextLog: ChemicalApplicationLog = {
      id: logId,
      applicationDate: draft.applicationDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      areaId: draft.areaId,
      targetPest: draft.targetPest,
      agronomicPurpose: draft.agronomicPurpose,
      carrierVolume: Number(draft.carrierVolume),
      areaTreated: Number(draft.areaTreated),
      areaUnit: draft.areaUnit,
      applicatorId: draft.applicatorId,
      equipmentUsedId: draft.equipmentUsedId || undefined,
      weatherLogId: draft.weatherLogId || snapshotLog?.id,
      notes: draft.notes,
    };
    const nextLogs = [nextLog, ...logs];
    const nextMix = [
      ...draftMixItems.map((item, index) => ({
        id: `mix-${Date.now()}-${index}`,
        applicationLogId: logId,
        productId: item.productId,
        rateApplied: Number(item.rateApplied),
        rateUnit: item.rateUnit,
        totalQuantityUsed: Number(item.totalQuantityUsed),
      })),
      ...mixItems,
    ];

    setLogs(nextLogs);
    setMixItems(nextMix);
    saveChemicalApplicationLogs(nextLogs);
    saveChemicalApplicationTankMixItems(nextMix);
    setDialogOpen(false);
    setDraft({
      ...emptyDraft,
      areaId: applicationAreas[0]?.id ?? '',
      applicatorId: employees[0]?.id ?? '',
      equipmentUsedId: equipmentUnits[0]?.id ?? '',
    });
    setDraftMixItems([{
      ...emptyMixItem,
      productId: chemicalProducts[0]?.id ?? '',
      rateUnit: chemicalProducts[0]?.rateUnit ?? emptyMixItem.rateUnit,
    }]);
  }

  function exportLogs() {
    const header = ['date', 'area', 'products', 'applicator', 'carrier_volume', 'area_treated', 'notes'];
    const rows = filteredLogs.map((log) => {
      const area = applicationAreas.find((item) => item.id === log.areaId)?.name ?? log.areaId;
      const applicator = employees.find((employee) => employee.id === log.applicatorId);
      const productNames = mixItems
        .filter((item) => item.applicationLogId === log.id)
        .map((item) => chemicalProducts.find((product) => product.id === item.productId)?.name ?? item.productId)
        .join(' | ');
      return [log.applicationDate, area, productNames, applicator ? `${applicator.firstName} ${applicator.lastName}` : log.applicatorId, String(log.carrierVolume), `${log.areaTreated} ${log.areaUnit}`, `"${log.notes.replace(/"/g, '""')}"`].join(',');
    });
    downloadCsv('chemical-application-logs.csv', [header.join(','), ...rows]);
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Applications"
        subtitle="Dedicated chemical application logging with weather context, tank mixes, exports, and report tie-in."
        badge={<Badge variant="secondary">{totalApplications} logs</Badge>}
        action={{ label: 'New Application', onClick: () => setDialogOpen(true), icon: <FlaskConical className="h-3.5 w-3.5" /> }}
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
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Weather Linked</p>
          <p className="mt-2 text-3xl font-semibold">{filteredLogs.filter((log) => log.weatherLogId).length}</p>
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
          const logMixItems = mixItems.filter((item) => item.applicationLogId === log.id);

          return (
            <Card key={log.id} className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{area?.name ?? log.areaId}</h3>
                    <Badge variant="outline">{log.applicationDate}</Badge>
                    <Badge variant="secondary">{log.startTime} - {log.endTime}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{log.targetPest} - {log.agronomicPurpose}</p>
                  <div className="flex flex-wrap gap-5 text-sm">
                    <div><span className="text-muted-foreground">Applicator:</span> {applicator ? `${applicator.firstName} ${applicator.lastName}` : log.applicatorId}</div>
                    <div><span className="text-muted-foreground">Equipment:</span> {equipment?.unitNumber ?? 'Not recorded'}</div>
                    <div><span className="text-muted-foreground">Area:</span> {log.areaTreated} {log.areaUnit}</div>
                    <div><span className="text-muted-foreground">Carrier:</span> {log.carrierVolume} gal</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Tank Mix</p>
                    <p className="text-xs text-muted-foreground">Multiple products can be logged on the same application.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addMixItem}>Add Product</Button>
                </div>
                <div className="space-y-3">
                  {draftMixItems.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="grid gap-3 md:grid-cols-4">
                      <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={item.productId} onChange={(e) => updateMixItem(index, { productId: e.target.value })}>
                        {chemicalProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                      </select>
                      <Input type="number" placeholder="Rate applied" value={item.rateApplied} onChange={(e) => updateMixItem(index, { rateApplied: e.target.value })} />
                      <Input placeholder="Rate unit" value={item.rateUnit} onChange={(e) => updateMixItem(index, { rateUnit: e.target.value })} />
                      <Input type="number" placeholder="Total quantity used" value={item.totalQuantityUsed} onChange={(e) => updateMixItem(index, { totalQuantityUsed: e.target.value })} />
                    </div>
                  ))}
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
                <p className="text-sm font-semibold">Workflow Checklist</p>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p className="rounded-lg bg-muted/40 px-3 py-3">1. Confirm application area and linked weather location.</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">2. Log every product in the tank mix with rate and quantity used.</p>
                  <p className="rounded-lg bg-muted/40 px-3 py-3">3. Capture weather conditions so reports can compare rainfall and application timing together.</p>
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
