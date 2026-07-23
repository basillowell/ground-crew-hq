'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CalendarPlus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import {
  useCreateTimelineEvent,
  useUpdateTimelineEvent,
  type ProjectTimelineEvent,
} from '@/lib/supabase-queries';

type TimelineEventFormProps = {
  orgId?: string | null;
  propertyId: string;
  projectId: string;
  createdBy?: string | null;
  event?: ProjectTimelineEvent | null;
  onSaved?: () => void;
  onCancelEdit?: () => void;
};

type TimelineFormState = {
  eventType: string;
  title: string;
  body: string;
  eventDate: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

function defaultState(): TimelineFormState {
  return {
    eventType: 'update',
    title: '',
    body: '',
    eventDate: todayKey(),
  };
}

export function TimelineEventForm({
  orgId,
  propertyId,
  projectId,
  createdBy,
  event,
  onSaved,
  onCancelEdit,
}: TimelineEventFormProps) {
  const createTimelineEventMutation = useCreateTimelineEvent(orgId ?? undefined);
  const updateTimelineEventMutation = useUpdateTimelineEvent(orgId ?? undefined);
  const [form, setForm] = useState<TimelineFormState>(defaultState);
  const isEditing = Boolean(event);
  const isSaving = createTimelineEventMutation.isPending || updateTimelineEventMutation.isPending;

  useEffect(() => {
    setForm(event
      ? {
          eventType: event.eventType,
          title: event.title,
          body: event.body,
          eventDate: event.eventDate,
        }
      : defaultState(),
    );
  }, [event]);

  const resetForm = () => setForm(defaultState());

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (isSaving || !orgId) return;
    if (!propertyId || propertyId === 'all' || !projectId) {
      toast.error('Select a project before adding a timeline event.');
      return;
    }
    const title = form.title.trim();
    if (!title) {
      toast.error('Timeline event title is required.');
      return;
    }

    const payload = {
      id: event?.id,
      projectId,
      propertyId,
      eventType: form.eventType,
      title,
      body: form.body.trim() || null,
      eventDate: form.eventDate,
      createdBy: createdBy ?? null,
    };

    try {
      if (isEditing) {
        await updateTimelineEventMutation.mutateAsync(payload);
        toast.success('Timeline event updated.');
      } else {
        await createTimelineEventMutation.mutateAsync(payload);
        toast.success('Timeline event added.');
      }
      resetForm();
      onSaved?.();
    } catch (error) {
      console.error('Timeline event save failed:', error);
      toast.error(error instanceof Error ? error.message : 'Timeline event could not be saved.');
    }
  };

  return (
    <form className="rounded-xl border border-surface-border bg-surface-elevated/60 p-3" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <CalendarPlus className="h-4 w-4 text-brand" />
        {isEditing ? 'Edit timeline event' : 'Add timeline event'}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.eventType} onValueChange={(eventType) => setForm((current) => ({ ...current, eventType }))} disabled={isSaving}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="milestone">Milestone</SelectItem>
              <SelectItem value="delay">Delay</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeline-date">Date</Label>
          <Input
            id="timeline-date"
            type="date"
            value={form.eventDate}
            onChange={(changeEvent) => setForm((current) => ({ ...current, eventDate: changeEvent.target.value }))}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Label htmlFor="timeline-title">Title</Label>
        <Input
          id="timeline-title"
          value={form.title}
          onChange={(changeEvent) => setForm((current) => ({ ...current, title: changeEvent.target.value }))}
          placeholder="Irrigation trenching complete"
          disabled={isSaving}
        />
      </div>
      <div className="mt-3 space-y-2">
        <Label htmlFor="timeline-body">Details</Label>
        <Textarea
          id="timeline-body"
          value={form.body}
          onChange={(changeEvent) => setForm((current) => ({ ...current, body: changeEvent.target.value }))}
          placeholder="Crew notes, vendor update, or next step"
          disabled={isSaving}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {isEditing ? (
          <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isSaving}>Cancel edit</Button>
        ) : null}
        <Button type="submit" disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : isEditing ? 'Save event' : 'Add event'}
        </Button>
      </div>
    </form>
  );
}