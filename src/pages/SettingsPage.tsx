import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { createClient } from '@/lib/supabase';
import {
  useDepartmentOptions,
  useEmployees,
  useProgramSettings,
  useProperties,
  useRoleOptions,
  useTasks,
  useWorkerTypes,
} from '@/lib/supabase-queries';
import type { ProgramSettings, Property as LiveProperty } from '@/data/seedData';
import { formatTime } from '@/utils/formatTime';
import { APP_VERSION } from '@/constants/version';
import { COLOR_THEMES, resolveThemeCardColor, type ColorTheme, type CustomThemeColors } from '@/lib/colorThemes';
import { applyThemeSurfaces } from '@/lib/colorConversion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TimeInput } from '@/components/ui/date-input';
import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  GripVertical,
  HelpCircle,
  Loader2,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { SOPSettings } from '@/components/settings/SOPSettings';
import { RecurringTasksSection } from '@/components/settings/RecurringTasksSection';
import { type ThemeMode, useTheme } from '@/hooks/useTheme';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const supabase = createClient();

const TABS = ['Operations', 'Tasks', 'Equipment', 'Workforce', 'SOPs', 'Account', 'Help'] as const;
type Tab = (typeof TABS)[number];

interface SchedulerSettings {
  id: string;
  org_id: string;
  operational_day_start: string;
  operational_day_end: string;
  operational_days: string[];
  min_shift_hours: number;
  max_shift_hours: number;
  overtime_threshold_hours: number;
  escalation_config?: Partial<EscalationThresholds> | null;
}

interface EscalationThresholds {
  equipment_service_overdue_days: number;
  shift_coverage_warning_pct: number;
  wind_speed_spray_cutoff_mph: number;
  rain_probability_spray_cutoff_pct: number;
  heat_advisory_temp_f: number;
}

const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds = {
  equipment_service_overdue_days: 90,
  shift_coverage_warning_pct: 50,
  wind_speed_spray_cutoff_mph: 10,
  rain_probability_spray_cutoff_pct: 40,
  heat_advisory_temp_f: 95,
};

interface ShiftTemplate {
  id: string;
  org_id: string;
  name: string;
  start: string;
  end: string;
  days: string[];
  active: boolean;
}

interface TaskLibraryItem {
  id: string;
  org_id: string;
  property_id: string | null;
  name: string;
  category: string | null;
  priority: number | null;
  estimated_hours: number | null;
}

interface TaskCategoryItem {
  id: string;
  name: string;
  sort_order: number;
}

interface RecurringTaskRule {
  id: string;
  org_id: string;
  property_id: string | null;
  task_id: string;
  employee_id: string | null;
  days_of_week: string[];
  active: boolean;
}

interface AppUserRow {
  id: string;
  employee_id: string;
  role: string;
  status: string;
}

interface OrganizationInfo {
  name: string;
  plan: string | null;
  subscription_status?: string | null;
  created_at?: string | null;
}

interface PropertyItem {
  id: string;
  name: string;
  org_id: string;
  short_name: string | null;
  logo_initials: string | null;
  color: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  acreage: number | null;
  status: string | null;
  created_at: string | null;
}

interface PropertyFormData {
  name: string;
  shortName: string;
  logoInitials: string;
  color: string;
  city: string;
  state: string;
  acreage: string;
}

function toPropertyItem(property: LiveProperty, orgId: string | null): PropertyItem {
  return {
    id: property.id,
    name: property.name,
    org_id: orgId ?? '',
    short_name: property.shortName ?? null,
    logo_initials: property.logoInitials ?? null,
    color: property.color ?? null,
    city: property.city ?? null,
    state: property.state ?? null,
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    acreage: property.acreage ?? null,
    status: property.status ?? null,
    created_at: null,
  };
}

interface UsageStats {
  properties: number;
  employees: number;
  tasks: number;
  scheduleEntriesThisMonth: number;
  departments: number;
  shiftTemplates: number;
}

interface StandardOperatingProcedure {
  id: string;
  description: string | null;
  procedure_body: string | null;
  title: string;
  category: string | null;
  estimated_hours: number | null;
  color: string | null;
  is_active: boolean;
}

function PlaceholderCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4">
      <p className="text-sm text-text-muted">{text}</p>
    </div>
  );
}

const settingsInputClass =
  'w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';
const DEFAULT_PROPERTY_COLOR = '#166534';
const EMPTY_PROPERTY_FORM: PropertyFormData = {
  name: '',
  shortName: '',
  logoInitials: 'GC',
  color: DEFAULT_PROPERTY_COLOR,
  city: '',
  state: '',
  acreage: '0',
};

type ColorThemeProgramSettings = Pick<ProgramSettings, 'primaryColor' | 'accentColor' | 'sidebarColor' | 'fontThemePreset'>;

const ORG_DEFAULT_THEME_OPTION_ID = 'org-default';

function colorsMatch(left?: string | null, right?: string | null) {
  return (left ?? '').toLowerCase() === (right ?? '').toLowerCase();
}

function getProgramSettingsThemeId(programSettings?: ColorThemeProgramSettings | null) {
  if (!programSettings) return null;
  return COLOR_THEMES.find((theme) =>
    colorsMatch(theme.primaryColor, programSettings.primaryColor) &&
    colorsMatch(theme.accentColor, programSettings.accentColor) &&
    colorsMatch(theme.sidebarColor, programSettings.sidebarColor) &&
    theme.fontThemePreset === programSettings.fontThemePreset,
  )?.id ?? null;
}

function getColorThemeLabel(themeId: string | null) {
  return COLOR_THEMES.find((theme) => theme.id === themeId)?.label ?? null;
}

function hexToHslValues(hex: string | undefined | null, fallback: string) {
  if (!hex) return fallback;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return fallback;
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  if ([r, g, b].some((value) => Number.isNaN(value))) return fallback;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const light = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
    }
    hue /= 6;
  }
  return Math.round(hue * 360) + ' ' + Math.round(sat * 100) + '% ' + Math.round(light * 100) + '%';
}

function applyColorThemeToDocument(theme: ColorTheme | null, programSettings?: ColorThemeProgramSettings | null) {
  if (typeof document === 'undefined') return;
  const primaryColor = theme?.primaryColor ?? programSettings?.primaryColor;
  const accentColor = theme?.accentColor ?? programSettings?.accentColor;
  const sidebarColor = theme?.sidebarColor ?? programSettings?.sidebarColor;
  const fontThemePreset = theme?.fontThemePreset ?? programSettings?.fontThemePreset ?? 'modern-sans';
  const cardColor = theme?.cardColor ?? resolveThemeCardColor(
    programSettings?.primaryColor,
    programSettings?.accentColor,
    programSettings?.sidebarColor,
    programSettings?.fontThemePreset,
  );
  const isLightMode = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
  const root = document.documentElement;
  root.style.setProperty('--primary', hexToHslValues(primaryColor, '152 55% 38%'));
  root.style.setProperty('--ring', hexToHslValues(primaryColor, '152 55% 38%'));
  root.style.setProperty('--accent', hexToHslValues(accentColor, '152 30% 94%'));
  root.style.setProperty('--sidebar-primary', hexToHslValues(primaryColor, '152 55% 48%'));
  applyThemeSurfaces(root, { primaryColor, cardColor, sidebarColor }, isLightMode);
  const fontThemes: Record<string, { body: string; heading: string }> = {
    'modern-sans': {
      body: '"Inter", "Segoe UI", sans-serif',
      heading: '"Inter", "Segoe UI", sans-serif',
    },
    'editorial-serif': {
      body: '"Inter", "Segoe UI", sans-serif',
      heading: '"Georgia", "Times New Roman", serif',
    },
    'classic-club': {
      body: '"Trebuchet MS", "Segoe UI", sans-serif',
      heading: '"Palatino Linotype", "Book Antiqua", serif',
    },
    'compact-ops': {
      body: '"Segoe UI", "Arial", sans-serif',
      heading: '"Segoe UI", "Arial", sans-serif',
    },
  };
  const chosenFontTheme = fontThemes[fontThemePreset] || fontThemes['modern-sans'];
  root.style.setProperty('--brand-body-font', chosenFontTheme.body);
  root.style.setProperty('--brand-heading-font', chosenFontTheme.heading);
}

