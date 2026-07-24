'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Edit3, FolderKanban, MapPin, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { ProjectPhotoStrip } from '@/components/map/ProjectPhotoStrip';
import { ProjectFormDialog } from '@/components/map/ProjectFormDialog';
import { TimelineEventForm } from '@/components/map/TimelineEventForm';
import {
  useDeleteProject,
  useDeleteTimelineEvent,
  useProjects,
  useTimelineEvents,
  type ProjectTimelineEvent,
  type PropertyBoundary,
  type PropertyProject,
} from '@/lib/supabase-queries';

type PropertyDetailPanelProps = {
  property: PropertyBoundary;
  orgId?: string | null;
  canManage: boolean;
  createdBy?: string | null;
  selectedProjectId?: string | null;
  pinPlacementProjectId?: string | null;
  pinPlacementSaving: boolean;
  onStartPlacePin: (project: PropertyProject) => void;
  onCancelPlacePin: () => void;
  onClose: () => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusClassName(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'border-status-complete/40 bg-status-complete/15 text-status-complete';
  if (normalized === 'paused' || normalized === 'delay') return 'border-status-warning/40 bg-status-warning/15 text-status-warning';
  if (normalized === 'planned') return 'border-status-pending/40 bg-status-pending/15 text-status-pending';
  return 'border-status-active/40 bg-status-active/15 text-status-active';
}

function ProjectTimeline({
  project,
  propertyId,
  orgId,
  canManage,
  createdBy,
}: {
  project: PropertyProject;
  propertyId: string;
  orgId?: string | null;
  canManage: boolean;
  createdBy?: string | null;
}) {
  const timelineQuery = useTimelineEvents(project.id, orgId ?? undefined);
  const deleteTimelineEventMutation = useDeleteTimelineEvent(orgId ?? undefined);
  const [editingEvent, setEditingEvent] = useState<ProjectTimelineEvent | null>(null);
  const events = timelineQuery.data ?? [];

  const handleDeleteEvent = async (event: ProjectTimelineEvent) => {
    if (deleteTimelineEventMutation.isPending) return;
    const confirmed = window.confirm(`Delete timeline event "${event.title}"?`);
    if (!confirmed) return;
    try {
      await deleteTimelineEventMutation.mutateAsync({ propertyId, projectId: project.id, eventId: event.id });
      toast.success('Timeline event deleted.');
    } catch (error) {
      console.error('Timeline event delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Timeline event could not be deleted.');
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-surface-border pt-4">
      <div className="grid gap-3 text-xs text-text-muted sm:grid-cols-2">
        <div>
          <div className="uppercase tracking-[0.16em]">Start</div>
          <div className="mt-1 font-medium text-text-secondary">{formatDate(project.startDate)}</div>
        </div>
        <div>
          <div className="uppercase tracking-[0.16em]">Target end</div>
          <div className="mt-1 font-medium text-text-secondary">{formatDate(project.targetEndDate)}</div>
        </div>
      </div>
      {project.description ? <p className="text-sm text-text-secondary">{project.description}</p> : null}
      <TimelineEventForm
        orgId={orgId}
        propertyId={propertyId}
        projectId={project.id}
        createdBy={createdBy}
        event={editingEvent}
        onSaved={() => setEditingEvent(null)}
        onCancelEdit={() => setEditingEvent(null)}
      />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-primary">Timeline</h4>
          <Button type="button" variant="ghost" size="sm" onClick={() => void timelineQuery.refetch()} disabled={timelineQuery.isFetching}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${timelineQuery.isFetching ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
        {timelineQuery.isLoading && !timelineQuery.data ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : timelineQuery.isError ? (
          <Card className="border-status-warning/50 bg-surface-card p-3">
            <div className="text-sm font-medium text-text-primary">Timeline could not load.</div>
            <p className="mt-1 text-xs text-text-secondary">{(timelineQuery.error as Error).message}</p>
          </Card>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-surface-border p-4 text-sm text-text-secondary">
            No timeline events yet.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-surface-border bg-surface-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClassName(event.eventType)}>{event.eventType}</Badge>
                      <span className="text-xs text-text-muted">{formatDate(event.eventDate)}</span>
                    </div>
                    <div className="mt-2 font-medium text-text-primary">{event.title}</div>
                    {event.body ? <p className="mt-1 text-sm text-text-secondary">{event.body}</p> : null}
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingEvent(event)} aria-label="Edit timeline event">
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-status-warning" onClick={() => void handleDeleteEvent(event)} aria-label="Delete timeline event">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <ProjectPhotoStrip
                  orgId={orgId}
                  propertyId={propertyId}
                  projectId={project.id}
                  timelineEventId={event.id}
                  canManage={canManage}
                  uploadedBy={createdBy ?? null}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PropertyDetailPanel({
  property,
  orgId,
  canManage,
  createdBy,
  selectedProjectId,
  pinPlacementProjectId,
  pinPlacementSaving,
  onStartPlacePin,
  onCancelPlacePin,
  onClose,
}: PropertyDetailPanelProps) {
  const projectsQuery = useProjects(property.id, orgId ?? undefined);
  const deleteProjectMutation = useDeleteProject(orgId ?? undefined);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PropertyProject | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const projects = projectsQuery.data ?? [];

  useEffect(() => {
    setExpandedProjectId(null);
    setEditingProject(null);
    setProjectDialogOpen(false);
  }, [property.id]);

  const expandedProject = useMemo(
    () => projects.find((project) => project.id === expandedProjectId) ?? projects[0] ?? null,
    [expandedProjectId, projects],
  );

  useEffect(() => {
    if (!expandedProjectId && projects[0]) setExpandedProjectId(projects[0].id);
  }, [expandedProjectId, projects]);

  useEffect(() => {
    if (selectedProjectId && projects.some((project) => project.id === selectedProjectId)) {
      setExpandedProjectId(selectedProjectId);
    }
  }, [projects, selectedProjectId]);

  const openCreateProject = () => {
    setEditingProject(null);
    setProjectDialogOpen(true);
  };

  const openEditProject = (project: PropertyProject) => {
    setEditingProject(project);
    setProjectDialogOpen(true);
  };

  const handleDeleteProject = async (project: PropertyProject) => {
    if (deleteProjectMutation.isPending) return;
    const confirmed = window.confirm(`Delete project "${project.name}"? Timeline events for this project may also be removed by the database.`);
    if (!confirmed) return;
    try {
      await deleteProjectMutation.mutateAsync({ propertyId: property.id, projectId: project.id });
      if (expandedProjectId === project.id) setExpandedProjectId(null);
      toast.success('Project deleted.');
    } catch (error) {
      console.error('Project delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Project could not be deleted.');
    }
  };

  return (
    <aside className="flex w-full flex-col rounded-xl border border-surface-border bg-surface-elevated shadow-xl xl:fixed xl:bottom-0 xl:right-0 xl:top-[85px] xl:z-10 xl:h-[calc(100vh-85px)] xl:max-w-xl xl:rounded-none xl:border-0 xl:border-l">
      <div className="border-b border-surface-border bg-surface-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Property projects</div>
            <h2 className="mt-1 truncate text-xl font-bold text-text-primary">{property.name}</h2>
            <p className="mt-1 text-sm text-text-secondary">{projects.length} active project{projects.length === 1 ? '' : 's'} tracked here.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose} aria-label="Close property details">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={openCreateProject} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
          <Button type="button" variant="outline" onClick={() => void projectsQuery.refetch()} disabled={projectsQuery.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${projectsQuery.isFetching ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {projectsQuery.isLoading && !projectsQuery.data ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : projectsQuery.isError ? (
          <Card className="border-status-warning/50 bg-surface-card p-4">
            <div className="font-semibold text-text-primary">Projects could not load.</div>
            <p className="mt-1 text-sm text-text-secondary">{(projectsQuery.error as Error).message}</p>
            <Button type="button" className="mt-3" onClick={() => void projectsQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="border-dashed border-surface-border bg-surface-card p-5 text-center">
            <FolderKanban className="mx-auto h-8 w-8 text-text-muted" />
            <div className="mt-3 font-semibold text-text-primary">No projects yet</div>
            <p className="mt-1 text-sm text-text-secondary">Create the first project for this property to start tracking milestones.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const isExpanded = expandedProject?.id === project.id;
              const isPlacingThisPin = pinPlacementProjectId === project.id;
              const hasProjectPin = Boolean(project.locationGeojson);
              return (
                <Card key={project.id} className={`border-surface-border bg-surface-card p-4 ${isExpanded ? 'ring-1 ring-brand-dim' : ''}`}>
                  <button type="button" className="w-full text-left" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color ?? property.color }} />
                          <h3 className="truncate font-bold text-text-primary">{project.name}</h3>
                          <Badge variant="outline" className={statusClassName(project.status)}>{project.status}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
                          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(project.startDate)}</span>
                          <span>Target {formatDate(project.targetEndDate)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditProject(project)} disabled={!canManage}>
                      <Edit3 className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {canManage ? (
                      <Button
                        type="button"
                        variant={isPlacingThisPin ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => (isPlacingThisPin ? onCancelPlacePin() : onStartPlacePin(project))}
                        disabled={pinPlacementSaving}
                      >
                        <MapPin className="mr-2 h-3.5 w-3.5" />
                        {isPlacingThisPin ? 'Cancel pin' : hasProjectPin ? 'Move pin' : 'Place pin'}
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" className="text-status-warning" onClick={() => void handleDeleteProject(project)} disabled={!canManage || deleteProjectMutation.isPending}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                  {isExpanded ? (
                    <ProjectTimeline
                      project={project}
                      propertyId={property.id}
                      orgId={orgId}
                      canManage={canManage}
                      createdBy={createdBy}
                    />
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ProjectFormDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        orgId={orgId}
        propertyId={property.id}
        project={editingProject}
      />
    </aside>
  );
}
