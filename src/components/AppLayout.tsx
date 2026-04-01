import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { SidebarProvider } from '@/components/ui/sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [department, setDepartment] = useState('Maintenance');
  const [currentDate, setCurrentDate] = useState(new Date(2024, 2, 25));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            department={department}
            setDepartment={setDepartment}
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
