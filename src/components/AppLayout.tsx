import { ReactNode, useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { loadDepartmentOptions, loadProgramSettings } from '@/lib/dataStore';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(['Maintenance']);
  const [department, setDepartment] = useState('Maintenance');
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const refreshProgramSetup = () => {
      const nextDepartments = loadDepartmentOptions().map((entry) => entry.name);
      const settings = loadProgramSettings()[0];
      const fallbackDepartment = nextDepartments[0] ?? 'Maintenance';
      setDepartmentOptions(nextDepartments.length > 0 ? nextDepartments : ['Maintenance']);
      setDepartment(settings?.defaultDepartment || fallbackDepartment);
    };

    refreshProgramSetup();
    window.addEventListener('program-setup-updated', refreshProgramSetup);
    return () => window.removeEventListener('program-setup-updated', refreshProgramSetup);
  }, []);

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
          />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
