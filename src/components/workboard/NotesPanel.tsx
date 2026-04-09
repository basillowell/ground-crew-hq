import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EmptyState } from '@/components/shared';
import type { Note } from '@/data/seedData';

interface NotesPanelProps {
  notes: Note[];
  onAddNote?: () => void;
}

export function NotesPanel({ notes, onAddNote }: NotesPanelProps) {
  return (
    <Tabs defaultValue="daily" className="w-full">
      <TabsList className="w-full grid grid-cols-4 h-8">
        <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
        <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
        <TabsTrigger value="geo" className="text-xs">Geo</TabsTrigger>
        <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
      </TabsList>
      {(['daily', 'general', 'geo', 'alerts'] as const).map(tab => (
        <TabsContent key={tab} value={tab} className="mt-2 space-y-2">
          {notes
            .filter(n => tab === 'alerts' ? n.type === 'alert' : n.type === tab)
            .map(note => (
              <div key={note.id} className="p-2.5 rounded-md bg-muted/50 border text-xs group hover:border-primary/20 transition-colors">
                <div className="font-medium text-foreground mb-0.5">{note.title}</div>
                <p className="text-muted-foreground leading-relaxed">{note.content}</p>
                <div className="text-muted-foreground/70 mt-1.5 text-[10px] flex items-center gap-1">
                  {note.author} • {note.date}
                  {note.location && <span>• 📍 {note.location}</span>}
                </div>
              </div>
            ))}
          <Button variant="ghost" size="sm" className="w-full text-xs border border-dashed" onClick={onAddNote}>
            <Plus className="h-3 w-3 mr-1" /> Add Note
          </Button>
        </TabsContent>
      ))}
    </Tabs>
  );
}
