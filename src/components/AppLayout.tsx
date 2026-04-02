import { ReactNode, useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { loadDepartmentOptions, loadProgramSettings } from '@/lib/dataStore';
import type { ProgramSettings } from '@/data/seedData';

interface AppLayoutProps {
  children: ReactNode;
}

function hexToHslValues(hex: string | undefined, fallback: string) {
  if (!hex) return fallback;
  const sanitized = hex.replace('#', '').trim();
  if (![3, 6].includes(sanitized.length)) return fallback;
  const normalized = sanitized.length === 3
    ? sanitized.split('').map((char) => char + char).join('')
    : sanitized;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  if ([r, g, b].some((value) => Number.isNaN(value))) return fallback;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
  }
  const hue = Math.round(h * 60 < 0 ? h * 60 + 360 : h * 60);
  const sat = Math.round(s * 100);
  const light = Math.round(l * 100);
  return `${hue} ${sat}% ${light}%`;
}

function applyBranding(programSetting?: ProgramSettings) {
  if (typeof document === 'undefined' || !programSetting) return;
  document.title = `${programSetting.appName || 'WorkForce App'}${programSetting.clientLabel ? ` | ${programSetting.clientLabel}` : ''}`;
  const root = document.documentElement;
  root.style.setProperty('--primary', hexToHslValues(programSetting.primaryColor, '152 55% 38%'));
  root.style.setProperty('--ring', hexToHslValues(programSetting.primaryColor, '152 55% 38%'));
  root.style.setProperty('--accent', hexToHslValues(programSetting.accentColor, '152 30% 94%'));
  root.style.setProperty('--sidebar-background', hexToHslValues(programSetting.sidebarColor, '220 20% 14%'));
  root.style.setProperty('--sidebar-primary', hexToHslValues(programSetting.primaryColor, '152 55% 48%'));
  if (programSetting.logoUrl) {
    let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = programSetting.logoUrl;
  }
}

export function AppLayout({ children }: AppLayoutProps) {
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(['Maintenance']);
  const [department, setDepartment] = useState('Maintenance');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [programSetting, setProgramSetting] = useState<ProgramSettings | null>(null);

  useEffect(() => {
    const refreshProgramSetup = () => {
      const nextDepartments = loadDepartmentOptions().map((entry) => entry.name);
      const settings = loadProgramSettings()[0];
      const fallbackDepartment = nextDepartments[0] ?? 'Maintenance';
      setProgramSetting(settings ?? null);
      setDepartmentOptions(nextDepartments.length > 0 ? nextDepartments : ['Maintenance']);
      setDepartment(settings?.defaultDepartment || fallbackDepartment);
    };

    refreshProgramSetup();
    window.addEventListener('program-setup-updated', refreshProgramSetup);
    return () => window.removeEventListener('program-setup-updated', refreshProgramSetup);
  }, []);

  useEffect(() => {
    applyBranding(programSetting ?? undefined);
  }, [programSetting]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('operations-context-updated', {
        detail: {
          department,
          date: currentDate.toISOString().slice(0, 10),
        },
      }),
    );
  }, [currentDate, department]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            department={department}
            setDepartment={setDepartment}
            departments={departmentOptions}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            programSetting={programSetting ?? undefined}
          />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
