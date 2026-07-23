'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useCreateProject, useUpdateProject, type PropertyProject } from '@/lib/supabase-queries';

type ProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId?: string | null;
  propertyId: string;
  project?: PropertyProject | null;
};

type ProjectFormState = {
  name: string;
  status: string;
  description: string;
  startDate: string;
  targetEndDate: string;
  color: string;
};

const defaultFormState: ProjectFormState = {
  name: '',
  status: 'active',
  description: '',
  startDate: '',
  targetEndDate: '',
  color: '#2FA866',
};

export function ProjectFormDialog({ open, onOpenChange, orgId, propertyId, project }: ProjectFormDialogProps) {
  const createProjectMutation = useCreateProject(orgId ?? undefined);
  const updateProjectMutation = useUpdateProject(orgId ?? undefined);
  const [form, setForm] = useState<ProjectFormState>(defaultFormState);
  const isEditing = Boolean(project);
  const isSaving = createProjectMutation.isPending || updateProjectMutation.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(project
      ? {
          name: project.name,
          status: project.status,
          description: project.description,
          startDate: project.startDate ?? '',
          targetEndDate: project.targetEndDate ?? '',
          color: project.color ?? '#2FA866',
        }
      : defaultFormState,
    );
  }, [open, project]);

  const handleClose = () => {
    setForm(defaultFormState);
    onOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !orgId) return;
    if (!propertyId || propertyId === 'all') {
      toast.error('Select a property before saving a project.');
      return;
    }
    const name = form.name.trim();
    if (!name) {
      toast.error('Project name is required.');
      return;
    }

    const payload = {
      id: project?.id,
      propertyId,
      name,
      status: form.status,
      description: form.description.trim() || null,
      startDate: form.startDate || null,
      targetEndDate: form.targetEndDate || null,
      color: form.color.trim() || null,
    };

    try {
      if (isEditing) {
        await updateProjectMutation.mutateAsync(payload);
        toast.success('Project updated.');
      } else {
        await createProjectMutation.mutateAsync(payload);
        toast.success('Project created.');
      }
      handleClose();
    } catch (error) {
      console.error('Project save failed:', error);
      toast.error(error instanceof Error ? error.message : 'Project could not be saved.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="border-surface-border bg-surface-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit project' : 'Create project'}</DialogTitle>
          <DialogDescription>Projects belong to the selected property and can carry their own timeline.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Greens drainage repair"
              disabled={isSaving}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(status) => setForm((current) => ({ ...current, status }))} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-color">Color</Label>
              <Input
                id="project-color"
                type="color"
                className="h-10 p-1"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-start">Start date</Label>
              <Input
                id="project-start"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-target">Target end</Label>
              <Input
                id="project-target"
                type="date"
                value={form.targetEndDate}
                onChange={(event) => setForm((current) => ({ ...current, targetEndDate: event.target.value }))}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Scope, constraints, or notes"
              disabled={isSaving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}