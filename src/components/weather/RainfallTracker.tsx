import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type RainfallLogRow = {
  date: string;
  rainfallTotal: number;
  source?: string;
  notes?: string;
};

type Period = 'day' | 'week' | 'month' | 'year';

type Props = {
  logs: RainfallLogRow[];
  loading?: boolean;
};

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function RainfallTracker({ logs, loading = false }: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [showTable, setShowTable] = useState(false);
  const [page, setPage] = useState(1);

  const parsedLogs = useMemo(
    () =>
      [...logs]
        .map((log) => ({
          ...log,
          rainfallTotal: Number.isFinite(log.rainfallTotal) ? log.rainfallTotal : 0,
          dateObj: new Date(`${log.date}T00:00:00`),
        }))
        .filter((log) => !Number.isNaN(log.dateObj.getTime()))
        .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime()),
    [logs],
  );

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const ytdTotal = useMemo(
    () =>
      parsedLogs
        .filter((log) => log.dateObj >= yearStart)
        .reduce((sum, log) => sum + log.rainfallTotal, 0),
    [parsedLogs, yearStart],
  );
  const monthTotal = useMemo(
    () =>
      parsedLogs
        .filter((log) => log.dateObj >= monthStart)
        .reduce((sum, log) => sum + log.rainfallTotal, 0),
    [parsedLogs, monthStart],
  );
  const sevenDayTotal = useMemo(
    () =>
      parsedLogs
        .filter((log) => log.dateObj >= sevenDaysAgo)
        .reduce((sum, log) => sum + log.rainfallTotal, 0),
    [parsedLogs, sevenDaysAgo],
  );

  const chartData = useMemo(() => {
    if (!parsedLogs.length) return [];
    if (period === 'day') {
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const dayTotal = parsedLogs
        .filter((log) => log.date === todayKey)
        .reduce((sum, log) => sum + log.rainfallTotal, 0);
      return [{ label: today.toLocaleDateString([], { month: 'numeric', day: 'numeric' }), rainfall: dayTotal }];
    }
    if (period === 'week') {
      const buckets = Array.from({ length: 7 }).map((_, idx) => {
        const day = new Date();
        day.setDate(day.getDate() - (6 - idx));
        day.setHours(0, 0, 0, 0);
        const key = day.toISOString().slice(0, 10);
        const rainfall = parsedLogs
          .filter((log) => log.date === key)
          .reduce((sum, log) => sum + log.rainfallTotal, 0);
        return {
          label: day.toLocaleDateString([], { weekday: 'short' }),
          rainfall,
        };
      });
      return buckets;
    }
    if (period === 'month') {
      const buckets = Array.from({ length: 30 }).map((_, idx) => {
        const day = new Date();
        day.setDate(day.getDate() - (29 - idx));
        day.setHours(0, 0, 0, 0);
        const key = day.toISOString().slice(0, 10);
        const rainfall = parsedLogs
          .filter((log) => log.date === key)
          .reduce((sum, log) => sum + log.rainfallTotal, 0);
        return {
          label: day.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
          rainfall,
        };
      });
      return buckets;
    }
    const monthBuckets = new Map<string, number>();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), i, 1);
      monthBuckets.set(formatMonthKey(d), 0);
    }
    parsedLogs.forEach((log) => {
      if (log.dateObj.getFullYear() !== now.getFullYear()) return;
      const key = formatMonthKey(log.dateObj);
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + log.rainfallTotal);
    });
    return Array.from(monthBuckets.entries()).map(([key, rainfall]) => {
      const [year, month] = key.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      return { label: d.toLocaleDateString([], { month: 'short' }), rainfall };
    });
  }, [now, parsedLogs, period]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * 10;
    return parsedLogs.slice(start, start + 10);
  }, [page, parsedLogs]);
  const totalPages = Math.max(1, Math.ceil(parsedLogs.length / 10));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Rainfall Tracker</p>
        <div className="flex items-center gap-2">
          {(['day', 'week', 'month', 'year'] as Period[]).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? 'default' : 'outline'}
              className={period === value ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''}
              onClick={() => setPeriod(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <div className="text-xs text-muted-foreground">YTD Total</div>
          <div className="mt-1 text-lg font-semibold">{ytdTotal.toFixed(2)} in</div>
        </div>
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <div className="text-xs text-muted-foreground">This Month</div>
          <div className="mt-1 text-lg font-semibold">{monthTotal.toFixed(2)} in</div>
        </div>
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <div className="text-xs text-muted-foreground">7-Day Total</div>
          <div className="mt-1 text-lg font-semibold">{sevenDayTotal.toFixed(2)} in</div>
        </div>
      </div>

      <div className="mt-4 h-56 rounded-xl border bg-background/70 p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading rainfall...</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No rainfall recorded yet - logs will appear as data is captured
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(1)}`} />
              <Tooltip formatter={(value: number, _name, item) => [`${Number(value).toFixed(2)} in`, String(item?.payload?.label ?? '')]} />
              <Bar dataKey="rainfall" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4">
        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowTable((current) => !current)}>
          {showTable ? 'Hide daily log' : 'View daily log ->'}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Rainfall (in)</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.length ? (
                  pagedRows.map((row) => (
                    <TableRow key={`${row.date}-${row.source ?? 'source'}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.rainfallTotal.toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{row.source ?? 'unknown'}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{row.notes || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No rainfall logs yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