function ColorThemeSwatchGrid({
  activeThemeId,
  disabled = false,
  savingThemeId = null,
  defaultOption,
  onSelectTheme,
}: {
  activeThemeId: string | null;
  disabled?: boolean;
  savingThemeId?: string | null;
  defaultOption?: {
    active: boolean;
    label: string;
    description: string;
    onSelect: () => void | Promise<void>;
  };
  onSelectTheme: (theme: ColorTheme) => void | Promise<void>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {defaultOption ? (
        <button
          type="button"
          disabled={disabled || savingThemeId === ORG_DEFAULT_THEME_OPTION_ID}
          onClick={() => void defaultOption.onSelect()}
          className={[
            'min-h-[74px] rounded-xl border px-3 py-2 text-left transition-colors duration-150',
            defaultOption.active
              ? 'border-brand bg-brand-ghost text-text-primary'
              : 'border-surface-border bg-surface-elevated text-text-secondary hover:border-brand/40 hover:text-text-primary',
            disabled ? 'cursor-not-allowed opacity-60' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{defaultOption.label}</span>
            {savingThemeId === ORG_DEFAULT_THEME_OPTION_ID ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          </div>
          <p className="mt-1 text-xs text-text-muted">{defaultOption.description}</p>
        </button>
      ) : null}
      {COLOR_THEMES.map((theme) => {
        const active = activeThemeId === theme.id;
        const saving = savingThemeId === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            disabled={disabled || saving}
            onClick={() => void onSelectTheme(theme)}
            className={[
              'min-h-[74px] rounded-xl border px-3 py-2 text-left transition-colors duration-150',
              active
                ? 'border-brand bg-brand-ghost text-text-primary'
                : 'border-surface-border bg-surface-elevated text-text-secondary hover:border-brand/40 hover:text-text-primary',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ].filter(Boolean).join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{theme.label}</span>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </div>
            <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
              {[theme.primaryColor, theme.accentColor, theme.sidebarColor].map((color) => (
                <span
                  key={theme.id + '-' + color}
                  className="h-4 w-4 rounded-full border border-surface-border"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const CUSTOM_THEME_OPTION_ID = 'custom';

function CustomColorTile({
  active,
  saving,
  disabled = false,
  onSelect,
}: {
  active: boolean;
  saving: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || saving}
      onClick={onSelect}
      className={[
        'min-h-[74px] rounded-xl border px-3 py-2 text-left transition-colors duration-150',
        active
          ? 'border-brand bg-brand-ghost text-text-primary'
          : 'border-surface-border bg-surface-elevated text-text-secondary hover:border-brand/40 hover:text-text-primary',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Custom</span>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      </div>
      <div
        className="mt-2 h-4 w-full rounded-full border border-surface-border"
        style={{ background: 'linear-gradient(90deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)' }}
        aria-hidden="true"
      />
    </button>
  );
}

const CUSTOM_COLOR_FIELDS: { key: keyof CustomThemeColors; label: string; hint: string }[] = [
  { key: 'primaryColor', label: 'Primary', hint: 'Buttons & primary actions' },
  { key: 'accentColor', label: 'Accent', hint: 'Selected-item state' },
  { key: 'sidebarColor', label: 'Sidebar', hint: 'Navigation rail' },
];

function CustomColorInputs({
  value,
  saving = false,
  onChange,
}: {
  value: CustomThemeColors;
  saving?: boolean;
  onChange: (next: CustomThemeColors) => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-surface-border bg-surface-elevated p-3">
      <div className="flex flex-wrap gap-4">
        {CUSTOM_COLOR_FIELDS.map((field) => (
          <label key={field.key} className="grid gap-1.5 text-xs font-medium text-text-muted">
            <span className="text-text-secondary">{field.label}</span>
            <span className="flex items-center gap-2">
              <span className="h-9 w-9 overflow-hidden rounded-full border border-surface-border">
                <input
                  type="color"
                  value={value[field.key]}
                  disabled={saving}
                  onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
                  className="h-12 w-12 -translate-x-1.5 -translate-y-1.5 cursor-pointer border-0 bg-transparent p-0"
                  aria-label={`${field.label} color`}
                />
              </span>
              <span className="text-[11px] uppercase text-text-secondary">{value[field.key]}</span>
            </span>
            <span className="text-[10px] text-text-muted">{field.hint}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-text-muted">Card tint is derived automatically from the primary color.</p>
    </div>
  );
}

function SettingsCard({
  title,
  subtitle,
  action,
  children,
  stickyHeader = false,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  stickyHeader?: boolean;
}) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className={`mb-4 flex items-start justify-between gap-4 ${stickyHeader ? 'md:sticky md:top-[104px] md:z-20 md:-mx-5 md:border-b md:border-surface-border md:px-5 md:py-3 md:shadow-md bg-surface-card' : ''}`}>
        <div>
          <h2 className={stickyHeader ? 'text-xl font-bold tracking-tight text-text-primary' : 'text-base font-semibold text-text-primary'}>{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function LoadingTimeoutFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
      <p className="text-sm font-medium">
        Data is taking longer than expected
      </p>
      <p className="text-xs text-muted-foreground">
        Try refreshing the page or selecting a shorter date range.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors"
      >
        Refresh page
      </button>
    </div>
  );
}

function SortableShiftTemplateRow({
  template,
  onDelete,
}: {
  template: ShiftTemplate;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 ${
        isDragging ? 'bg-surface-hover' : 'hover:bg-surface-hover'
      }`}
    >
      <button
        type="button"
        className="flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-text-primary active:cursor-grabbing"
        aria-label={`Reorder ${template.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{template.name}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {formatTime(template.start)}-{formatTime(template.end)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {(template.days ?? []).map((day) => (
            <span key={`${template.id}-${day}`} className="rounded-full bg-brand-ghost px-2 py-0.5 text-xs text-brand">
              {day.slice(0, 3).toUpperCase()}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(template.id)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-status-warning/10 hover:text-status-warning"
        aria-label={`Delete ${template.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SortableTaskRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-surface-border bg-surface-card p-4 transition-opacity ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated active:cursor-grabbing"
          aria-label="Reorder task"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SortableTaskRowCompact({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-[44px] items-center gap-2 border-b border-surface-border last:border-0 transition-opacity ${
        isDragging ? 'opacity-50 bg-surface-hover' : ''
      }`}
    >
      <button
        type="button"
        className="flex min-h-[44px] min-w-8 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated active:cursor-grabbing"
        aria-label="Reorder task"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function PropertyFormFields({
  idPrefix,
  propertyForm,
  setPropertyForm,
}: {
  idPrefix: string;
  propertyForm: PropertyFormData;
  setPropertyForm: Dispatch<SetStateAction<PropertyFormData>>;
}) {
  return (
    <div className="grid gap-3">
      <label htmlFor={`${idPrefix}-name`} className="grid gap-1.5 text-xs font-medium text-text-muted">
        Property name *
        <input
          id={`${idPrefix}-name`}
          name="property_name"
          required
          className={settingsInputClass}
          placeholder="Springfield Park Course"
          value={propertyForm.name}
          onChange={(event) => setPropertyForm((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${idPrefix}-short`} className="grid gap-1.5 text-xs font-medium text-text-muted">
          Short name *
          <input
            id={`${idPrefix}-short`}
            name="short_name"
            required
            className={settingsInputClass}
            placeholder="SPC"
            value={propertyForm.shortName}
            onChange={(event) => setPropertyForm((current) => ({ ...current, shortName: event.target.value }))}
          />
        </label>
        <label htmlFor={`${idPrefix}-initials`} className="grid gap-1.5 text-xs font-medium text-text-muted">
          Logo initials *
          <input
            id={`${idPrefix}-initials`}
            name="logo_initials"
            required
            className={settingsInputClass}
            maxLength={3}
            placeholder="GC"
            value={propertyForm.logoInitials}
            onChange={(event) => setPropertyForm((current) => ({ ...current, logoInitials: event.target.value.toUpperCase() }))}
          />
        </label>
      </div>
      <label htmlFor={`${idPrefix}-color`} className="grid gap-1.5 text-xs font-medium text-text-muted">
        Brand color *
        <div className="flex items-center gap-3">
          <input
            id={`${idPrefix}-color`}
            name="color"
            type="color"
            className="h-10 w-14 cursor-pointer rounded-lg border border-surface-border bg-surface-base p-1"
            value={propertyForm.color}
            onChange={(event) => setPropertyForm((current) => ({ ...current, color: event.target.value }))}
            aria-label="Property brand color"
          />
          <span className="text-sm uppercase text-text-secondary">{propertyForm.color}</span>
        </div>
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
        <label htmlFor={`${idPrefix}-city`} className="grid gap-1.5 text-xs font-medium text-text-muted">
          City
          <input
            id={`${idPrefix}-city`}
            name="city"
            className={settingsInputClass}
            placeholder="Springfield"
            value={propertyForm.city}
            onChange={(event) => setPropertyForm((current) => ({ ...current, city: event.target.value }))}
          />
        </label>
        <label htmlFor={`${idPrefix}-state`} className="grid gap-1.5 text-xs font-medium text-text-muted">
          State
          <input
            id={`${idPrefix}-state`}
            name="state"
            className={settingsInputClass}
            maxLength={2}
            placeholder="OH"
            value={propertyForm.state}
            onChange={(event) => setPropertyForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))}
          />
        </label>
      </div>
      <label htmlFor={`${idPrefix}-acreage`} className="grid gap-1.5 text-xs font-medium text-text-muted">
        Acreage
        <input
          id={`${idPrefix}-acreage`}
          name="acreage"
          className={settingsInputClass}
          type="number"
          min={0}
          step="0.1"
          value={propertyForm.acreage}
          onChange={(event) => setPropertyForm((current) => ({ ...current, acreage: event.target.value }))}
        />
      </label>
    </div>
  );
}

function SortablePropertyCard({
  property,
  isEditing,
  propertyForm,
  setPropertyForm,
  savingProperty,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  property: PropertyItem;
  isEditing: boolean;
  propertyForm: PropertyFormData;
  setPropertyForm: Dispatch<SetStateAction<PropertyFormData>>;
  savingProperty: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: property.id,
    disabled: isEditing,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-surface-border px-4 py-3 transition-opacity ${
        isDragging ? 'opacity-50 bg-surface-hover' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-start gap-3">
        {!isEditing ? (
          <button
            type="button"
            className="flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-text-primary active:cursor-grabbing"
            aria-label={`Reorder ${property.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-sm font-medium text-text-primary">{property.name}</p>
          <p className="text-xs text-text-muted">
            {property.short_name || 'No short name'} Â· {property.city || 'No city'}{property.state ? `, ${property.state}` : ''}
          </p>
        </div>
        {!isEditing ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
              onClick={onEdit}
              aria-label={`Edit ${property.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning"
              onClick={onDelete}
              aria-label={`Delete ${property.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <div className="mt-4 grid gap-3 border-t border-surface-border pt-4 transition-all duration-150">
          <PropertyFormFields
            idPrefix={`prop-card-${property.id}`}
            propertyForm={propertyForm}
            setPropertyForm={setPropertyForm}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={savingProperty || !propertyForm.name.trim()}>
              {savingProperty ? 'Saving...' : 'Save property'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface SortableTaskCategoryCardProps {
  category: TaskCategoryItem;
  taskCount: number;
  isEditing: boolean;
  editValue: string;
  isConfirmDelete: boolean;
  onEditStart: () => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  children?: ReactNode;
}

function SortableTaskCategoryCard({
  category,
  taskCount,
  isEditing,
  editValue,
  isConfirmDelete,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  children,
}: SortableTaskCategoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: isEditing,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`overflow-hidden rounded-xl border border-surface-border bg-surface-card transition-opacity ${
        isDragging ? 'opacity-50 bg-surface-hover' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {!isEditing ? (
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-text-primary active:cursor-grabbing"
            aria-label={`Reorder ${category.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {category.name} <span className="text-xs text-text-muted">· {taskCount}</span>
          </p>
        </div>
        {!isEditing && !isConfirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
              onClick={onEditStart}
              aria-label={`Edit ${category.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-text-muted hover:bg-status-warning/10 hover:text-status-warning"
              onClick={onDeleteRequest}
              aria-label={`Delete ${category.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <div className="grid gap-3 border-t border-surface-border px-3 py-3 transition-all duration-150">
          <label className="grid gap-1.5 text-xs font-medium text-text-muted">
            Category name
            <input
              autoFocus
              className={settingsInputClass}
              value={editValue}
              onChange={(event) => onEditChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onEditSave();
                if (event.key === 'Escape') onEditCancel();
              }}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onEditCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={onEditSave} disabled={!editValue.trim()}>
              Save category
            </Button>
          </div>
        </div>
      ) : null}
      {isConfirmDelete ? (
        <div className="grid gap-3 border-t border-surface-border px-3 py-3">
          <p className="text-sm text-text-muted">
            {taskCount > 0
              ? `${taskCount} task${taskCount !== 1 ? 's' : ''} will fall back to General.`
              : 'Delete this category?'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onDeleteCancel}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onDeleteConfirm}>
              Delete category
            </Button>
          </div>
        </div>
      ) : null}
      {children ? (
        <div className="border-t border-surface-border bg-surface-base">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  const { orgId, user, userRole, currentUser, currentPropertyId, signOut } = useOrgProfile();
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = TABS.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'Operations';
  const taskPropertyId =
    (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null) ??
    currentUser?.propertyId ??
    null;

  useEffect(() => {
    document.title = 'Settings — Ground Crew HQ';
  }, []);


  return (
    <div className="settings-theme mx-auto max-w-6xl space-y-4 bg-surface-base p-4 text-text-primary md:p-6">
      {isReadOnly ? (
        <div className="mb-4 rounded-lg border border-status-complete/30 bg-status-complete/10 px-3 py-2 text-xs text-status-complete">
          Demo Mode — Viewing sample data (read-only)
        </div>
      ) : null}

      <fieldset disabled={isReadOnly} style={{ border: 'none', margin: 0, padding: 0 }}>
        {tab === 'Operations' && (
          <OperationsTab
            key="operations"
            orgId={orgId}
            userRole={userRole}
            currentPropertyId={currentPropertyId}
          />
        )}
        {tab === 'Workforce' && <WorkforceTab key="workforce" orgId={orgId} />}
        {tab === 'Tasks' && <TasksTab key="tasks" orgId={orgId} propertyId={taskPropertyId} />}
        {tab === 'Equipment' && <EquipmentTab key="equipment" orgId={orgId} />}
        {tab === 'SOPs' && <SOPSettings key="sops" orgId={orgId} propertyId={taskPropertyId} />}
      </fieldset>
      {tab === 'Account' && (
        <AccessTab
          key="account"
          userEmail={user?.email ?? ''}
          userRole={userRole}
          orgId={orgId}
          employeeName={currentUser?.fullName ?? ''}
          userId={user?.id ?? null}
          themePresetOverride={currentUser?.themePresetOverride ?? null}
          themeCustomColors={currentUser?.themeCustomColors ?? null}
          onSignOut={signOut}
        />
      )}
      {tab === 'Help' && <HelpTab key="help" />}
    </div>
  );
}

function OperationsTab({
  orgId,
  userRole,
  currentPropertyId,
}: {
  orgId: string | null;
  userRole: string | null;
  currentPropertyId: string;
}) {
  return (
    <div className="space-y-8">
      <WorkspaceTab orgId={orgId} userRole={userRole} currentPropertyId={currentPropertyId} />
      <div className="border-t border-dashed border-surface-border pt-6">
        <SchedulerTab orgId={orgId} />
      </div>
    </div>
  );
}

type SettingsEquipmentType = { id: string; name: string; category: string | null };

type AbortableSupabaseRequest<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
};

async function withSettingsAbortControllerTimeout<T>(request: AbortableSupabaseRequest<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Settings request timed out after 15 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
function EquipmentTab({ orgId }: { orgId: string | null }) {
  const queryClient = useQueryClient();
  const equipmentTypesQueryKey = useMemo(
    () => ['settings-equipment-types', orgId ?? 'no-org'] as const,
    [orgId],
  );
  const equipmentTypesQuery = useQuery<SettingsEquipmentType[]>({
    queryKey: equipmentTypesQueryKey,
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return [];
      const { data, error: fetchError } = await withSettingsAbortControllerTimeout(
        supabase
          .from('equipment_types')
          .select('id, name, category')
          .eq('org_id', orgId)
          .eq('active', true)
          .order('name', { ascending: true }),
      );
      if (fetchError) throw fetchError;
      return (data ?? []) as SettingsEquipmentType[];
    },
    staleTime: 1000 * 60 * 5,
  });
  const equipmentTypes = equipmentTypesQuery.data ?? [];
  const loading = equipmentTypesQuery.isLoading && !equipmentTypesQuery.data;
  const error = equipmentTypesQuery.error instanceof Error ? equipmentTypesQuery.error.message : null;
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const categoryOptions = ['Mowing', 'Transport', 'Chemical', 'Trimming', 'Maintenance', 'General'] as const;
  const invalidateEquipmentTypeCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: equipmentTypesQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['equipment-page-data', orgId ?? 'no-org'] }),
    ]);
  }, [equipmentTypesQueryKey, orgId, queryClient]);

  const addType = async () => {
    if (!supabase || !orgId || !newName.trim()) return;
    const { error: insertError } = await supabase.from('equipment_types').insert({
      org_id: orgId, name: newName.trim(), category: newCategory, active: true,
    });
    if (insertError) { toast.error(`Failed to add: ${insertError.message}`); return; }
    setNewName('');
    toast.success('Equipment type added');
    await invalidateEquipmentTypeCaches();
  };

  const saveEdit = async (id: string) => {
    if (!supabase || !orgId || !editingName.trim()) return;
    const { error: updateError } = await supabase
      .from('equipment_types').update({ name: editingName.trim() }).eq('id', id).eq('org_id', orgId);
    if (updateError) { toast.error(`Failed to update: ${updateError.message}`); return; }
    setEditingId(null); setEditingName('');
    toast.success('Updated');
    await invalidateEquipmentTypeCaches();
  };

  const deactivate = async (id: string, name: string) => {
    if (!supabase || !orgId) return;
    const { error: updateError } = await supabase
      .from('equipment_types').update({ active: false }).eq('id', id).eq('org_id', orgId);
    if (updateError) { toast.error(`Failed to remove: ${updateError.message}`); return; }
    toast.success(`Removed ${name}`);
    await invalidateEquipmentTypeCaches();
  };

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-surface-elevated" />;
  if (error) return <ErrorRetry message={error} onRetry={() => void equipmentTypesQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <SettingsCard title="Equipment Types" subtitle="Define the types of equipment your crew uses.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {equipmentTypes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No equipment types yet.</p>
          ) : (
            equipmentTypes.map((type) => (
              <div key={type.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingId === type.id ? (
                  <>
                    <input className={`${settingsInputClass} flex-1`} value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveEdit(type.id)}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{type.name}</span>
                    <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-text-muted">{type.category ?? 'General'}</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingId(type.id); setEditingName(type.name); }} aria-label={`Edit ${type.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivate(type.id, type.name)} aria-label={`Remove ${type.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input className={`${settingsInputClass} flex-1`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Type name" />
          <select className={`${settingsInputClass} w-40`} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            {categoryOptions.map((c) => <option key={`eq-cat-${c}`} value={c}>{c}</option>)}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addType()}>Add</button>
        </div>
      </SettingsCard>
    </div>
  );
}

function WorkspaceTab({
  orgId,
  userRole,
  currentPropertyId,
}: {
  orgId: string | null;
  userRole: string | null;
  currentPropertyId: string;
}) {
  const { theme, setTheme } = useTheme();
  const sopCategoryOptions = ['Mowing', 'Irrigation', 'Chemical Application', 'Bunker', 'Equipment', 'General', 'Other'];

  const router = useRouter();
  const queryClient = useQueryClient();
  const propertiesQuery = useProperties(orgId ?? undefined);
  const employeesQuery = useEmployees(undefined, orgId ?? undefined, 'all');
  const departmentsQuery = useDepartmentOptions(orgId ?? undefined);
  const orgInfoQuery = useQuery({
    queryKey: ['organization-info', orgId ?? 'no-org'],
    queryFn: async () => {
      if (!supabase || !orgId) return null;
      const { data, error } = await withSettingsAbortControllerTimeout(
        supabase
          .from('organizations')
          .select('name, plan, subscription_status, created_at')
          .eq('id', orgId)
          .maybeSingle(),
      );
      if (error) throw error;
      return data as OrganizationInfo | null;
    },
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 30,
    retry: 3,
    retryDelay: 1000,
  });
  const programSettingsQuery = useProgramSettings(orgId ?? undefined);
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [orgNameDraft, setOrgNameDraft] = useState('');
  const properties = useMemo(
    () => (propertiesQuery.data ?? []).map((property) => toPropertyItem(property, orgId)),
    [orgId, propertiesQuery.data],
  );
  const [loading, setLoading] = useState(true);
  const [showTimeout, setShowTimeout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Manager' | 'Field Staff'>('Manager');
  const [savingOrg, setSavingOrg] = useState(false);
  const [propertyForm, setPropertyForm] = useState<PropertyFormData>(EMPTY_PROPERTY_FORM);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [propertyPendingDelete, setPropertyPendingDelete] = useState<PropertyItem | null>(null);
  const [savingProperty, setSavingProperty] = useState(false);
  const savingPropertyRef = useRef(false);
  const [equipmentTypes, setEquipmentTypes] = useState<Array<{ id: string; name: string; category: string | null }>>([]);
  const [newEquipmentTypeName, setNewEquipmentTypeName] = useState('');
  const [newEquipmentTypeCategory, setNewEquipmentTypeCategory] = useState('General');
  const [editingEquipmentTypeId, setEditingEquipmentTypeId] = useState<string | null>(null);
  const [editingEquipmentTypeName, setEditingEquipmentTypeName] = useState('');
  const [loadingDemoData, setLoadingDemoData] = useState(false);
  const [savingOrgColorThemeId, setSavingOrgColorThemeId] = useState<string | null>(null);
  const [orgCustomOpen, setOrgCustomOpen] = useState(false);
  const [sops, setSops] = useState<StandardOperatingProcedure[]>([]);
  const [sopsLoading, setSopsLoading] = useState(false);
  const [sopsError, setSopsError] = useState<string | null>(null);
  const [sopsTimedOut, setSopsTimedOut] = useState(false);
  const [newSopTitle, setNewSopTitle] = useState('');
  const [newSopCategory, setNewSopCategory] = useState('General');
  const [newSopChecklist, setNewSopChecklist] = useState('');
  const [showSopForm, setShowSopForm] = useState(false);
  const [editingSopId, setEditingSopId] = useState<string | null>(null);
  const [editingSopTitle, setEditingSopTitle] = useState('');
  const [editingSopCategory, setEditingSopCategory] = useState('General');
  const [editingSopChecklist, setEditingSopChecklist] = useState('');
  const [usageStats, setUsageStats] = useState<UsageStats>({
    properties: 0,
    employees: 0,
    tasks: 0,
    scheduleEntriesThisMonth: 0,
    departments: 0,
    shiftTemplates: 0,
  });
  const equipmentTypeCategoryOptions = ['Mowing', 'Transport', 'Chemical', 'Trimming', 'Maintenance', 'General'] as const;
  const propertySensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchWorkspaceData = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    const monthStartKey = monthStart.toISOString().slice(0, 10);
    const monthEndKey = monthEnd.toISOString().slice(0, 10);

    const [
      { count: tasksCount, error: tasksError },
      { count: scheduleCount, error: scheduleError },
      { count: shiftTemplatesCount, error: shiftTemplatesError },
      { data: equipmentTypesData, error: equipmentTypesError },
    ] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('schedule_entries')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('date', monthStartKey)
        .lte('date', monthEndKey),
      supabase.from('shift_templates').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('equipment_types').select('id, name, category').eq('org_id', orgId).eq('active', true).order('name', { ascending: true }),
    ]);

    if (tasksError || scheduleError || shiftTemplatesError || equipmentTypesError) {
      setError(
        tasksError?.message ??
          scheduleError?.message ??
          shiftTemplatesError?.message ??
          equipmentTypesError?.message ??
          'Unable to load workspace settings',
      );
      setLoading(false);
      return;
    }

    const nextOrgInfo = orgInfoQuery.data ?? null;
    setOrgInfo(nextOrgInfo);
    setOrgNameDraft(String(nextOrgInfo?.name ?? ''));
    setEquipmentTypes((equipmentTypesData ?? []) as Array<{ id: string; name: string; category: string | null }>);
    setUsageStats({
      properties: properties.length,
      employees: employeesQuery.data?.length ?? 0,
      tasks: tasksCount ?? 0,
      scheduleEntriesThisMonth: scheduleCount ?? 0,
      departments: departmentsQuery.data?.length ?? 0,
      shiftTemplates: shiftTemplatesCount ?? 0,
    });
    setLoading(false);
  }, [departmentsQuery.data?.length, employeesQuery.data?.length, orgId, orgInfoQuery.data, properties.length]);

  useEffect(() => {
    if (!orgId) return;
    if (propertiesQuery.isLoading || employeesQuery.isLoading || departmentsQuery.isLoading || orgInfoQuery.isLoading) return;
    void fetchWorkspaceData();
  }, [
    departmentsQuery.isLoading,
    employeesQuery.isLoading,
    fetchWorkspaceData,
    orgId,
    orgInfoQuery.isLoading,
    propertiesQuery.isLoading,
  ]);

  const hasWorkspaceResult =
    !loading ||
    Boolean(error) ||
    Boolean(orgInfo) ||
    properties.length > 0 ||
    equipmentTypes.length > 0 ||
    Object.values(usageStats).some((value) => value > 0);

  useEffect(() => {
    if (hasWorkspaceResult) {
      setShowTimeout(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowTimeout(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [hasWorkspaceResult]);

  const invalidateEquipmentTypeCaches = useCallback(async () => {
    if (!orgId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['settings-equipment-types', orgId] }),
      queryClient.invalidateQueries({ queryKey: ['equipment-page-data', orgId] }),
    ]);
  }, [orgId, queryClient]);

  const saveOrganization = async () => {
    if (!supabase || !orgId || !orgNameDraft.trim()) return;
    setSavingOrg(true);
    setError(null);
    const { error: updateError } = await supabase.from('organizations').update({ name: orgNameDraft.trim() }).eq('id', orgId);
    setSavingOrg(false);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to save organization name: ${updateError.message}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['organization-info', orgId] });
    setOrgInfo((current) => (current ? { ...current, name: orgNameDraft.trim() } : current));
    toast.success('Organization updated');
  };

  const saveOrgColorTheme = async (theme: ColorTheme) => {
    if (!supabase || !orgId) {
      toast.error('Organization context is unavailable.');
      return;
    }
    setSavingOrgColorThemeId(theme.id);
    try {
      const { error: updateError } = await supabase
        .from('program_settings')
        .update({
          primary_color: theme.primaryColor,
          accent_color: theme.accentColor,
          sidebar_color: theme.sidebarColor,
          font_theme_preset: theme.fontThemePreset,
        })
        .eq('org_id', orgId);
      if (updateError) {
        toast.error('Failed to update color scheme: ' + updateError.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['program-settings', orgId] });
      await queryClient.refetchQueries({ queryKey: ['program-settings', orgId] });
      toast.success('Organization color scheme updated');
    } finally {
      setSavingOrgColorThemeId(null);
    }
  };

  const saveOrgCustomColors = async (colors: CustomThemeColors) => {
    if (!supabase || !orgId) {
      toast.error('Organization context is unavailable.');
      return;
    }
    setSavingOrgColorThemeId(CUSTOM_THEME_OPTION_ID);
    try {
      const { error: updateError } = await supabase
        .from('program_settings')
        .update({
          primary_color: colors.primaryColor,
          accent_color: colors.accentColor,
          sidebar_color: colors.sidebarColor,
        })
        .eq('org_id', orgId);
      if (updateError) {
        toast.error('Failed to update custom colors: ' + updateError.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['program-settings', orgId] });
      await queryClient.refetchQueries({ queryKey: ['program-settings', orgId] });
    } finally {
      setSavingOrgColorThemeId(null);
    }
  };

  const resetPropertyForm = () => {
    setEditingPropertyId(null);
    setPropertyForm(EMPTY_PROPERTY_FORM);
  };

  const saveProperty = async () => {
    if (savingPropertyRef.current) return false;
    const storeOrgId = orgId;
    const name = propertyForm.name.trim();
    const shortName = propertyForm.shortName.trim();
    const logoInitials = propertyForm.logoInitials.trim().slice(0, 3).toUpperCase();
    if (!name || !shortName || !logoInitials) {
      toast.error('Property name, short name, and logo initials are required.');
      return false;
    }
    if (!supabase || !storeOrgId) {
      toast.error('Organization context is unavailable.');
      return false;
    }
    const acreage = Number(propertyForm.acreage || '0');
    if (!Number.isFinite(acreage) || acreage < 0) {
      toast.error('Acreage must be 0 or greater.');
      return false;
    }
    const payload = {
      name,
      short_name: shortName,
      logo_initials: logoInitials,
      color: propertyForm.color || DEFAULT_PROPERTY_COLOR,
      city: propertyForm.city.trim(),
      state: propertyForm.state.trim().slice(0, 2).toUpperCase(),
      acreage,
      status: 'active',
      org_id: storeOrgId,
    };

    setError(null);
    savingPropertyRef.current = true;
    setSavingProperty(true);
    let saveError: { message: string } | null = null;
    try {
      if (editingPropertyId) {
        const result = await supabase
          .from('properties')
          .update(payload)
          .eq('id', editingPropertyId)
          .eq('org_id', storeOrgId);
        saveError = result.error;
      } else {
        const propertyId = crypto.randomUUID();
        const result = await supabase
          .from('properties')
          .insert({
            id: propertyId,
            ...payload,
            sort_order: properties.length,
          });
        saveError = result.error;
      }
      if (saveError) {
        setError(saveError.message);
        toast.error(`Failed to save property: ${saveError.message}`);
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['properties', storeOrgId] });
      await queryClient.refetchQueries({ queryKey: ['properties'] });
      toast.success(editingPropertyId ? 'Property updated successfully' : 'Property added successfully');
      resetPropertyForm();
      return true;
    } finally {
      savingPropertyRef.current = false;
      setSavingProperty(false);
    }
  };

  const openPropertyDialog = () => {
    setEditingCardId(null);
    resetPropertyForm();
    setPropertyDialogOpen(true);
  };

  const closePropertyDialog = () => {
    setPropertyDialogOpen(false);
    resetPropertyForm();
  };

  const handleSaveProperty = async () => {
    const saved = await saveProperty();
    if (saved) setPropertyDialogOpen(false);
  };

  const cancelPropertyCardEdit = () => {
    setEditingCardId(null);
    resetPropertyForm();
  };

  const savePropertyCardEdit = async () => {
    const saved = await saveProperty();
    if (saved) setEditingCardId(null);
  };

  const startPropertyEdit = (property: PropertyItem) => {
    setEditingPropertyId(property.id);
    setPropertyForm({
      name: property.name,
      shortName: property.short_name ?? '',
      logoInitials: property.logo_initials ?? 'GC',
      color: property.color ?? DEFAULT_PROPERTY_COLOR,
      city: property.city ?? '',
      state: property.state ?? '',
      acreage: String(property.acreage ?? 0),
    });
  };

  const handlePropertyDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!supabase || !orgId || !over || active.id === over.id) return;
    const oldIndex = properties.findIndex((property) => property.id === String(active.id));
    const newIndex = properties.findIndex((property) => property.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(properties, oldIndex, newIndex);
    const changedProperties = reordered
      .map((property, index) => ({
        property,
        index,
        previousIndex: properties.findIndex((candidate) => candidate.id === property.id),
      }))
      .filter(({ index, previousIndex }) => index !== previousIndex);

    try {
      const results = await Promise.all(
        changedProperties.map(({ property, index }) =>
          supabase
            .from('properties')
            .update({ sort_order: index })
            .eq('id', property.id)
            .eq('org_id', orgId),
        ),
      );
      const updateError = results.find((result) => result.error)?.error;
      if (updateError) throw new Error(updateError.message);
      toast.success('Property order saved');
    } catch (dragError) {
      const message = dragError instanceof Error ? dragError.message : 'Unable to save property order';
      toast.error(`Unable to save property order: ${message}`);
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['properties', orgId] });
      await queryClient.refetchQueries({ queryKey: ['properties'] });
    }
  };

  const deleteProperty = async (propertyId: string) => {
    if (!supabase || !orgId) return;
    setError(null);
    const { error: deleteError } = await supabase.from('properties').delete().eq('id', propertyId).eq('org_id', orgId);
    if (deleteError) {
      setError(deleteError.message);
      toast.error(`Failed to delete property: ${deleteError.message}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['properties'] });
    setPropertyPendingDelete(null);
    if (editingPropertyId === propertyId) resetPropertyForm();
    toast.success('Property deleted');
  };

  const addEquipmentType = async () => {
    if (!supabase || !orgId || !newEquipmentTypeName.trim()) return;
    const { error: insertError } = await supabase.from('equipment_types').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      property_id: currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null,
      name: newEquipmentTypeName.trim(),
      category: newEquipmentTypeCategory,
      active: true,
    });
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add equipment type: ${insertError.message}`);
      return;
    }
    toast.success(`Equipment type added: ${newEquipmentTypeName.trim()}`);
    setNewEquipmentTypeName('');
    setNewEquipmentTypeCategory('General');
    await fetchWorkspaceData();
    await invalidateEquipmentTypeCaches();
  };

  const saveEquipmentTypeEdit = async (equipmentTypeId: string) => {
    if (!supabase || !orgId || !editingEquipmentTypeName.trim()) return;
    const { error: updateError } = await supabase
      .from('equipment_types')
      .update({ name: editingEquipmentTypeName.trim() })
      .eq('id', equipmentTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update equipment type: ${updateError.message}`);
      return;
    }
    toast.success(`Equipment type updated: ${editingEquipmentTypeName.trim()}`);
    setEditingEquipmentTypeId(null);
    setEditingEquipmentTypeName('');
    await fetchWorkspaceData();
    await invalidateEquipmentTypeCaches();
  };

  const deactivateEquipmentType = async (equipmentTypeId: string, name: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(`Delete equipment type "${name}"?`);
    if (!confirmed) return;
    const { error: updateError } = await supabase
      .from('equipment_types')
      .update({ active: false })
      .eq('id', equipmentTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to delete equipment type: ${updateError.message}`);
      return;
    }
    toast.success(`Equipment type deleted: ${name}`);
    await fetchWorkspaceData();
    await invalidateEquipmentTypeCaches();
  };

  const loadDemoData = async () => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(
      'This will add sample employees, tasks, schedule entries, and assignments for demo purposes. Continue?',
    );
    if (!confirmed) return;

    setError(null);
    setLoadingDemoData(true);
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const monday = new Date(today);
    const dayOfWeek = monday.getDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    monday.setDate(monday.getDate() - offsetToMonday);
    const weekdayKeys = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date.toISOString().slice(0, 10);
    });

    const activePropertyId =
      (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null) ??
      properties[0]?.id ??
      null;

    if (!activePropertyId) {
      setLoadingDemoData(false);
      setError('Add a property first to load demo data.');
      toast.error('Failed to load demo data: add a property first.');
      return;
    }

    const [{ count: taskCount }, { count: equipmentTypeCount }, { count: equipmentCount }] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('equipment_types').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('equipment_units').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);

    const demoEmployeesSeed = [
      { first_name: 'Alex', last_name: 'Rivera', role: 'Field Staff', department: 'Maintenance' },
      { first_name: 'Jordan', last_name: 'Martinez', role: 'Field Staff', department: 'Irrigation' },
      { first_name: 'Sam', last_name: 'Thompson', role: 'Field Manager', department: 'Maintenance' },
      { first_name: 'Casey', last_name: 'Williams', role: 'Field Staff', department: 'General' },
    ];

    let demoEmployees: Array<{ id: string; first_name: string; last_name: string }> = [];

    const liveEmployees = employeesQuery.data ?? [];

    if (liveEmployees.length < 3) {
      const employeeRows = demoEmployeesSeed.map((employee) => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        property_id: activePropertyId,
        first_name: employee.first_name,
        last_name: employee.last_name,
        role: employee.role,
        department: employee.department,
        status: 'active',
        active: true,
      }));
      const { error: employeeError } = await supabase
        .from('employees')
        .insert(employeeRows);
      if (employeeError) {
        setLoadingDemoData(false);
        setError(employeeError.message);
        toast.error(`Failed to seed demo employees: ${employeeError.message}`);
        return;
      }
      demoEmployees = employeeRows.map(({ id, first_name, last_name }) => ({
        id,
        first_name,
        last_name,
      }));
    } else {
      demoEmployees = liveEmployees
        .filter((employee) => employee.active && employee.status === 'active')
        .sort((left, right) => left.lastName.localeCompare(right.lastName))
        .slice(0, 4)
        .map(({ id, firstName, lastName }) => ({ id, first_name: firstName, last_name: lastName }));
    }

    const taskSeed = [
      { name: 'Mow Greens', category: 'Mowing', estimated_hours: 3, priority: 1 },
      { name: 'Mow Fairways', category: 'Mowing', estimated_hours: 4, priority: 1 },
      { name: 'Roll Greens', category: 'Mowing', estimated_hours: 2, priority: 2 },
      { name: 'Bunker Maintenance', category: 'Maintenance', estimated_hours: 3, priority: 2 },
      { name: 'Irrigation Check', category: 'Irrigation', estimated_hours: 3, priority: 2 },
      { name: 'Trim & Edge', category: 'Maintenance', estimated_hours: 2, priority: 2 },
      { name: 'Collect Balls', category: 'General', estimated_hours: 3, priority: 2 },
      { name: 'Change Cups', category: 'Maintenance', estimated_hours: 2.5, priority: 2 },
      { name: 'Mow Tees', category: 'Mowing', estimated_hours: 2, priority: 2 },
      { name: 'Bunker Rake', category: 'Maintenance', estimated_hours: 2, priority: 3 },
      { name: 'Cart Path Blow Off', category: 'General', estimated_hours: 1.5, priority: 3 },
      { name: 'Debris Patrol', category: 'General', estimated_hours: 1, priority: 3 },
    ];

    let taskRowsForAssignments: Array<{ id: string; name: string; estimated_hours: number | null }> = [];

    if ((taskCount ?? 0) < 5) {
      const rows = taskSeed.map((task) => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        property_id: activePropertyId,
        name: task.name,
        category: task.category,
        status: 'active',
        priority: task.priority,
        estimated_hours: task.estimated_hours,
      }));
      const { data: insertedTasks, error: taskInsertError } = await supabase
        .from('tasks')
        .insert(rows)
        .select('id, name, estimated_hours');
      if (taskInsertError) {
        setLoadingDemoData(false);
        setError(taskInsertError.message);
        toast.error(`Failed to seed demo tasks: ${taskInsertError.message}`);
        return;
      }
      taskRowsForAssignments = (insertedTasks ?? []) as Array<{ id: string; name: string; estimated_hours: number | null }>;
    } else {
      const { data: existingTasks, error: existingTaskError } = await supabase
        .from('tasks')
        .select('id, name, estimated_hours')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('priority', { ascending: true })
        .order('name', { ascending: true })
        .limit(12);
      if (existingTaskError) {
        setLoadingDemoData(false);
        setError(existingTaskError.message);
        toast.error(`Failed to read tasks for demo seed: ${existingTaskError.message}`);
        return;
      }
      taskRowsForAssignments = (existingTasks ?? []) as Array<{ id: string; name: string; estimated_hours: number | null }>;
    }

    if (demoEmployees.length > 0) {
      const { data: existingWeekSchedule, error: weekScheduleError } = await supabase
        .from('schedule_entries')
        .select('employee_id, date')
        .eq('org_id', orgId)
        .in('employee_id', demoEmployees.map((employee) => employee.id))
        .in('date', weekdayKeys);
      if (weekScheduleError) {
        setLoadingDemoData(false);
        setError(weekScheduleError.message);
        toast.error(`Failed to read schedules for demo seed: ${weekScheduleError.message}`);
        return;
      }
      const existingWeekKeySet = new Set((existingWeekSchedule ?? []).map((row) => `${row.employee_id}-${row.date}`));
      const scheduleRows = demoEmployees.flatMap((employee) =>
        weekdayKeys
          .filter((dateKey) => !existingWeekKeySet.has(`${employee.id}-${dateKey}`))
          .map((dateKey) => ({
            id: crypto.randomUUID(),
            org_id: orgId,
            employee_id: employee.id,
            property_id: activePropertyId,
            date: dateKey,
            shift_start: '07:00',
            shift_end: '15:30',
            status: 'scheduled',
          })),
      );
      if (scheduleRows.length > 0) {
        const { error: scheduleError } = await supabase.from('schedule_entries').insert(scheduleRows);
        if (scheduleError) {
          setLoadingDemoData(false);
          setError(scheduleError.message);
          toast.error(`Failed to seed demo schedule entries: ${scheduleError.message}`);
          return;
        }
      }

      if (taskRowsForAssignments.length > 0) {
        const { data: existingAssignments, error: assignmentFetchError } = await supabase
          .from('assignments')
          .select('employee_id')
          .eq('org_id', orgId)
          .eq('date', todayKey)
          .in('employee_id', demoEmployees.map((employee) => employee.id));
        if (assignmentFetchError) {
          setLoadingDemoData(false);
          setError(assignmentFetchError.message);
          toast.error(`Failed to read assignments for demo seed: ${assignmentFetchError.message}`);
          return;
        }
        const assignedTodaySet = new Set((existingAssignments ?? []).map((row) => row.employee_id as string));
        const targetTasks = taskRowsForAssignments.slice(0, Math.max(3, Math.min(6, taskRowsForAssignments.length)));
        const assignmentRows = demoEmployees
          .filter((employee) => !assignedTodaySet.has(employee.id))
          .flatMap((employee) =>
            targetTasks.slice(0, 3).map((task, index) => ({
              id: crypto.randomUUID(),
              org_id: orgId,
              property_id: activePropertyId,
              employee_id: employee.id,
              task_id: task.id,
              title: task.name,
              date: todayKey,
              status: 'planned',
              estimated_hours: Number(task.estimated_hours ?? 0),
              order_index: index,
            })),
          );
        if (assignmentRows.length > 0) {
          const { error: assignmentInsertError } = await supabase.from('assignments').insert(assignmentRows);
          if (assignmentInsertError) {
            setLoadingDemoData(false);
            setError(assignmentInsertError.message);
            toast.error(`Failed to seed demo assignments: ${assignmentInsertError.message}`);
            return;
          }
        }
      }
    }

    let equipmentTypesByName = new Map<string, { id: string; name: string }>();
    if ((equipmentTypeCount ?? 0) === 0) {
      const equipmentTypeRows = [
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Walk Mower', short_name: 'WM', category: 'Mowing', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Riding Mower', short_name: 'RM', category: 'Mowing', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Utility Vehicle', short_name: 'UV', category: 'Transport', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'String Trimmer', short_name: 'ST', category: 'Trimming', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Sprayer', short_name: 'SP', category: 'Chemical', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Aerator', short_name: 'AE', category: 'Maintenance', active: true },
      ];
      const { data: insertedTypes, error: typeInsertError } = await supabase
        .from('equipment_types')
        .insert(equipmentTypeRows)
        .select('id, name');
      if (typeInsertError) {
        setLoadingDemoData(false);
        setError(typeInsertError.message);
        toast.error(`Failed to seed equipment types: ${typeInsertError.message}`);
        return;
      }
      equipmentTypesByName = new Map(
        ((insertedTypes ?? []) as Array<{ id: string; name: string }>).map((row) => [row.name, row]),
      );
    } else {
      const { data: existingTypes, error: typeFetchError } = await supabase
        .from('equipment_types')
        .select('id, name')
        .eq('org_id', orgId)
        .order('name', { ascending: true });
      if (typeFetchError) {
        setLoadingDemoData(false);
        setError(typeFetchError.message);
        toast.error(`Failed to read equipment types: ${typeFetchError.message}`);
        return;
      }
      equipmentTypesByName = new Map(
        ((existingTypes ?? []) as Array<{ id: string; name: string }>).map((row) => [row.name, row]),
      );
    }

    if ((equipmentCount ?? 0) === 0) {
      const now = new Date();
      const daysAgo = (days: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
      };
      const equipmentSeed = [
        { name: 'Toro Greensmaster 3150', unit_name: 'T-001', type: 'Walk Mower', status: 'available', location: 'Equipment barn', last_serviced: daysAgo(30) },
        { name: 'John Deere 2500E', unit_name: 'JD-001', type: 'Riding Mower', status: 'available', location: 'Equipment barn', last_serviced: daysAgo(95) },
        { name: 'Toro Workman HDX', unit_name: 'T-002', type: 'Utility Vehicle', status: 'in_use', location: 'Course', last_serviced: daysAgo(45) },
        { name: 'Stihl FS 131', unit_name: 'ST-001', type: 'String Trimmer', status: 'available', location: 'Equipment barn', last_serviced: daysAgo(10) },
      ];

      const equipmentRows = equipmentSeed
        .map((equipment) => {
          const equipmentTypeId = equipmentTypesByName.get(equipment.type)?.id ?? null;
          if (!equipmentTypeId) return null;
          return {
            id: crypto.randomUUID(),
            org_id: orgId,
            property_id: activePropertyId,
            equipment_type_id: equipmentTypeId,
            name: equipment.name,
            unit_name: equipment.unit_name,
            type: equipment.type,
            status: equipment.status,
            location: equipment.location,
            last_serviced: equipment.last_serviced,
            active: true,
          };
        })
        .filter(Boolean);

      if (equipmentRows.length > 0) {
        const { error: equipmentError } = await supabase.from('equipment_units').insert(equipmentRows);
        if (equipmentError) {
          setLoadingDemoData(false);
          setError(equipmentError.message);
          toast.error(`Failed to seed equipment units: ${equipmentError.message}`);
          return;
        }
      }
    }

    setLoadingDemoData(false);
    await fetchWorkspaceData();
    await invalidateEquipmentTypeCaches();
    toast.success('Demo data loaded! Navigate to the Workboard to see it.');
  };

  const isProPlan =
    String(orgInfo?.subscription_status ?? '').toLowerCase() === 'active' ||
    String(orgInfo?.plan ?? '').toLowerCase().includes('pro');
  const usageLimits = {
    properties: isProPlan ? null : 3,
    employees: isProPlan ? null : 10,
    tasks: isProPlan ? null : 50,
    scheduleEntriesThisMonth: isProPlan ? null : 100,
  } as const;
  const usageRows = [
    { key: 'properties', label: 'Properties', value: usageStats.properties, limit: usageLimits.properties },
    { key: 'employees', label: 'Employees', value: usageStats.employees, limit: usageLimits.employees },
    { key: 'tasks', label: 'Tasks', value: usageStats.tasks, limit: usageLimits.tasks },
    { key: 'scheduleEntriesThisMonth', label: 'Schedule entries (this month)', value: usageStats.scheduleEntriesThisMonth, limit: usageLimits.scheduleEntriesThisMonth },
  ] as const;
  const usageAtLimit = usageRows.some((row) => row.limit != null && row.value >= row.limit);
  const setupChecklist = [
    {
      label: 'Organization name',
      done: Boolean(orgNameDraft.trim() && orgNameDraft.trim().toLowerCase() !== 'ground crew hq'),
      href: '/app/settings?tab=Operations',
    },
    { label: 'Add property', done: usageStats.properties > 0, href: '/app/settings?tab=Operations' },
    { label: 'Add departments', done: usageStats.departments > 0, href: '/app/settings?tab=Workforce' },
    { label: 'Add employees', done: usageStats.employees > 0, href: '/app/employees' },
    { label: 'Create shift templates', done: usageStats.shiftTemplates > 0, href: '/app/scheduler' },
    { label: 'Build task library', done: usageStats.tasks > 0, href: '/app/settings?tab=Tasks' },
  ];
  const setupComplete = setupChecklist.every((item) => item.done);


  const fetchSops = useCallback(async () => {
    if (!supabase || !orgId) {
      setSops([]);
      setSopsLoading(false);
      return;
    }

    setSopsLoading(true);
    setSopsError(null);
    setSopsTimedOut(false);

    const { data, error: fetchError } = await supabase
      .from('sops')
      .select('id, title, description, procedure_body, category, estimated_hours, color, is_active')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setSopsError(fetchError.message);
      setSops([]);
      setSopsLoading(false);
      setSopsTimedOut(false);
      return;
    }

    setSops((data ?? []) as StandardOperatingProcedure[]);
    setSopsLoading(false);
    setSopsTimedOut(false);
  }, [orgId]);

  useEffect(() => {
    void fetchSops();
  }, [fetchSops]);

  useEffect(() => {
    if (!sopsLoading) {
      setSopsTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSopsTimedOut(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [sopsLoading]);

  const addSop = async () => {
    const title = newSopTitle.trim();
    const procedureBody = newSopChecklist.trim();
    if (!title || !procedureBody) {
      toast.error('Enter a title and procedure steps.');
      return;
    }
    if (!supabase || !orgId) {
      toast.error('Organization context is unavailable.');
      return;
    }

    const { data, error: insertError } = await supabase
      .from('sops')
      .insert({
        title,
        org_id: orgId,
        description: null,
        procedure_body: procedureBody,
        category: newSopCategory || null,
        estimated_hours: 0,
        color: null,
        is_active: true,
      })
      .select('id, title, description, procedure_body, category, estimated_hours, color, is_active')
      .single();

    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    setSops((current) => [...current, data as StandardOperatingProcedure]);
    setNewSopTitle('');
    setNewSopCategory('General');
    setNewSopChecklist('');
    setShowSopForm(false);
    toast.success(`SOP added: ${title}`);
  };

  const startSopEdit = (sop: StandardOperatingProcedure) => {
    setEditingSopId(sop.id);
    setEditingSopTitle(sop.title);
    setEditingSopCategory(sop.category ?? 'General');
    setEditingSopChecklist(sop.procedure_body ?? '');
  };

  const saveSopEdit = async (sopId: string) => {
    const title = editingSopTitle.trim();
    const procedureBody = editingSopChecklist.trim();
    if (!title || !procedureBody) {
      toast.error('Enter a title and procedure steps.');
      return;
    }
    if (!supabase || !orgId) {
      toast.error('Organization context is unavailable.');
      return;
    }

    const { error: updateError } = await supabase
      .from('sops')
      .update({
        title,
        description: null,
        procedure_body: procedureBody,
        category: editingSopCategory || null,
        estimated_hours: 0,
        color: null,
      })
      .eq('id', sopId)
      .eq('org_id', orgId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    setSops((current) =>
      current.map((sop) =>
        sop.id === sopId
          ? {
              ...sop,
              title,
              description: null,
              procedure_body: procedureBody,
              category: editingSopCategory || null,
              estimated_hours: 0,
              color: null,
            }
          : sop,
      ),
    );
    setEditingSopId(null);
    setEditingSopTitle('');
    setEditingSopChecklist('');
    toast.success(`SOP updated: ${title}`);
  };

  const deleteSop = async (sopId: string, title: string) => {
    const confirmed = window.confirm(`Delete SOP "${title}"?`);
    if (!confirmed) return;
    if (!supabase || !orgId) {
      toast.error('Organization context is unavailable.');
      return;
    }

    const { error: updateError } = await supabase
      .from('sops')
      .update({ is_active: false })
      .eq('id', sopId)
      .eq('org_id', orgId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    setSops((current) => current.filter((sop) => sop.id !== sopId));
    toast.success(`SOP deleted: ${title}`);
  };

  if (!orgId || loading) {
    return showTimeout && !hasWorkspaceResult ? <LoadingTimeoutFallback /> : <PageSkeleton />;
  }

  if (error) {
    return (
      <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchWorkspaceData()} />
    );
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Setup Checklist"
        action={
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Setup checklist help" className="rounded p-0.5 text-text-muted hover:text-text-secondary">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Complete these steps to fully configure your operation.</TooltipContent>
          </Tooltip>
        }
      >
        {setupComplete ? (
          <p className="text-sm font-semibold text-brand">Setup complete ✓</p>
        ) : (
          <div className="grid gap-2">
            {setupChecklist.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-3 rounded-lg border border-surface-border bg-surface-elevated px-4 py-3 text-left text-sm transition-colors hover:bg-surface-hover ${
                  item.done ? 'text-brand' : 'text-text-primary'
                }`}
              >
                <span>{item.done ? '☑' : '☐'}</span>
                <span className="flex-1">{item.label}</span>
                {!item.done ? <ChevronRight className="h-4 w-4 text-text-muted" /> : null}
              </button>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Organization Info">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted">Organization name</label>
            <input className={settingsInputClass} value={orgNameDraft} onChange={(event) => setOrgNameDraft(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted">Plan</label>
            <span className="w-fit rounded-full border border-surface-border px-3 py-1 text-xs text-text-secondary">
              {(orgInfo?.plan ?? 'starter').toString()}
            </span>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted">Created</label>
            <span className="text-xs text-text-secondary">
              {orgInfo?.created_at ? new Date(orgInfo.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void saveOrganization()}
            disabled={savingOrg}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright disabled:opacity-60"
          >
            {savingOrg ? 'Saving...' : 'Save'}
          </button>
          {userRole === 'admin' ? (
            <button
              onClick={() => void loadDemoData()}
              disabled={loadingDemoData}
              className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-60"
            >
              {loadingDemoData ? 'Loading Demo Data...' : 'Load Demo Data'}
            </button>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard title="Usage">
        <div className="grid gap-4">
          {usageRows.map((row) => {
            const ratio = row.limit ? Math.min(1, row.value / row.limit) : 0;
            const barColorClass = ratio >= 0.9 ? 'bg-status-warning' : ratio >= 0.75 ? 'bg-status-pending' : 'bg-status-active';
            const limitLabel = row.limit == null ? 'Unlimited' : row.limit;
            return (
              <div key={`usage-${row.key}`} className="grid gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-primary">{row.label}</span>
                  <span className="text-text-muted">{row.value} / {limitLabel}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-border">
                  <div
                    className={`h-full transition-all ${barColorClass}`}
                    style={{ width: row.limit == null ? '20%' : `${Math.min(100, Math.max(2, ratio * 100))}%` }}
                  />
                </div>
              </div>
            );
          })}
          {usageAtLimit && !isProPlan ? (
            <button
              type="button"
              onClick={() => router.push('/app/settings?tab=Account')}
              className="w-fit text-sm text-brand underline hover:text-brand-bright"
            >
              Approaching plan limits. Contact support to upgrade.
            </button>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        title={`Properties (${properties.length})`}
        action={
          <Button type="button" size="sm" onClick={openPropertyDialog}>
            <Plus className="h-4 w-4" />
            Add property
          </Button>
        }
      >
        {properties.length === 0 ? (
          <p className="text-sm text-text-muted">No properties yet. Add your first property.</p>
        ) : (
          <DndContext sensors={propertySensors} collisionDetection={closestCenter} onDragEnd={handlePropertyDragEnd}>
            <SortableContext items={properties.map((property) => property.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 pr-1">
                {properties.map((property) => (
                  <SortablePropertyCard
                    key={property.id}
                    property={property}
                    isEditing={editingCardId === property.id}
                    propertyForm={propertyForm}
                    setPropertyForm={setPropertyForm}
                    savingProperty={savingProperty}
                    onEdit={() => {
                      setEditingCardId(property.id);
                      startPropertyEdit(property);
                    }}
                    onCancelEdit={cancelPropertyCardEdit}
                    onSave={() => void savePropertyCardEdit()}
                    onDelete={() => setPropertyPendingDelete(property)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </SettingsCard>

      <Dialog open={propertyDialogOpen} onOpenChange={(open) => { if (open) setPropertyDialogOpen(true); else closePropertyDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPropertyId ? 'Edit property' : 'Add property'}</DialogTitle>
            <DialogDescription>
              {editingPropertyId ? 'Edit the selected property details' : 'Add a new property to your organization'}
            </DialogDescription>
          </DialogHeader>
          <PropertyFormFields
            idPrefix="prop-dialog"
            propertyForm={propertyForm}
            setPropertyForm={setPropertyForm}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePropertyDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveProperty()}
              disabled={savingProperty || !propertyForm.name.trim()}
            >
              {savingProperty ? 'Saving...' : 'Save property'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(propertyPendingDelete)} onOpenChange={(open) => { if (!open) setPropertyPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete property?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {propertyPendingDelete?.name ?? 'this property'} from the workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-warning text-text-inverse hover:bg-status-warning/90"
              onClick={() => {
                if (propertyPendingDelete) void deleteProperty(propertyPendingDelete.id);
              }}
            >
              Delete Property
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SettingsCard
        title="Standard Operating Procedures"
        action={
          !showSopForm ? (
            <button
              onClick={() => setShowSopForm(true)}
              className="rounded-lg border border-surface-border bg-surface-card px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
            >
              + Add SOP
            </button>
          ) : null
        }
      >
        {sopsLoading && !sopsTimedOut ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((row) => (
              <div key={`sop-skeleton-${row}`} className="rounded-xl border border-surface-border bg-surface-elevated p-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-surface-border" />
                <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-surface-border" />
              </div>
            ))}
          </div>
        ) : sopsError || sopsTimedOut ? (
          <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
            <p className="text-sm font-medium text-status-warning">Failed to load SOPs</p>
            <p className="mt-1 text-xs text-text-muted">
              {sopsError ?? 'The request took longer than expected.'}
            </p>
            <button
              type="button"
              className="mt-3 rounded-lg border border-surface-border bg-surface-card px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
              onClick={() => {
                setSopsTimedOut(false);
                void fetchSops();
              }}
            >
              Retry
            </button>
          </div>
        ) : sops.length === 0 && !showSopForm ? (
          <div className="rounded-xl border border-dashed border-surface-border bg-surface-elevated p-6 text-center">
            <p className="text-sm font-medium text-text-primary">No SOPs yet. Create your first SOP.</p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
              onClick={() => setShowSopForm(true)}
            >
              Add SOP
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {sops.map((sop) => (
              <div key={sop.id} className="rounded-xl border border-surface-border bg-surface-elevated p-4">
                {editingSopId === sop.id ? (
                  <div className="grid gap-3">
                    <input className={settingsInputClass} value={editingSopTitle} onChange={(event) => setEditingSopTitle(event.target.value)} placeholder="SOP title" />
                    <select className={settingsInputClass} value={editingSopCategory} onChange={(event) => setEditingSopCategory(event.target.value)}>
                      {sopCategoryOptions.map((category) => (
                        <option key={`sop-edit-category-${category}`} value={category}>{category}</option>
                      ))}
                    </select>
                    <textarea className={settingsInputClass} value={editingSopChecklist} onChange={(event) => setEditingSopChecklist(event.target.value)} rows={5} placeholder="Procedure steps" />
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void saveSopEdit(sop.id)}>Save</button>
                      <button className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover" onClick={() => { setEditingSopId(null); setEditingSopTitle(''); setEditingSopChecklist(''); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{sop.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {sop.category ?? 'General'} - {(sop.procedure_body ?? '').split('\n').filter((line) => line.trim()).length} step{(sop.procedure_body ?? '').split('\n').filter((line) => line.trim()).length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button className="rounded-lg p-2 text-text-muted hover:bg-surface-card hover:text-text-primary" onClick={() => startSopEdit(sop)} aria-label={`Edit ${sop.title}`}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deleteSop(sop.id, sop.title)} aria-label={`Delete ${sop.title}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {showSopForm ? (
          <div className="mt-4 grid gap-3 border-t border-surface-border pt-4">
            <p className="text-sm font-medium text-text-primary">Add SOP</p>
            <input className={settingsInputClass} value={newSopTitle} onChange={(event) => setNewSopTitle(event.target.value)} placeholder="SOP title" />
            <select className={settingsInputClass} value={newSopCategory} onChange={(event) => setNewSopCategory(event.target.value)}>
              {sopCategoryOptions.map((category) => (
                <option key={`sop-category-${category}`} value={category}>{category}</option>
              ))}
            </select>
            <textarea className={settingsInputClass} value={newSopChecklist} onChange={(event) => setNewSopChecklist(event.target.value)} rows={5} placeholder="Procedure steps" />
            <div className="flex gap-2">
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addSop()}>Save</button>
              <button className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover" onClick={() => { setShowSopForm(false); setNewSopTitle(''); setNewSopCategory('General'); setNewSopChecklist(''); }}>Cancel</button>
            </div>
          </div>
        ) : null}
      </SettingsCard>

      {/* ── Appearance ── */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Appearance</h3>
          <p className="mt-0.5 text-xs text-text-muted">Choose how Ground Crew HQ looks on this device.</p>
        </div>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => void setTheme(mode)}
              className={`min-h-[36px] rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors duration-150 ${
                theme === mode
                  ? 'border-brand bg-brand text-text-inverse'
                  : 'border-surface-border bg-surface-elevated text-text-secondary hover:border-brand/40 hover:text-text-primary'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {['admin', 'manager'].includes(String(userRole ?? '').toLowerCase()) ? (
        (() => {
          const orgThemeId = getProgramSettingsThemeId(programSettingsQuery.data);
          const orgCustomActive = orgThemeId === null;
          const orgCustomValue: CustomThemeColors = {
            primaryColor: programSettingsQuery.data?.primaryColor ?? '#2FA866',
            accentColor: programSettingsQuery.data?.accentColor ?? '#16a34a',
            sidebarColor: programSettingsQuery.data?.sidebarColor ?? '#0f172a',
          };
          return (
            <div className="rounded-xl border border-surface-border bg-surface-card p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-text-primary">Color Scheme</h3>
                <p className="mt-0.5 text-xs text-text-muted">Set the default colors for this organization, or pick Custom for your own.</p>
              </div>
              <ColorThemeSwatchGrid
                activeThemeId={orgThemeId}
                disabled={programSettingsQuery.isLoading || Boolean(savingOrgColorThemeId)}
                savingThemeId={savingOrgColorThemeId}
                onSelectTheme={(theme) => { setOrgCustomOpen(false); return saveOrgColorTheme(theme); }}
              />
              <div className="mt-2">
                <CustomColorTile
                  active={orgCustomActive}
                  saving={savingOrgColorThemeId === CUSTOM_THEME_OPTION_ID}
                  disabled={programSettingsQuery.isLoading}
                  onSelect={() => setOrgCustomOpen((open) => !open || !orgCustomActive ? true : false)}
                />
                {orgCustomActive && !orgCustomOpen ? (
                  <p className="mt-1 text-xs text-text-muted">No preset selected — using custom workspace colors. Click Custom to edit.</p>
                ) : null}
                {orgCustomOpen || orgCustomActive ? (
                  <CustomColorInputs
                    value={orgCustomValue}
                    saving={savingOrgColorThemeId === CUSTOM_THEME_OPTION_ID}
                    onChange={(next) => { void saveOrgCustomColors(next); }}
                  />
                ) : null}
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}

function WorkforceTab({ orgId }: { orgId: string | null }) {
  const queryClient = useQueryClient();
  const departmentsQuery = useDepartmentOptions(orgId ?? undefined);
  const rolesQuery = useRoleOptions(orgId ?? undefined);
  const workerTypesQuery = useWorkerTypes(orgId ?? undefined);
  const departments = useMemo(
    () =>
      (departmentsQuery.data ?? [])
        .map(({ id, name }) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [departmentsQuery.data],
  );
  const roles = useMemo(
    () =>
      (rolesQuery.data ?? [])
        .filter((role) => role.name.trim())
        .map(({ id, name }) => ({ id, name })),
    [rolesQuery.data],
  );
  const workerTypes = useMemo(
    () =>
      (workerTypesQuery.data ?? [])
        .filter((workerType) => workerType.name.trim())
        .map(({ id, name }) => ({ id, name })),
    [workerTypesQuery.data],
  );
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newWorkerTypeName, setNewWorkerTypeName] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingWorkerTypeId, setEditingWorkerTypeId] = useState<string | null>(null);
  const [editingWorkerTypeName, setEditingWorkerTypeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkforceSummary = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['department-options'] }),
      queryClient.invalidateQueries({ queryKey: ['role-options'] }),
      queryClient.invalidateQueries({ queryKey: ['worker-types'] }),
    ]);
    setLoading(false);
  }, [orgId, queryClient]);

  useEffect(() => {
    if (!orgId) return;
    if (departmentsQuery.isLoading || rolesQuery.isLoading || workerTypesQuery.isLoading) return;
    void fetchWorkforceSummary();
  }, [departmentsQuery.isLoading, fetchWorkforceSummary, orgId, rolesQuery.isLoading, workerTypesQuery.isLoading]);

  const addDepartment = useCallback(async () => {
    if (!supabase || !orgId || !newDepartmentName.trim()) return;
    const { error: insertError } = await supabase.from('departments').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      name: newDepartmentName.trim(),
      active: true,
    });
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add department: ${insertError.message}`);
      return;
    }
    toast.success(`Department added: ${newDepartmentName.trim()}`);
    setNewDepartmentName('');
    await queryClient.invalidateQueries({ queryKey: ['department-options'] });
  }, [newDepartmentName, orgId, queryClient]);

  const saveDepartmentEdit = useCallback(async () => {
    if (!supabase || !orgId || !editingDepartmentId || !editingDepartmentName.trim()) return;
    const { error: updateError } = await supabase
      .from('departments')
      .update({ name: editingDepartmentName.trim() })
      .eq('id', editingDepartmentId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update department: ${updateError.message}`);
      return;
    }
    toast.success(`Department updated: ${editingDepartmentName.trim()}`);
    setEditingDepartmentId(null);
    setEditingDepartmentName('');
    await queryClient.invalidateQueries({ queryKey: ['department-options'] });
  }, [editingDepartmentId, editingDepartmentName, orgId, queryClient]);

  const deactivateDepartment = useCallback(async (departmentId: string, departmentName: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(`Deactivate department "${departmentName}"?`);
    if (!confirmed) return;
    const { error: updateError } = await supabase
      .from('departments')
      .update({ active: false })
      .eq('id', departmentId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to deactivate department: ${updateError.message}`);
      return;
    }
    toast.success(`Department deactivated: ${departmentName}`);
    await queryClient.invalidateQueries({ queryKey: ['department-options'] });
  }, [orgId, queryClient]);

  const addRole = useCallback(async () => {
    if (!supabase || !orgId || !newRoleName.trim()) return;
    const { error: insertError } = await supabase.from('workforce_roles').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      name: newRoleName.trim(),
      active: true,
    });
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add role: ${insertError.message}`);
      return;
    }
    toast.success(`Role added: ${newRoleName.trim()}`);
    setNewRoleName('');
    await queryClient.invalidateQueries({ queryKey: ['role-options'] });
  }, [newRoleName, orgId, queryClient]);

  const saveRoleEdit = useCallback(async () => {
    if (!supabase || !orgId || !editingRoleId || !editingRoleName.trim()) return;
    const { error: updateError } = await supabase
      .from('workforce_roles')
      .update({ name: editingRoleName.trim() })
      .eq('id', editingRoleId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update role: ${updateError.message}`);
      return;
    }
    toast.success(`Role updated: ${editingRoleName.trim()}`);
    setEditingRoleId(null);
    setEditingRoleName('');
    await queryClient.invalidateQueries({ queryKey: ['role-options'] });
  }, [editingRoleId, editingRoleName, orgId, queryClient]);

  const deactivateRole = useCallback(async (roleId: string, roleName: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(`Deactivate role "${roleName}"?`);
    if (!confirmed) return;
    const { error: updateError } = await supabase
      .from('workforce_roles')
      .update({ active: false })
      .eq('id', roleId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to deactivate role: ${updateError.message}`);
      return;
    }
    toast.success(`Role deactivated: ${roleName}`);
    await queryClient.invalidateQueries({ queryKey: ['role-options'] });
  }, [orgId, queryClient]);

  const addWorkerType = useCallback(async () => {
    if (!supabase || !orgId || !newWorkerTypeName.trim()) return;
    const { error: insertError } = await supabase.from('worker_types').insert({
      org_id: orgId,
      name: newWorkerTypeName.trim(),
      active: true,
    });
    if (insertError) {
      toast.error(`Failed to add worker type: ${insertError.message}`);
      return;
    }
    setNewWorkerTypeName('');
    toast.success('Worker type added');
    await queryClient.invalidateQueries({ queryKey: ['worker-types'] });
  }, [newWorkerTypeName, orgId, queryClient]);

  const saveWorkerTypeEdit = useCallback(async () => {
    if (!supabase || !orgId || !editingWorkerTypeId || !editingWorkerTypeName.trim()) return;
    const { error: updateError } = await supabase
      .from('worker_types')
      .update({ name: editingWorkerTypeName.trim() })
      .eq('id', editingWorkerTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error(`Failed to update worker type: ${updateError.message}`);
      return;
    }
    setEditingWorkerTypeId(null);
    setEditingWorkerTypeName('');
    toast.success('Worker type updated');
    await queryClient.invalidateQueries({ queryKey: ['worker-types'] });
  }, [editingWorkerTypeId, editingWorkerTypeName, orgId, queryClient]);

  const deactivateWorkerType = useCallback(async (workerTypeId: string, workerTypeName: string) => {
    if (!supabase || !orgId) return;
    if (!window.confirm(`Deactivate worker type "${workerTypeName}"?`)) return;
    const { error: updateError } = await supabase
      .from('worker_types')
      .update({ active: false })
      .eq('id', workerTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error(`Failed to deactivate worker type: ${updateError.message}`);
      return;
    }
    toast.success('Worker type deactivated');
    await queryClient.invalidateQueries({ queryKey: ['worker-types'] });
  }, [orgId, queryClient]);

  if (!orgId || loading) return <PageSkeleton />;
  if (error) return <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchWorkforceSummary()} />;

  return (
    <div className="space-y-4">
      <SettingsCard title="Departments" subtitle="Organize your crew by department for scheduling and reporting.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {departments.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No active departments yet.</p>
          ) : (
            departments.map((department) => (
              <div key={department.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingDepartmentId === department.id ? (
                  <>
                    <input className={`${settingsInputClass} flex-1`} value={editingDepartmentName} onChange={(event) => setEditingDepartmentName(event.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveDepartmentEdit()}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => { setEditingDepartmentId(null); setEditingDepartmentName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{department.name}</span>
                    <span className="rounded-full bg-status-active/10 px-2.5 py-1 text-xs text-status-active">Active</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingDepartmentId(department.id); setEditingDepartmentName(department.name); }} aria-label={`Edit ${department.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivateDepartment(department.id, department.name)} aria-label={`Deactivate ${department.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input className={settingsInputClass} value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} placeholder="Add department" />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addDepartment()}>Add</button>
        </div>
      </SettingsCard>

      <SettingsCard title="Roles" subtitle="Define position labels used across the platform.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {roles.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No active roles yet.</p>
          ) : (
            roles.map((role) => (
              <div key={role.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingRoleId === role.id ? (
                  <>
                    <input className={`${settingsInputClass} flex-1`} value={editingRoleName} onChange={(event) => setEditingRoleName(event.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveRoleEdit()}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => { setEditingRoleId(null); setEditingRoleName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{role.name}</span>
                    <span className="rounded-full bg-status-active/10 px-2.5 py-1 text-xs text-status-active">Active</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingRoleId(role.id); setEditingRoleName(role.name); }} aria-label={`Edit ${role.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivateRole(role.id, role.name)} aria-label={`Deactivate ${role.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input className={settingsInputClass} value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Add role" />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addRole()}>Add</button>
        </div>
      </SettingsCard>

      <SettingsCard title="Worker Types" subtitle="Classify team members for scheduling and reporting.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {workerTypes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No active worker types yet.</p>
          ) : (
            workerTypes.map((workerType) => (
              <div key={workerType.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingWorkerTypeId === workerType.id ? (
                  <>
                    <input className={settingsInputClass} value={editingWorkerTypeName} onChange={(event) => setEditingWorkerTypeName(event.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveWorkerTypeEdit()}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => setEditingWorkerTypeId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{workerType.name}</span>
                    <span className="rounded-full bg-status-active/10 px-2.5 py-1 text-xs text-status-active">Active</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingWorkerTypeId(workerType.id); setEditingWorkerTypeName(workerType.name); }} aria-label={`Edit ${workerType.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivateWorkerType(workerType.id, workerType.name)} aria-label={`Delete ${workerType.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input className={settingsInputClass} value={newWorkerTypeName} onChange={(event) => setNewWorkerTypeName(event.target.value)} placeholder="Add worker type" />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addWorkerType()}>Add</button>
        </div>
      </SettingsCard>

      <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3">
        <p className="text-sm text-text-muted">To change employee roles, go to the <span className="text-brand">Employees</span> page.</p>
      </div>
    </div>
  );
}

function AccessTab({
  userEmail,
  userRole,
  orgId,
  employeeName,
  userId,
  themePresetOverride,
  themeCustomColors,
  onSignOut,
}: {
  userEmail: string;
  userRole: string | null;
  orgId: string | null;
  employeeName: string;
  userId: string | null;
  themePresetOverride: string | null;
  themeCustomColors: CustomThemeColors | null;
  onSignOut: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const propertiesQuery = useProperties(orgId ?? undefined);
  const employeesQuery = useEmployees(undefined, orgId ?? undefined, 'all');
  const orgInfoQuery = useQuery({
    queryKey: ['organization-info', orgId ?? 'no-org'],
    queryFn: async () => {
      if (!supabase || !orgId) return null;
      const { data, error } = await withSettingsAbortControllerTimeout(
        supabase
          .from('organizations')
          .select('name, plan, subscription_status, created_at')
          .eq('id', orgId)
          .maybeSingle(),
      );
      if (error) throw error;
      return data as OrganizationInfo | null;
    },
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 30,
    retry: 3,
    retryDelay: 1000,
  });
  const programSettingsQuery = useProgramSettings(orgId ?? undefined);
  const organizationName = orgInfoQuery.data?.name ?? '';
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Manager' | 'Field Staff'>('Manager');
  const [systemInfo, setSystemInfo] = useState({
    propertyCount: 0,
    employeeCount: 0,
    taskCount: 0,
    scheduleEntriesThisWeek: 0,
    assignmentsToday: 0,
    equipmentUnits: 0,
  });
  const [appUsers, setAppUsers] = useState<AppUserRow[]>([]);
  const [personalThemeOverride, setPersonalThemeOverride] = useState<string | null>(themePresetOverride);
  const [savingPersonalColorThemeId, setSavingPersonalColorThemeId] = useState<string | null>(null);
  const [personalCustomOpen, setPersonalCustomOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizationName = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monday = new Date(now);
    const dayOfWeek = monday.getDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    monday.setDate(monday.getDate() - offsetToMonday);
    monday.setHours(0, 0, 0, 0);
    const weekStartKey = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekEndKey = sunday.toISOString().slice(0, 10);

    const [tasksCountResult, scheduleCountResult, assignmentsCountResult, equipmentCountResult, appUsersResult] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('schedule_entries')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('date', weekStartKey)
        .lte('date', weekEndKey),
      supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('date', todayKey),
      supabase.from('equipment_units').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('app_users')
        .select('id, employee_id, role, status')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
    ]);

    const fetchError =
      tasksCountResult.error ??
      scheduleCountResult.error ??
      assignmentsCountResult.error ??
      equipmentCountResult.error ??
      appUsersResult.error;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setSystemInfo({
      propertyCount: propertiesQuery.data?.length ?? 0,
      employeeCount: employeesQuery.data?.length ?? 0,
      taskCount: tasksCountResult.count ?? 0,
      scheduleEntriesThisWeek: scheduleCountResult.count ?? 0,
      assignmentsToday: assignmentsCountResult.count ?? 0,
      equipmentUnits: equipmentCountResult.count ?? 0,
    });
    setAppUsers((appUsersResult.data as AppUserRow[]) ?? []);
    setLoading(false);
  }, [employeesQuery.data?.length, orgId, propertiesQuery.data?.length]);

  useEffect(() => {
    if (!orgId) return;
    if (employeesQuery.isLoading || propertiesQuery.isLoading || orgInfoQuery.isLoading) return;
    void fetchOrganizationName();
  }, [employeesQuery.isLoading, fetchOrganizationName, orgId, orgInfoQuery.isLoading, propertiesQuery.isLoading]);

  useEffect(() => {
    setPersonalThemeOverride(themePresetOverride);
  }, [themePresetOverride]);

  const handleSignOut = async () => {
    let redirectedByFallback = false;
    const fallbackTimeoutId = window.setTimeout(() => {
      redirectedByFallback = true;
      window.location.assign('/');
    }, 5_000);

    try {
      queryClient.clear();
      window.localStorage.removeItem('ground-crew-query-cache-v3');
      window.localStorage.removeItem('ground-crew-query-cache-v2');
      window.localStorage.removeItem('ground-crew-query-cache');
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith('ground-crew-query-cache')) {
          window.localStorage.removeItem(key);
        }
      });
      await onSignOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      window.clearTimeout(fallbackTimeoutId);
      if (!redirectedByFallback) {
        window.location.assign('/');
      }
    }
  };

  const handleClearAppCache = () => {
    queryClient.clear();
    window.localStorage.removeItem('ground-crew-query-cache-v3');
    window.localStorage.removeItem('ground-crew-query-cache-v2');
    window.localStorage.removeItem('ground-crew-query-cache');
    window.location.reload();
  };

  const updateUserRole = async (userId: string, role: string) => {
    if (!orgId) return;
    const { error: updateError } = await supabase
      .from('app_users')
      .update({ role })
      .eq('id', userId)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error(`Unable to update role: ${updateError.message}`);
      return;
    }
    setAppUsers((current) => current.map((user) => (user.id === userId ? { ...user, role } : user)));
    toast.success('User role updated');
  };

  const savePersonalColorTheme = async (themeId: string | null) => {
    if (!supabase || !orgId || !userId) {
      toast.error('User context is unavailable.');
      return;
    }
    const savingId = themeId ?? ORG_DEFAULT_THEME_OPTION_ID;
    setSavingPersonalColorThemeId(savingId);
    try {
      const { error: updateError } = await supabase
        .from('app_users')
        .update({ theme_preset_override: themeId })
        .eq('id', userId)
        .eq('org_id', orgId);
      if (updateError) {
        toast.error('Unable to update your color scheme: ' + updateError.message);
        return;
      }
      setPersonalThemeOverride(themeId);
      const selectedTheme = themeId ? COLOR_THEMES.find((theme) => theme.id === themeId) ?? null : null;
      applyColorThemeToDocument(selectedTheme, programSettingsQuery.data);
      toast.success(themeId ? 'Personal color scheme updated' : 'Using organization color scheme');
    } finally {
      setSavingPersonalColorThemeId(null);
    }
  };

  const savePersonalCustomColors = async (colors: CustomThemeColors) => {
    if (!supabase || !orgId || !userId) {
      toast.error('User context is unavailable.');
      return;
    }
    setSavingPersonalColorThemeId(CUSTOM_THEME_OPTION_ID);
    try {
      const { error: updateError } = await supabase
        .from('app_users')
        .update({ theme_preset_override: CUSTOM_THEME_OPTION_ID, theme_custom_colors: colors })
        .eq('id', userId)
        .eq('org_id', orgId);
      if (updateError) {
        toast.error('Unable to update your custom colors: ' + updateError.message);
        return;
      }
      setPersonalThemeOverride(CUSTOM_THEME_OPTION_ID);
      applyColorThemeToDocument(
        { id: 'custom', label: 'Custom', ...colors, cardColor: colors.primaryColor, fontThemePreset: programSettingsQuery.data?.fontThemePreset ?? 'modern-sans' },
        programSettingsQuery.data,
      );
    } finally {
      setSavingPersonalColorThemeId(null);
    }
  };

  const maskedOrgId = orgId ? orgId.slice(0, 8) + '...' : 'Not available';
  const browserInfo = typeof navigator !== 'undefined'
    ? `${navigator.userAgent.slice(0, 50)}${navigator.userAgent.length > 50 ? '...' : ''}`
    : 'Not available';

  const handleCopySystemInfo = async () => {
    const lines = [
      'Ground Crew HQ — System Info',
      `App Version: ${APP_VERSION}`,
      `Org ID: ${maskedOrgId}`,
      `Property Count: ${systemInfo.propertyCount}`,
      `Employee Count: ${systemInfo.employeeCount}`,
      `Task Count: ${systemInfo.taskCount}`,
      `Schedule Entries (this week): ${systemInfo.scheduleEntriesThisWeek}`,
      `Assignments (today): ${systemInfo.assignmentsToday}`,
      `Equipment Units: ${systemInfo.equipmentUnits}`,
      `Browser: ${browserInfo}`,
      'Supabase Project: fjqeekwisnbpxgebrnpl',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('System info copied to clipboard');
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : 'Clipboard unavailable';
      toast.error(`Failed to copy system info: ${message}`);
    }
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('Manager');
  };

  const handleSendInvite = () => {
    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.error('Enter a valid email address.');
      return;
    }
    const inviterName = employeeName || userEmail || 'A teammate';
    const orgName = organizationName || 'your organization';
    const subject = "You've been invited to Ground Crew HQ";
    const body = `Hi,

${inviterName} has invited you to join ${orgName} on Ground Crew HQ,
the operations platform for grounds and facilities teams.

Sign up here: https://ground-crew-hq.vercel.app

Your organization: ${orgName}
Your role: ${inviteRole}

— Ground Crew HQ`;
    window.location.href = `mailto:${encodeURIComponent(trimmedEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success('Invite email opened in your mail app.');
    closeInviteModal();
  };

  if (!orgId || loading) return <PageSkeleton />;

  if (error) {
    return (
      <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchOrganizationName()} />
    );
  }

  return (
    <div className="space-y-4">
      <SettingsCard title="User Access" subtitle="Manage workspace roles without leaving Settings.">
        {appUsers.length === 0 ? (
          <p className="text-sm text-text-muted">No application users found for this organization.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            {appUsers.map((appUser) => {
              const employee = employeesQuery.data?.find((item) => item.id === appUser.employee_id);
              const roleClass =
                appUser.role.toLowerCase() === 'admin'
                  ? 'bg-brand-ghost text-brand'
                  : appUser.role.toLowerCase() === 'manager'
                    ? 'bg-status-complete/10 text-status-complete'
                    : 'bg-surface-elevated text-text-muted';
              return (
                <div
                  key={appUser.id}
                  className="grid gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover sm:grid-cols-[1fr_auto_auto_180px] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown employee'}
                    </p>
                    <p className="text-xs text-text-muted">{employee?.email ?? 'No email available'}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${roleClass}`}>
                    {appUser.role}
                  </span>
                  <span className="w-fit rounded-full bg-status-active/10 px-2.5 py-1 text-xs font-medium text-status-active">
                    {appUser.status}
                  </span>
                  <select
                    className={settingsInputClass}
                    value={appUser.role}
                    onChange={(event) => void updateUserRole(appUser.id, event.target.value)}
                    aria-label={`Change role for ${employee?.firstName ?? 'user'}`}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Field Staff">Field Staff</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Your Account">
        <div className="space-y-2">
          {[
            { label: 'Email', value: userEmail || 'Not available' },
            { label: 'Role', value: userRole ?? 'Not available' },
            { label: 'Employee', value: employeeName || 'Not available' },
            { label: 'Organization', value: organizationName || 'Not available' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 text-text-muted">{label}</span>
              <span className="text-text-primary">{value}</span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Color Scheme" subtitle="Choose a personal color preset, pick Custom, or inherit the organization default.">
        <ColorThemeSwatchGrid
          activeThemeId={personalThemeOverride}
          disabled={Boolean(savingPersonalColorThemeId)}
          savingThemeId={savingPersonalColorThemeId}
          defaultOption={{
            active: personalThemeOverride === null,
            label: 'Use org default',
            description: getProgramSettingsThemeId(programSettingsQuery.data)
              ? 'Currently ' + (getColorThemeLabel(getProgramSettingsThemeId(programSettingsQuery.data)) ?? 'workspace colors')
              : 'Inherit workspace colors',
            onSelect: () => { setPersonalCustomOpen(false); return savePersonalColorTheme(null); },
          }}
          onSelectTheme={(colorTheme) => { setPersonalCustomOpen(false); return savePersonalColorTheme(colorTheme.id); }}
        />
        {(() => {
          const personalCustomActive = personalThemeOverride === CUSTOM_THEME_OPTION_ID;
          const personalCustomValue: CustomThemeColors = themeCustomColors ?? {
            primaryColor: programSettingsQuery.data?.primaryColor ?? '#2FA866',
            accentColor: programSettingsQuery.data?.accentColor ?? '#16a34a',
            sidebarColor: programSettingsQuery.data?.sidebarColor ?? '#0f172a',
          };
          return (
            <div className="mt-2">
              <CustomColorTile
                active={personalCustomActive}
                saving={savingPersonalColorThemeId === CUSTOM_THEME_OPTION_ID}
                disabled={Boolean(savingPersonalColorThemeId)}
                onSelect={() => setPersonalCustomOpen((open) => (!open || !personalCustomActive ? true : false))}
              />
              {personalCustomOpen || personalCustomActive ? (
                <CustomColorInputs
                  value={personalCustomValue}
                  saving={savingPersonalColorThemeId === CUSTOM_THEME_OPTION_ID}
                  onChange={(next) => { void savePersonalCustomColors(next); }}
                />
              ) : null}
            </div>
          );
        })()}
      </SettingsCard>

      <SettingsCard title="Session Management">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleSignOut()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
          >
            Sign Out
          </button>
          <button
            onClick={handleClearAppCache}
            className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
          >
            Clear App Cache
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Team Invitations" subtitle="Invite managers and crew members by email link.">
        <button
          onClick={() => setShowInviteModal(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
        >
          <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Invite Team</span>
        </button>
      </SettingsCard>

      <SettingsCard title="Workspace Status">
        <div className="space-y-2 text-sm">
          <p className="text-text-muted"><span className="font-medium text-text-primary">Current workspace:</span> Ground Crew HQ</p>
          <p className="text-text-muted"><span className="font-medium text-text-primary">Plan/status:</span> Active workspace</p>
          <p className="text-text-muted">Billing controls appear when workspace billing is enabled.</p>
        </div>
      </SettingsCard>

      <SettingsCard title="Billing">
        <p className="text-sm text-text-muted">Billing management is currently unavailable in-product.</p>
      </SettingsCard>

      <section className="rounded-xl border border-status-warning/30 bg-surface-elevated p-5">
        <h2 className="mb-2 text-base font-semibold text-status-warning">Danger Zone</h2>
        <p className="text-sm text-status-warning/80">
          To delete your account or change your email, contact support at support@groundcrewhq.com.
        </p>
      </section>

      <SettingsCard title="System">
        <div className="grid gap-1.5 text-sm">
          {[
            ['App Version', APP_VERSION],
            ['Org ID', maskedOrgId],
            ['Properties', String(systemInfo.propertyCount)],
            ['Employees', String(systemInfo.employeeCount)],
            ['Tasks', String(systemInfo.taskCount)],
            ['Schedule entries (this week)', String(systemInfo.scheduleEntriesThisWeek)],
            ['Assignments (today)', String(systemInfo.assignmentsToday)],
            ['Equipment units', String(systemInfo.equipmentUnits)],
            ['Browser', browserInfo],
            ['Supabase project', 'fjqeekwisnbpxgebrnpl'],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="w-44 shrink-0 text-text-muted">{label}</span>
              <span className="truncate text-text-primary">{value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => void handleCopySystemInfo()}
          className="mt-4 rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
        >
          Copy System Info
        </button>
      </SettingsCard>

      {showInviteModal ? (
        <div
          onClick={closeInviteModal}
          className="fixed inset-0 z-60 grid place-items-center bg-surface-base/80 p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="z-70 grid w-full max-w-md gap-4 rounded-xl border border-surface-border bg-surface-card p-5"
          >
            <h3 className="text-base font-semibold text-text-primary">Invite a team member</h3>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Email</span>
              <input className={settingsInputClass} type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Role</span>
              <select className={settingsInputClass} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'Manager' | 'Field Staff')}>
                <option value="Manager">Manager</option>
                <option value="Field Staff">Field Staff</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={closeInviteModal} className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover">Cancel</button>
              <button onClick={handleSendInvite} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright">Send Invite</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HelpTab() {
  const helpCards = [
    {
      icon: CircleHelp,
      title: 'Documentation',
      description: 'Review setup guidance and operating workflows for every Ground Crew HQ module.',
      action: 'Open docs',
      href: 'https://docs.groundcrewhq.com',
    },
    {
      icon: Mail,
      title: 'Support',
      description: 'Send the support team a concise description of the issue and the affected workspace.',
      action: 'Email support',
      href: 'mailto:support@groundcrewhq.com',
    },
    {
      icon: Wrench,
      title: 'Keyboard Shortcuts',
      description: 'Use Tab to move between controls, Enter to activate actions, and Escape to close panels.',
      action: null,
      href: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {helpCards.map(({ icon: Icon, title, description, action, href }) => (
        <section key={title} className="rounded-xl border border-surface-border bg-surface-card p-5">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-ghost text-brand">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-2 text-sm text-text-muted">{description}</p>
          {action && href ? (
            <a className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-bright" href={href}>
              {action}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function TasksTab({ orgId: _orgIdProp, propertyId }: { orgId: string | null; propertyId: string | null }) {
  const { orgId } = useOrgProfile();
  const queryClient = useQueryClient();
  const employeesQuery = useEmployees(undefined, orgId ?? undefined, 'all');
  const propertiesQuery = useProperties(orgId ?? undefined);
  const properties = propertiesQuery.data ?? [];
  const { data: rawTasks = [], isLoading: tasksLoading } = useTasks(undefined, orgId ?? undefined);
  const {
    data: categoriesData = [],
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery<TaskCategoryItem[]>({
    queryKey: ['task-categories', orgId],
    queryFn: async () => {
      if (!supabase || !orgId) return [];
      const { data, error } = await withSettingsAbortControllerTimeout(
        supabase
          .from('task_categories')
          .select('id, name, sort_order')
          .eq('org_id', orgId)
          .order('sort_order', { ascending: true }),
      );
      if (error) throw error;
      return (data ?? []) as TaskCategoryItem[];
    },
    enabled: Boolean(orgId),
  });
  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const taskCategories = categoriesData;
  const taskCategoryNames = taskCategories.map((category) => category.name);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const invalidateTaskCategories = async () => {
    await queryClient.invalidateQueries({ queryKey: ['task-categories', orgId] });
  };

  const commitCategoryRename = async (category: TaskCategoryItem) => {
    if (!supabase || !orgId) return;
    const trimmed = editingCategoryValue.trim();
    if (!trimmed) return;
    const { error: tasksUpdateError } = await supabase
      .from('tasks')
      .update({ category: trimmed })
      .eq('category', category.name)
      .eq('org_id', orgId);
    if (tasksUpdateError) {
      toast.error(`Failed to update tasks for category: ${tasksUpdateError.message}`);
      return;
    }
    const { error: categoryUpdateError } = await supabase
      .from('task_categories')
      .update({ name: trimmed })
      .eq('id', category.id)
      .eq('org_id', orgId);
    if (categoryUpdateError) {
      toast.error(`Failed to rename category: ${categoryUpdateError.message}`);
      return;
    }
    await invalidateTaskCategories();
    await queryClient.invalidateQueries({ queryKey: ['tasks', orgId] });
    setEditingCategoryId(null);
    setEditingCategoryValue('');
    toast.success(`Category renamed: ${trimmed}`);
  };

  const commitDeleteCategory = async (category: TaskCategoryItem, taskCount: number) => {
    if (!supabase || !orgId) return;
    if (taskCount > 0) {
      const { error: tasksUpdateError } = await supabase
        .from('tasks')
        .update({ category: 'General' })
        .eq('category', category.name)
        .eq('org_id', orgId);
      if (tasksUpdateError) {
        toast.error(`Failed to reassign tasks: ${tasksUpdateError.message}`);
        return;
      }
    }
    const { error: deleteError } = await supabase
      .from('task_categories')
      .delete()
      .eq('id', category.id)
      .eq('org_id', orgId);
    if (deleteError) {
      toast.error(`Failed to delete category: ${deleteError.message}`);
      return;
    }
    await invalidateTaskCategories();
    await queryClient.invalidateQueries({ queryKey: ['tasks', orgId] });
    setDeletingCategoryId(null);
    toast.success(`Category deleted: ${category.name}`);
  };

  const commitAddCategory = async () => {
    if (!supabase || !orgId) return;
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    const { error: insertError } = await supabase.from('task_categories').insert({
      org_id: orgId,
      name: trimmed,
      sort_order: taskCategories.length,
    });
    if (insertError) {
      toast.error(`Failed to add category: ${insertError.message}`);
      return;
    }
    await invalidateTaskCategories();
    setShowAddCategory(false);
    setNewCategoryInput('');
    toast.success(`Category added: ${trimmed}`);
  };

  const displayCategory = (category: string | null | undefined) =>
    category === 'General' ? 'General Maintenance' : category ?? 'General Maintenance';
  const tasks = useMemo<TaskLibraryItem[]>(
    () =>
      rawTasks.map((t) => ({
        id: t.id,
        org_id: orgId ?? '',
        property_id: null,
        name: t.name,
        category: t.category ?? null,
        priority: t.priority ?? null,
        estimated_hours: (t.duration ?? 0) / 60,
      })),
    [rawTasks, orgId],
  );
  const tasksByCategory = useMemo(() => {
    const grouped = new Map<string, TaskLibraryItem[]>();
    taskCategories.forEach((category) => grouped.set(category.name, []));
    const uncategorized: TaskLibraryItem[] = [];
    tasks.forEach((task) => {
      const categoryName = task.category?.trim();
      if (categoryName && grouped.has(categoryName)) {
        grouped.get(categoryName)?.push(task);
        return;
      }
      uncategorized.push(task);
    });
    const sortTasks = (left: TaskLibraryItem, right: TaskLibraryItem) =>
      (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name);
    grouped.forEach((categoryTasks) => categoryTasks.sort(sortTasks));
    uncategorized.sort(sortTasks);
    return { grouped, uncategorized };
  }, [taskCategories, tasks]);
  const employees = useMemo(
    () =>
      (employeesQuery.data ?? [])
        .filter((employee) => employee.active)
        .map(({ id, firstName, lastName, status }) => ({ id, first_name: firstName, last_name: lastName, status }))
        .sort((left, right) => left.last_name.localeCompare(right.last_name)),
    [employeesQuery.data],
  );
  const [recurringRules, setRecurringRules] = useState<RecurringTaskRule[]>([]);
  const [recurringDrafts, setRecurringDrafts] = useState<Record<string, { enabled: boolean; days: string[]; assignMode: 'all' | 'specific'; employeeId: string }>>({});
  const [showTimeout, setShowTimeout] = useState(false);
  const [recurringRulesError, setRecurringRulesError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newPriority, setNewPriority] = useState<'1' | '2' | '3'>('2');
  const [newEstimatedHours, setNewEstimatedHours] = useState('1');
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    name: '',
    category: '',
    priority: 2,
    estimated_hours: 0,
  });
  const [savingRecurringTaskId, setSavingRecurringTaskId] = useState<string | null>(null);
  const signalTaskLibraryUpdate = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ground-crew-task-library-updated-at', String(Date.now()));
  };

  const resetNewTaskForm = () => {
    setNewName('');
    setNewCategory('General');
    setNewPriority('2');
    setNewEstimatedHours('1');
  };

  const closeAddTaskDialog = () => {
    setAddTaskDialogOpen(false);
    resetNewTaskForm();
  };

  const dayOptions = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' },
  ] as const;

  const fetchTasks = useCallback(async () => {
    if (!supabase || !orgId) {
      return;
    }
    setRecurringRulesError(null);
    const recurringResult = await supabase
      .from('recurring_task_rules')
      .select('id, org_id, property_id, task_id, employee_id, days_of_week, active')
      .eq('org_id', orgId)
      .eq('active', true);
    if (recurringResult.error) {
      setRecurringRulesError(recurringResult.error.message ?? 'Failed to load recurring task settings');
      return;
    }
    setRecurringRules((recurringResult.data as RecurringTaskRule[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    if (employeesQuery.isLoading) return;
    void fetchTasks();
  }, [employeesQuery.isLoading, fetchTasks]);

  const hasTaskLibraryResult = !tasksLoading || tasks.length > 0;

  useEffect(() => {
    if (hasTaskLibraryResult) {
      setShowTimeout(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowTimeout(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [hasTaskLibraryResult]);

  useEffect(() => {
    const byTask = new Map<string, RecurringTaskRule>();
    for (const rule of recurringRules) {
      if (!byTask.has(rule.task_id)) byTask.set(rule.task_id, rule);
    }
    setRecurringDrafts(
      tasks.reduce<Record<string, { enabled: boolean; days: string[]; assignMode: 'all' | 'specific'; employeeId: string }>>((acc, task) => {
        const rule = byTask.get(task.id);
        acc[task.id] = {
          enabled: Boolean(rule),
          days: rule?.days_of_week?.length ? rule.days_of_week : ['mon', 'tue', 'wed', 'thu', 'fri'],
          assignMode: rule?.employee_id ? 'specific' : 'all',
          employeeId: rule?.employee_id ?? '',
        };
        return acc;
      }, {}),
    );
  }, [tasks, recurringRules]);

  const addTask = async () => {
    if (!supabase || !orgId || !newName.trim()) return;
    if (!properties[0]?.id) {
      toast.error('Add a property in Settings before creating tasks');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        org_id: orgId,
        property_id: properties[0]?.id ?? null,
        name: newName.trim(),
        category: newCategory.trim() || 'General',
        priority: Number(newPriority),
        estimated_hours: Number(newEstimatedHours || '0'),
        status: 'active',
      })
      .select('id, org_id, property_id, name, category, priority, estimated_hours')
      .single();

    if (insertError) {
      toast.error(`Failed to add task: ${insertError.message}`);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['tasks', orgId ?? undefined] });
    resetNewTaskForm();
    setAddTaskDialogOpen(false);
    setTaskPanelOpen(false);
    signalTaskLibraryUpdate();
    toast.success(`Task added: ${newName.trim()}`);
  };

  const removeTask = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm('Delete this task from the library?');
    if (!confirmed) return;
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId).eq('org_id', orgId);
    if (deleteError) {
      toast.error(`Failed to delete task: ${deleteError.message}`);
      return;
    }
    const deletedTaskName = tasks.find((task) => task.id === taskId)?.name ?? 'Task';
    void queryClient.invalidateQueries({ queryKey: ['tasks', orgId ?? undefined] });
    signalTaskLibraryUpdate();
    toast.success(`Task deleted: ${deletedTaskName}`);
  };

  const startEditTask = (task: TaskLibraryItem) => {
    setEditingTaskId(task.id);
    setEditDraft({
      name: task.name,
      category: task.category ?? 'General',
      priority: task.priority ?? 2,
      estimated_hours: Number(task.estimated_hours ?? 0),
    });
    setTaskPanelOpen(true);
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditDraft({ name: '', category: '', priority: 2, estimated_hours: 0 });
    setTaskPanelOpen(false);
  };

  const saveEditTask = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        name: editDraft.name.trim(),
        category: editDraft.category.trim() || 'General',
        priority: editDraft.priority,
        estimated_hours: editDraft.estimated_hours,
      })
      .eq('id', taskId)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error(`Failed to update task: ${updateError.message}`);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['tasks', orgId ?? undefined] });
    signalTaskLibraryUpdate();
    toast.success(`Task updated: ${editDraft.name.trim()}`);
    cancelEditTask();
  };

  const handleTaskDragEnd = async ({ active, over }: DragEndEvent, categoryTasks: TaskLibraryItem[]) => {
    if (!supabase || !orgId || !over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = categoryTasks.findIndex((task) => task.id === activeId);
    const newIndex = categoryTasks.findIndex((task) => task.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(categoryTasks, oldIndex, newIndex).map((task, index) => ({
      ...task,
      priority: index + 1,
    }));
    const results = await Promise.all(
      reordered.map((task) =>
        supabase
          .from('tasks')
          .update({ priority: task.priority })
          .eq('id', task.id)
          .eq('org_id', orgId),
      ),
    );
    const updateError = results.find((result) => result.error)?.error;
    if (updateError) {
      toast.error(`Unable to save task order: ${updateError.message}`);
      void queryClient.invalidateQueries({ queryKey: ['tasks', orgId ?? undefined] });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['tasks', orgId ?? undefined] });
    signalTaskLibraryUpdate();
    toast.success('Task priority order saved');
  };

  const handleCategoryDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!supabase || !orgId || !over || active.id === over.id) return;
    const oldIndex = taskCategories.findIndex((category) => category.id === String(active.id));
    const newIndex = taskCategories.findIndex((category) => category.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(taskCategories, oldIndex, newIndex);
    const results = await Promise.all(
      reordered.map((category, index) =>
        supabase
          .from('task_categories')
          .update({ sort_order: index })
          .eq('id', category.id)
          .eq('org_id', orgId),
      ),
    );
    const updateError = results.find((result) => result.error)?.error;
    if (updateError) {
      toast.error(`Unable to save category order: ${updateError.message}`);
      void invalidateTaskCategories();
      return;
    }
    void invalidateTaskCategories();
    toast.success('Category order saved');
  };

  const renderTaskRow = (task: TaskLibraryItem) => (
    <SortableTaskRowCompact key={task.id} id={task.id}>
      <span className="flex-1 truncate pr-1 text-sm font-medium text-text-primary">{task.name}</span>
      <span className="shrink-0 text-xs text-text-muted">
        {Number(task.estimated_hours ?? 0).toFixed(1)}h
      </span>
      {recurringDrafts[task.id]?.enabled ? (
        <span className="shrink-0 rounded-full bg-status-active/10 px-1.5 py-0.5 text-xs text-status-active">Rec</span>
      ) : null}
      <button
        type="button"
        onClick={() => startEditTask(task)}
        className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
        aria-label={`Edit ${task.name}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void removeTask(task.id)}
        className="mr-2 shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-status-warning/10 hover:text-status-warning"
        aria-label={`Delete ${task.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </SortableTaskRowCompact>
  );

  const renderCategoryTaskList = (categoryTasks: TaskLibraryItem[], emptyMessage: string) => (
    <DndContext
      sensors={taskSensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => handleTaskDragEnd(event, categoryTasks)}
    >
      <SortableContext items={categoryTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {categoryTasks.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">{emptyMessage}</p>
        ) : (
          categoryTasks.map((task) => renderTaskRow(task))
        )}
      </SortableContext>
    </DndContext>
  );
  const setRecurringEnabled = (taskId: string, enabled: boolean) => {
    setRecurringDrafts((current) => ({
      ...current,
      [taskId]: {
        enabled,
        days: current[taskId]?.days?.length ? current[taskId].days : ['mon', 'tue', 'wed', 'thu', 'fri'],
        assignMode: current[taskId]?.assignMode ?? 'all',
        employeeId: current[taskId]?.employeeId ?? '',
      },
    }));
  };

  const toggleRecurringDay = (taskId: string, day: string) => {
    setRecurringDrafts((current) => {
      const draft = current[taskId] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], assignMode: 'all' as const, employeeId: '' };
      const has = draft.days.includes(day);
      const nextDays = has ? draft.days.filter((entry) => entry !== day) : [...draft.days, day];
      return {
        ...current,
        [taskId]: { ...draft, days: nextDays },
      };
    });
  };

  const saveRecurringRule = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const draft = recurringDrafts[taskId];
    if (!draft) return;
    setSavingRecurringTaskId(taskId);

    const existingRuleIds = recurringRules.filter((rule) => rule.task_id === taskId && rule.active).map((rule) => rule.id);
    if (existingRuleIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('recurring_task_rules')
        .update({ active: false })
        .in('id', existingRuleIds)
        .eq('org_id', orgId);
      if (deactivateError) {
        setSavingRecurringTaskId(null);
        toast.error(`Failed to update recurring rule: ${deactivateError.message}`);
        return;
      }
    }

    if (!draft.enabled) {
      setSavingRecurringTaskId(null);
      toast.success('Recurring rule disabled');
      await fetchTasks();
      return;
    }

    if (!draft.days.length) {
      setSavingRecurringTaskId(null);
      toast.error('Select at least one day for recurring task.');
      return;
    }

    if (draft.assignMode === 'specific' && !draft.employeeId) {
      setSavingRecurringTaskId(null);
      toast.error('Select an employee for specific recurring assignment.');
      return;
    }

    const { error: insertError } = await supabase.from('recurring_task_rules').insert({
      org_id: orgId,
      property_id: propertyId,
      task_id: taskId,
      employee_id: draft.assignMode === 'specific' ? draft.employeeId : null,
      days_of_week: draft.days,
      active: true,
    });

    setSavingRecurringTaskId(null);
    if (insertError) {
      toast.error(`Failed to save recurring rule: ${insertError.message}`);
      return;
    }
    toast.success('Recurring rule saved');
    await fetchTasks();
  };

  if (tasksLoading && tasks.length === 0) {
    return (
      showTimeout && !hasTaskLibraryResult ? <LoadingTimeoutFallback /> : <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading task library...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Task Library"
        subtitle="Reusable tasks grouped by category. Drag categories to reorder groups; drag tasks within a group to set priority."
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setShowAddCategory((current) => !current); setNewCategoryInput(''); }}
            >
              <Plus className="h-4 w-4" />
              Add category
            </Button>
            <Button type="button" size="sm" onClick={() => setAddTaskDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          </div>
        }
        stickyHeader
      >
        {showAddCategory ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/40 bg-surface-elevated px-4 py-3">
            <input
              autoFocus
              className={`${settingsInputClass} max-w-xs`}
              placeholder="Category name"
              value={newCategoryInput}
              onChange={(event) => setNewCategoryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void commitAddCategory();
                if (event.key === 'Escape') setShowAddCategory(false);
              }}
            />
            <Button type="button" onClick={() => void commitAddCategory()} disabled={!newCategoryInput.trim()}>
              Add
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowAddCategory(false); setNewCategoryInput(''); }}>
              Cancel
            </Button>
          </div>
        ) : null}
        {tasksLoading && tasks.length === 0 ? (
          showTimeout && !hasTaskLibraryResult ? <LoadingTimeoutFallback /> : <div className="h-32 animate-pulse rounded-xl bg-surface-elevated" />
        ) : (
          <>
            {categoriesLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
            ) : categoriesError ? (
              <ErrorRetry
                message={`Failed to load task categories: ${categoriesError instanceof Error ? categoriesError.message : 'Unknown error'}`}
                onRetry={() => void invalidateTaskCategories()}
              />
            ) : (
              <div className="space-y-3">
                {taskCategories.length === 0 && tasksByCategory.uncategorized.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-surface-border px-4 py-3 text-sm text-text-muted">
                    No tasks or categories yet. Add a task or category to begin.
                  </p>
                ) : null}

                {taskCategories.length > 0 ? (
                  <DndContext sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                    <SortableContext items={taskCategories.map((category) => category.id)} strategy={rectSortingStrategy}>
                      <div className="space-y-3">
                        {taskCategories.map((category) => {
                          const categoryTasks = tasksByCategory.grouped.get(category.name) ?? [];
                          const taskCount = categoryTasks.length;
                          return (
                            <SortableTaskCategoryCard
                              key={category.id}
                              category={category}
                              taskCount={taskCount}
                              isEditing={editingCategoryId === category.id}
                              editValue={editingCategoryValue}
                              isConfirmDelete={deletingCategoryId === category.id}
                              onEditStart={() => {
                                setDeletingCategoryId(null);
                                setEditingCategoryId(category.id);
                                setEditingCategoryValue(category.name);
                              }}
                              onEditChange={setEditingCategoryValue}
                              onEditSave={() => void commitCategoryRename(category)}
                              onEditCancel={() => {
                                setEditingCategoryId(null);
                                setEditingCategoryValue('');
                              }}
                              onDeleteRequest={() => {
                                setEditingCategoryId(null);
                                setDeletingCategoryId(category.id);
                              }}
                              onDeleteConfirm={() => void commitDeleteCategory(category, taskCount)}
                              onDeleteCancel={() => setDeletingCategoryId(null)}
                            >
                              {renderCategoryTaskList(categoryTasks, `No tasks in ${displayCategory(category.name)} yet.`)}
                            </SortableTaskCategoryCard>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : null}

                {tasksByCategory.uncategorized.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-card">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          Uncategorized <span className="text-xs text-text-muted">- {tasksByCategory.uncategorized.length}</span>
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-surface-border bg-surface-base">
                      {renderCategoryTaskList(tasksByCategory.uncategorized, 'No uncategorized tasks.')}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

          </>
        )}
      </SettingsCard>

      <Dialog open={addTaskDialogOpen} onOpenChange={(open) => { if (open) setAddTaskDialogOpen(true); else closeAddTaskDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
            <DialogDescription className="sr-only">
              Add a reusable task to the task library
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Task name</span>
              <input
                className={settingsInputClass}
                placeholder="New task name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) void addTask(); }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Category</span>
              <select
                className={settingsInputClass}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {taskCategoryNames.map((categoryName) => <option key={`dialog-cat-${categoryName}`} value={categoryName}>{displayCategory(categoryName)}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Hours</span>
              <input
                type="number"
                step="0.25"
                min="0.25"
                className={settingsInputClass}
                placeholder="hrs"
                value={newEstimatedHours}
                onChange={(e) => setNewEstimatedHours(e.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAddTaskDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void addTask()} disabled={!newName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={taskPanelOpen} onOpenChange={(open) => (open ? setTaskPanelOpen(true) : cancelEditTask())}>
        <SheetContent className="overflow-y-auto border-surface-border bg-surface-elevated text-text-primary sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-text-primary">{editingTaskId ? 'Edit Task' : 'Add Task'}</SheetTitle>
            <SheetDescription className="text-text-muted">
              {editingTaskId ? 'Update task details and recurring schedule.' : 'Create a reusable task for workboard planning.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Task name</span>
              <input
                className={settingsInputClass}
                placeholder="Task name"
                value={editingTaskId ? editDraft.name : newName}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, name: event.target.value }))
                  : setNewName(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Category</span>
              <select
                className={settingsInputClass}
                value={editingTaskId ? editDraft.category : newCategory}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, category: event.target.value }))
                  : setNewCategory(event.target.value)}
              >
                {taskCategoryNames.map((category) => (
                  <option key={`new-task-category-${category}`} value={category}>{displayCategory(category)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Priority</span>
              <select
                className={settingsInputClass}
                value={editingTaskId ? String(editDraft.priority) : newPriority}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, priority: Number(event.target.value) }))
                  : setNewPriority(event.target.value as '1' | '2' | '3')}
              >
                <option value="1">1 (High)</option>
                <option value="2">2 (Med)</option>
                <option value="3">3 (Low)</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Est. hours</span>
              <input
                className={settingsInputClass}
                type="number"
                step="0.25"
                placeholder="Est. hours"
                value={editingTaskId ? String(editDraft.estimated_hours) : newEstimatedHours}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, estimated_hours: Number(event.target.value || '0') }))
                  : setNewEstimatedHours(event.target.value)}
              />
            </label>

            {editingTaskId ? (
              <div className="rounded-xl border border-surface-border bg-surface-base p-4">
                <p className="mb-3 text-sm font-medium text-text-primary">Recurring Schedule</p>
                {recurringRulesError ? (
                  <div className="mb-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
                    Recurring task settings could not load. Task editing is still available.
                    <button
                      type="button"
                      className="ml-2 underline hover:text-status-warning/80"
                      onClick={() => void fetchTasks()}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                <label className="flex cursor-pointer items-center gap-3 text-sm text-text-secondary">
                  <Switch
                    checked={Boolean(recurringDrafts[editingTaskId]?.enabled)}
                    onCheckedChange={(checked) => setRecurringEnabled(editingTaskId, checked)}
                  />
                  <span>{recurringDrafts[editingTaskId]?.enabled ? 'Enabled' : 'Disabled'}</span>
                </label>
                {recurringDrafts[editingTaskId]?.enabled ? (
                  <div className="mt-3 grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      {dayOptions.map((day) => (
                        <label key={`${editingTaskId}-${day.key}`} className="flex cursor-pointer items-center gap-1 text-xs text-text-secondary">
                          <input
                            type="checkbox"
                            checked={Boolean(recurringDrafts[editingTaskId]?.days.includes(day.key))}
                            onChange={() => toggleRecurringDay(editingTaskId, day.key)}
                            className="rounded"
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                    <select
                      className={settingsInputClass}
                      value={recurringDrafts[editingTaskId]?.assignMode ?? 'all'}
                      onChange={(event) =>
                        setRecurringDrafts((current) => ({
                          ...current,
                          [editingTaskId]: {
                            ...(current[editingTaskId] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], employeeId: '' }),
                            assignMode: event.target.value as 'all' | 'specific',
                          },
                        }))
                      }
                    >
                      <option value="all">All scheduled crew</option>
                      <option value="specific">Specific employee</option>
                    </select>
                    {recurringDrafts[editingTaskId]?.assignMode === 'specific' ? (
                      <select
                        className={settingsInputClass}
                        value={recurringDrafts[editingTaskId]?.employeeId ?? ''}
                        onChange={(event) =>
                          setRecurringDrafts((current) => ({
                            ...current,
                            [editingTaskId]: {
                              ...(current[editingTaskId] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], assignMode: 'specific' }),
                              employeeId: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                          <option key={`${editingTaskId}-${employee.id}`} value={employee.id}>
                            {employee.first_name} {employee.last_name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      onClick={() => void saveRecurringRule(editingTaskId)}
                      className="w-fit rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-60"
                      disabled={savingRecurringTaskId === editingTaskId}
                    >
                      {savingRecurringTaskId === editingTaskId ? 'Saving...' : 'Apply schedule'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              onClick={() => editingTaskId ? void saveEditTask(editingTaskId) : void addTask()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
            >
              {editingTaskId ? 'Save Changes' : 'Save Task'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SchedulerTab({ orgId }: { orgId: string | null }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [settings, setSettings] = useState<SchedulerSettings | null>(null);
  const [alertsConfig, setAlertsConfig] = useState<EscalationThresholds>(DEFAULT_ESCALATION_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [alertsSaved, setAlertsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('05:00');
  const [newEnd, setNewEnd] = useState('13:30');
  const [newDays, setNewDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);

  const dayOptions = [
    { key: 'mon', label: 'M' },
    { key: 'tue', label: 'T' },
    { key: 'wed', label: 'W' },
    { key: 'thu', label: 'T' },
    { key: 'fri', label: 'F' },
    { key: 'sat', label: 'S' },
    { key: 'sun', label: 'S' },
  ] as const;

  const normalizeAlertsConfig = (value: unknown): EscalationThresholds => {
    const raw = (value && typeof value === 'object' ? value : {}) as Partial<EscalationThresholds>;
    return {
      equipment_service_overdue_days: Number(raw.equipment_service_overdue_days ?? DEFAULT_ESCALATION_THRESHOLDS.equipment_service_overdue_days),
      shift_coverage_warning_pct: Number(raw.shift_coverage_warning_pct ?? DEFAULT_ESCALATION_THRESHOLDS.shift_coverage_warning_pct),
      wind_speed_spray_cutoff_mph: Number(raw.wind_speed_spray_cutoff_mph ?? DEFAULT_ESCALATION_THRESHOLDS.wind_speed_spray_cutoff_mph),
      rain_probability_spray_cutoff_pct: Number(raw.rain_probability_spray_cutoff_pct ?? DEFAULT_ESCALATION_THRESHOLDS.rain_probability_spray_cutoff_pct),
      heat_advisory_temp_f: Number(raw.heat_advisory_temp_f ?? DEFAULT_ESCALATION_THRESHOLDS.heat_advisory_temp_f),
    };
  };

  const fetchSettings = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!orgId) {
      setLoading(false);
      setError(null);
      setSettings(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('scheduler_settings').select('*').eq('org_id', orgId).single();
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const nextSettings = data as SchedulerSettings;
    setSettings(nextSettings);
    setAlertsConfig(normalizeAlertsConfig(nextSettings.escalation_config));
    setLoading(false);
  }, [orgId]);

  const fetchTemplates = useCallback(async () => {
    if (!supabase) {
      setTemplatesLoading(false);
      return;
    }
    if (!orgId) {
      setTemplatesLoading(false);
      setTemplatesError(null);
      setTemplates([]);
      return;
    }
    setTemplatesLoading(true);
    setTemplatesError(null);
    const { data, error: fetchError } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (fetchError) {
      setTemplatesError(fetchError.message);
      setTemplatesLoading(false);
      return;
    }
    setTemplates((data as ShiftTemplate[]) ?? []);
    setTemplatesLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchSettings();
  }, [fetchSettings, orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchTemplates();
  }, [fetchTemplates, orgId]);

  if (!orgId) return <PageSkeleton />;

  const toggleDayValue = (currentDays: string[], dayValue: string) =>
    currentDays.includes(dayValue) ? currentDays.filter((day) => day !== dayValue) : [...currentDays, dayValue];

  const saveSettings = async () => {
    if (!supabase || !orgId || !settings) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('scheduler_settings')
      .update({
        operational_day_start: settings.operational_day_start,
        operational_day_end: settings.operational_day_end,
        operational_days: settings.operational_days,
        min_shift_hours: settings.min_shift_hours,
        max_shift_hours: settings.max_shift_hours,
        overtime_threshold_hours: settings.overtime_threshold_hours,
      })
      .eq('org_id', orgId);
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      toast.error(`Failed to save scheduler settings: ${saveError.message}`);
      return;
    }
    setSaved(true);
    toast.success('Scheduler settings saved');
    window.setTimeout(() => setSaved(false), 2000);
  };

  const saveAlertsConfig = async () => {
    if (!supabase || !orgId) return;
    setAlertsSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('scheduler_settings')
      .update({
        escalation_config: {
          equipment_service_overdue_days: Number(alertsConfig.equipment_service_overdue_days),
          shift_coverage_warning_pct: Number(alertsConfig.shift_coverage_warning_pct),
          wind_speed_spray_cutoff_mph: Number(alertsConfig.wind_speed_spray_cutoff_mph),
          rain_probability_spray_cutoff_pct: Number(alertsConfig.rain_probability_spray_cutoff_pct),
          heat_advisory_temp_f: Number(alertsConfig.heat_advisory_temp_f),
        },
      })
      .eq('org_id', orgId);
    setAlertsSaving(false);
    if (saveError) {
      setError(saveError.message);
      toast.error(`Failed to save alert thresholds: ${saveError.message}`);
      return;
    }
    setAlertsSaved(true);
    toast.success('Alert thresholds saved');
    window.setTimeout(() => setAlertsSaved(false), 2000);
  };

  const deleteTemplate = async (templateId: string) => {
    if (!supabase || !orgId) return;
    const templateName = templates.find((template) => template.id === templateId)?.name ?? 'template';
    const { error: deleteError } = await supabase
      .from('shift_templates')
      .delete()
      .eq('id', templateId)
      .eq('org_id', orgId);
    if (deleteError) {
      setTemplatesError(deleteError.message);
      toast.error(`Failed to delete shift template: ${deleteError.message}`);
      return;
    }
    setTemplates((current) => current.filter((template) => template.id !== templateId));
    toast.success(`Shift template deleted: ${templateName}`);
  };

  const addTemplate = async () => {
    if (!supabase || !orgId || !newName.trim()) return;
    const { data, error: insertError } = await supabase
      .from('shift_templates')
      .insert({
        org_id: orgId,
        name: newName.trim(),
        start: newStart,
        end: newEnd,
        days: newDays,
        active: true,
      })
      .select()
      .single();
    if (insertError) {
      setTemplatesError(insertError.message);
      toast.error(`Failed to add shift template: ${insertError.message}`);
      return;
    }
    setTemplates((current) => [...current, data as ShiftTemplate]);
    toast.success(`Shift template added: ${newName.trim()}`);
    setNewName('');
    setNewStart('05:00');
    setNewEnd('13:30');
    setNewDays(['mon', 'tue', 'wed', 'thu', 'fri']);
  };

  const handleTemplateDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setTemplates((current) => {
      const oldIndex = current.findIndex((template) => template.id === active.id);
      const newIndex = current.findIndex((template) => template.id === over.id);
      return oldIndex >= 0 && newIndex >= 0 ? arrayMove(current, oldIndex, newIndex) : current;
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="text-base font-semibold text-text-primary">Operational Day</h3>
        <p className="mb-4 mt-1 text-sm text-text-muted">Define the standard operating window and active work days.</p>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchSettings()} />
        ) : settings ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="text-xs font-medium uppercase tracking-widest text-text-muted">
                <label htmlFor="settings-operational-day-start">Operations Start</label>
                <TimeInput
                  id="settings-operational-day-start"
                  value={settings.operational_day_start.slice(0, 5)}
                  onChange={(event) => setSettings((cur) => (cur ? { ...cur, operational_day_start: `${event.target.value}:00` } : cur))}
                  className={`${settingsInputClass} mt-1.5`}
                />
              </div>
              <div className="text-xs font-medium uppercase tracking-widest text-text-muted">
                <label htmlFor="settings-operational-day-end">Operations End</label>
                <TimeInput
                  id="settings-operational-day-end"
                  value={settings.operational_day_end.slice(0, 5)}
                  onChange={(event) => setSettings((cur) => (cur ? { ...cur, operational_day_end: `${event.target.value}:00` } : cur))}
                  className={`${settingsInputClass} mt-1.5`}
                />
              </div>
            </div>
            <div className="text-xs text-text-muted">
              Display window: {formatTime(settings.operational_day_start)}–{formatTime(settings.operational_day_end)}
            </div>

            <div>
              <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-text-muted">Active Days</span>
              <div className="flex flex-wrap gap-2">
                {dayOptions.map((day) => {
                  const active = settings.operational_days.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() =>
                        setSettings((cur) => (cur ? { ...cur, operational_days: toggleDayValue(cur.operational_days ?? [], day.key) } : cur))
                      }
                      className={`min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors ${
                        active
                          ? 'border-brand bg-brand-ghost text-brand'
                          : 'border-surface-border bg-surface-elevated text-text-muted hover:bg-surface-hover hover:text-text-primary'
                      }`}
                      aria-pressed={active}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Min Shift Hours
                <input className={`${settingsInputClass} mt-1.5`} type="number" value={settings.min_shift_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, min_shift_hours: Number(event.target.value) } : cur))} />
              </label>
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Max Shift Hours
                <input className={`${settingsInputClass} mt-1.5`} type="number" value={settings.max_shift_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, max_shift_hours: Number(event.target.value) } : cur))} />
              </label>
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Overtime Threshold
                <input className={`${settingsInputClass} mt-1.5`} type="number" value={settings.overtime_threshold_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, overtime_threshold_hours: Number(event.target.value) } : cur))} />
              </label>
            </div>

            <button
              onClick={() => void saveSettings()}
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-bright disabled:opacity-60"
            >
              {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="text-base font-semibold text-text-primary">Shift Templates</h3>
        <p className="mb-4 mt-1 text-sm text-text-muted">Drag templates to arrange the order shown to schedulers.</p>
        {templatesLoading ? (
          <PageSkeleton />
        ) : templatesError ? (
          <ErrorRetry message={`Failed to load: ${templatesError}`} onRetry={() => void fetchTemplates()} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTemplateDragEnd}>
            <SortableContext items={templates.map((template) => template.id)} strategy={verticalListSortingStrategy}>
              <div className="overflow-hidden rounded-xl border border-surface-border">
                {templates.map((template) => (
                  <SortableShiftTemplateRow
                    key={template.id}
                    template={template}
                    onDelete={(id) => void deleteTemplate(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4 grid gap-3 border-t border-dashed border-surface-border pt-4">
          <p className="text-sm font-medium text-text-primary">Add template</p>
          <input className={settingsInputClass} placeholder="Template name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TimeInput className={settingsInputClass} value={newStart} onChange={(event) => setNewStart(event.target.value)} />
            <TimeInput className={settingsInputClass} value={newEnd} onChange={(event) => setNewEnd(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((day) => (
              <label key={`new-${day.key}`} className="flex cursor-pointer items-center gap-1.5 text-sm text-text-secondary">
                <input type="checkbox" checked={newDays.includes(day.key)} onChange={() => setNewDays((cur) => toggleDayValue(cur, day.key))} className="rounded" />
                {day.label}
              </label>
            ))}
          </div>
          <button
            onClick={() => void addTemplate()}
            className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
          >
            Save template
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">Alerts</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Escalation settings help" className="rounded p-0.5 text-text-muted hover:text-text-secondary">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Set thresholds for equipment and coverage alerts on the workboard.</TooltipContent>
          </Tooltip>
        </div>
        <p className="mb-4 mt-1 text-sm text-text-muted">Configure escalation thresholds used by the Workboard escalation center.</p>
        <div className="grid gap-4">
          {[
            { field: 'equipment_service_overdue_days' as const, label: 'Alert when equipment not serviced for X days', min: 1, max: undefined },
            { field: 'shift_coverage_warning_pct' as const, label: 'Warn when crew coverage drops below X%', min: 1, max: 100 },
            { field: 'wind_speed_spray_cutoff_mph' as const, label: 'Flag spray tasks when wind exceeds X mph', min: 1, max: undefined },
            { field: 'rain_probability_spray_cutoff_pct' as const, label: 'Flag spray tasks when rain chance exceeds X%', min: 1, max: 100 },
            { field: 'heat_advisory_temp_f' as const, label: 'Show heat advisory above X°F', min: 1, max: undefined },
          ].map(({ field, label, min, max }) => (
            <label key={field} className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">{label}</span>
              <input
                className={settingsInputClass}
                type="number"
                min={min}
                max={max}
                value={alertsConfig[field]}
                onChange={(event) => setAlertsConfig((current) => ({ ...current, [field]: Number(event.target.value || '0') }))}
              />
            </label>
          ))}
          <button
            onClick={() => void saveAlertsConfig()}
            className={`w-fit rounded-lg px-4 py-2 text-sm font-medium text-text-inverse transition-colors ${alertsSaved ? 'bg-status-active' : 'bg-brand hover:bg-brand-bright'}`}
          >
            {alertsSaving ? 'Saving...' : alertsSaved ? 'Saved ✓' : 'Save alerts'}
          </button>
        </div>
      </section>
    </div>
  );
}


