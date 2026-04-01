import { Bell, ChevronLeft, ChevronRight, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { departments } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';

interface TopBarProps {
  department: string;
  setDepartment: (d: string) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
}

const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export function TopBar({ department, setDepartment, currentDate, setCurrentDate }: TopBarProps) {
  const prevDay = () => setCurrentDate(new Date(currentDate.getTime() - 86400000));
  const nextDay = () => setCurrentDate(new Date(currentDate.getTime() + 86400000));

  return (
    <header className="h-14 border-b bg-card flex items-center px-3 gap-3 shrink-0">
      <SidebarTrigger className="text-muted-foreground" />

      <Select value={department} onValueChange={setDepartment}>
        <SelectTrigger className="w-40 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {departments.map(d => (
            <SelectItem key={d} value={d}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[220px] text-center">{formatDate(currentDate)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextDay}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1" />

      <Button size="sm" className="h-8 gap-1.5">
        <Save className="h-3.5 w-3.5" />
        Save Board
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8 relative">
        <Bell className="h-4 w-4" />
        <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">3</Badge>
      </Button>

      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
        <User className="h-4 w-4 text-primary-foreground" />
      </div>
    </header>
  );
}
