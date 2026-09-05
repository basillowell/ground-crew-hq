import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, FileCheck2, Image as ImageIcon, Loader2, MapPin, PenLine, UploadCloud } from 'lucide-react';
import type { Assignment, Employee, Property } from '@/data/seedData';
import {
  type AssignmentSignature,
  PROJECT_PHOTO_ALLOWED_TYPES,
  PROJECT_PHOTO_MAX_BYTES,
  type TaskWorkOrder,
  useAssignmentGeoNotes,
  useAssignmentSignaturesForAssignments,
  useProjects,
  useTaskWorkOrderPhotos,
  useTaskWorkOrderAssignments,
  useUploadProjectPhoto,
} from '@/lib/supabase-queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';

type BadgeVariant = 'active' | 'pending' | 'warning' | 'complete' | 'hold';

type TaskWorkOrderProofDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId?: string | null;
  workOrder: TaskWorkOrder | null;
  properties: Property[];
  employees: Employee[];
};

const stageVariants: Record<TaskWorkOrder['funnelStage'], BadgeVariant> = {
  new: 'pending',
  in_review: 'pending',
  accepted: 'active',
  rejected: 'warning',
  assigned: 'active',
  pending_verification: 'pending',
  completed: 'complete',
};

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatHours(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)}h`;
}

function employeeName(employee: Employee | undefined) {
  if (!employee) return 'Unassigned employee';
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.email || 'Unnamed employee';
}

function assignmentCompletionDate(assignment: Assignment) {
  return assignment.actualCompletedAt ?? assignment.actual_completed_at ?? assignment.completedAt ?? assignment.completed_at ?? null;
}

function latestAssignmentCompletion(assignments: Assignment[]) {
  return assignments
    .map(assignmentCompletionDate)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function groupSignaturesByAssignment(signatures: AssignmentSignature[]) {
  return signatures.reduce<Record<string, AssignmentSignature[]>>((groups, signature) => {
    groups[signature.assignmentId] = [...(groups[signature.assignmentId] ?? []), signature];
    return groups;
  }, {});
}

function formatGeoPoint(locationGeojson: { type: 'Point'; coordinates: [number, number] } | null | undefined) {
  if (!locationGeojson) return 'Location pinned';
  const [lng, lat] = locationGeojson.coordinates;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function validatePhoto(file: File) {
  if (!PROJECT_PHOTO_ALLOWED_TYPES.includes(file.type as typeof PROJECT_PHOTO_ALLOWED_TYPES[number])) {
    return 'Choose a JPEG, PNG, WebP, HEIC, or HEIF image.';
  }
  if (file.size > PROJECT_PHOTO_MAX_BYTES) {
    return 'Photos must be 10 MB or smaller.';
  }
  return null;
}

export function TaskWorkOrderProofDialog({
  open,
  onOpenChange,
  orgId,
  workOrder,
  properties,
  employees,
}: TaskWorkOrderProofDialogProps) {
  const { currentUser } = useOrgProfile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const workOrderId = workOrder?.id ? [workOrder.id] : [];
  const proofPhotoWorkOrderId = workOrder?.id ?? null;
  const workOrderPropertyId = workOrder?.propertyId && workOrder.propertyId !== 'all' ? workOrder.propertyId : undefined;
  const assignmentsQuery = useTaskWorkOrderAssignments(orgId ?? undefined, workOrderId);
  const assignments = assignmentsQuery.data ?? [];
  const assignmentIds = useMemo(() => assignments.map((assignment) => assignment.id).filter((id): id is string => Boolean(id)), [assignments]);
  const signaturesQuery = useAssignmentSignaturesForAssignments(orgId ?? undefined, assignmentIds);
  const geoNotesQuery = useAssignmentGeoNotes(orgId ?? undefined, assignmentIds);
  const proofPhotosQuery = useTaskWorkOrderPhotos(orgId ?? undefined, proofPhotoWorkOrderId);
  const projectsQuery = useProjects(workOrderPropertyId, orgId ?? undefined);
  const uploadPhotoMutation = useUploadProjectPhoto(orgId ?? undefined);
  const signatures = signaturesQuery.data ?? [];
  const geoNotes = geoNotesQuery.data ?? [];
  const proofPhotos = proofPhotosQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const property = properties.find((item) => item.id === workOrder?.propertyId);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const signaturesByAssignment = groupSignaturesByAssignment(signatures);
  const isLoading = Boolean(workOrder && assignmentsQuery.isLoading && !assignmentsQuery.data);
  const signaturesLoading = Boolean(assignmentIds.length > 0 && signaturesQuery.isLoading && !signaturesQuery.data);
  const error = assignmentsQuery.error ?? signaturesQuery.error;
  const fieldCompletedAt = latestAssignmentCompletion(assignments);
  const totalHours = assignments.reduce((sum, assignment) => sum + Number(assignment.actualHours ?? assignment.actual_hours ?? 0), 0);
  const isUploadingPhoto = uploadPhotoMutation.isPending;

  useEffect(() => {
    setPhotoCaption('');
    setSelectedProjectId('');
  }, [workOrder?.id]);

  useEffect(() => {
    if (!workOrderPropertyId || projects.length === 0) {
      setSelectedProjectId('');
      return;
    }
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, workOrderPropertyId]);

  const handleChoosePhoto = () => {
    if (!workOrder || !workOrderPropertyId) {
      toast.error('This work order needs a property before attaching proof photos.');
      return;
    }
    if (!selectedProjectId) {
      toast.error('Choose a project before attaching a proof photo.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!workOrder || !workOrderPropertyId) {
      toast.error('This work order needs a property before attaching proof photos.');
      event.target.value = '';
      return;
    }
    if (!selectedProjectId || selectedProjectId === 'all') {
      toast.error('Choose a project before attaching a proof photo.');
      event.target.value = '';
      return;
    }
    const validationError = validatePhoto(file);
    if (validationError) {
      toast.error(validationError);
      event.target.value = '';
      return;
    }

    try {
      await uploadPhotoMutation.mutateAsync({
        file,
        propertyId: workOrderPropertyId,
        projectId: selectedProjectId,
        timelineEventId: null,
        taskWorkOrderId: workOrder.id,
        uploadedBy: currentUser?.employeeId || null,
        caption: photoCaption,
      });
      setPhotoCaption('');
      toast.success('Proof photo attached.');
    } catch (uploadError) {
      console.error('Proof photo upload failed:', uploadError);
      toast.error('Proof photo could not be attached.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-surface-border bg-surface-card text-text-primary sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Proof package</DialogTitle>
          <DialogDescription>
            Delivered work, crew time, verification details, and assignment signatures for this work order.
          </DialogDescription>
        </DialogHeader>

        {!workOrder ? (
          <div className="rounded-lg border border-surface-border bg-surface-elevated p-4 text-sm text-text-secondary">
            Select a work order to review proof.
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-text-primary">{workOrder.title}</h3>
                  {workOrder.description ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{workOrder.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={stageVariants[workOrder.funnelStage]}>{titleCase(workOrder.funnelStage)}</Badge>
                  <Badge variant="hold" className="capitalize">{workOrder.source}</Badge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Property</p>
                  <p className="mt-1 text-text-primary">{property?.name ?? 'Property not set'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Field completed</p>
                  <p className="mt-1 text-text-primary">{formatDateTime(fieldCompletedAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Verified</p>
                  <p className="mt-1 text-text-primary">{formatDateTime(workOrder.completedAt)}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Assignments
                </div>
                <p className="mt-2 text-xl font-semibold text-text-primary">{assignments.length}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Crew Hours
                </div>
                <p className="mt-2 text-xl font-semibold text-text-primary">{formatHours(totalHours)}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                  <PenLine className="h-3.5 w-3.5" />
                  Signatures
                </div>
                <p className="mt-2 text-xl font-semibold text-text-primary">{signatures.length}</p>
              </div>
            </div>

            <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Proof photos</h4>
                  <p className="mt-1 text-sm text-text-secondary">
                    Only photos explicitly linked to this work order appear here.
                  </p>
                </div>
                {proofPhotosQuery.isLoading && !proofPhotosQuery.data ? <Badge variant="pending">Loading</Badge> : null}
              </div>

              <div className="mb-4 rounded-lg border border-surface-border bg-surface-card p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-end">
                  <label className="block text-xs font-medium uppercase tracking-widest text-text-muted">
                    Project
                    <select
                      value={selectedProjectId}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                      disabled={!workOrderPropertyId || projectsQuery.isLoading || projects.length === 0 || isUploadingPhoto}
                      className="mt-1 min-h-10 w-full rounded-lg border border-surface-border bg-surface-base px-3 text-sm normal-case tracking-normal text-text-primary"
                    >
                      {projects.length === 0 ? (
                        <option value="">No projects available</option>
                      ) : (
                        projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block text-xs font-medium uppercase tracking-widest text-text-muted">
                    Caption
                    <Textarea
                      rows={1}
                      value={photoCaption}
                      onChange={(event) => setPhotoCaption(event.target.value)}
                      placeholder="Optional proof note"
                      disabled={isUploadingPhoto}
                      className="mt-1 min-h-10 normal-case tracking-normal"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleChoosePhoto}
                    disabled={!workOrderPropertyId || projects.length === 0 || isUploadingPhoto}
                  >
                    {isUploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Attach proof photo
                  </Button>
                </div>
                {!workOrderPropertyId ? (
                  <p className="mt-3 text-xs text-status-warning">Set a work order property before attaching proof photos.</p>
                ) : projectsQuery.isError ? (
                  <p className="mt-3 text-xs text-status-warning">Projects could not load for this property.</p>
                ) : projects.length === 0 && !projectsQuery.isLoading ? (
                  <p className="mt-3 text-xs text-text-muted">Create a project for this property before attaching proof photos.</p>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handlePhotoSelected(event)}
                  disabled={isUploadingPhoto}
                />
              </div>

              {proofPhotosQuery.isError ? (
                <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
                  Proof photos could not load.
                </p>
              ) : proofPhotosQuery.isLoading && !proofPhotosQuery.data ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-32 rounded-lg bg-surface-card" />
                  <Skeleton className="h-32 rounded-lg bg-surface-card" />
                  <Skeleton className="h-32 rounded-lg bg-surface-card" />
                </div>
              ) : proofPhotos.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-card/60 p-4 text-sm text-text-secondary">
                  <ImageIcon className="h-4 w-4 shrink-0 text-text-muted" />
                  No proof photos are attached to this work order yet.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {proofPhotos.map((photo) => (
                    <figure key={photo.id} className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
                      <img
                        src={photo.signedUrl}
                        alt={photo.caption || 'Proof photo'}
                        className="h-36 w-full object-cover"
                        loading="lazy"
                      />
                      <figcaption className="space-y-1 p-3 text-xs text-text-secondary">
                        <p className="font-medium text-text-primary">{photo.caption || 'Proof photo'}</p>
                        <p>{formatDateTime(photo.createdAt)}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>

            {workOrder.punchList ? (
              <section className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-3 text-sm text-text-secondary">
                <p className="font-medium text-status-warning">Punch list</p>
                <p className="mt-1 whitespace-pre-line">{workOrder.punchList}</p>
              </section>
            ) : null}

            <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-text-primary">Delivery record</h4>
                {isLoading ? <Badge variant="pending">Loading</Badge> : null}
              </div>
              {error ? (
                <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
                  Delivery proof could not load.
                </p>
              ) : isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full bg-surface-card" />
                  <Skeleton className="h-16 w-full bg-surface-card" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-surface-border bg-surface-card/60 p-4 text-sm text-text-secondary">
                  No linked assignments were found for this work order yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => {
                    const assignmentSignatures = assignment.id ? signaturesByAssignment[assignment.id] ?? [] : [];
                    return (
                      <div key={assignment.id} className="rounded-lg border border-surface-border bg-surface-card p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{assignment.title || workOrder.title}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {employeeName(employeeById.get(assignment.employeeId))} · {formatDate(assignment.date)}
                            </p>
                          </div>
                          <Badge variant={assignmentSignatures.length > 0 ? 'complete' : 'hold'}>
                            {assignmentSignatures.length > 0 ? `${assignmentSignatures.length} signature${assignmentSignatures.length === 1 ? '' : 's'}` : 'No signature'}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-4">
                          <span>Start {formatDateTime(assignment.actualStartAt ?? assignment.actual_start_at)}</span>
                          <span>End {formatDateTime(assignmentCompletionDate(assignment))}</span>
                          <span>Hours {formatHours(assignment.actualHours ?? assignment.actual_hours)}</span>
                          <span>Status {assignment.status ?? 'planned'}</span>
                        </div>
                        {assignmentSignatures.length > 0 ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {assignmentSignatures.map((signature) => (
                              <div key={signature.id} className="rounded-lg border border-surface-border bg-surface-base p-2">
                                <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-status-complete" />
                                  <span>{signature.signerName} · {formatDateTime(signature.signedAt)}</span>
                                </div>
                                <img
                                  src={signature.signatureData}
                                  alt={`Signature from ${signature.signerName}`}
                                  className="h-20 w-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card">
                  <MapPin className="h-5 w-5 text-text-muted" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Geo notes</h4>
                  <p className="mt-1 text-sm text-text-secondary">Assignment-scoped location notes linked to this work order.</p>
                </div>
              </div>
              {geoNotesQuery.isError ? (
                <p className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
                  Geo notes could not load.
                </p>
              ) : geoNotesQuery.isLoading && !geoNotesQuery.data ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-14 w-full bg-surface-card" />
                  <Skeleton className="h-14 w-full bg-surface-card" />
                </div>
              ) : geoNotes.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-surface-border bg-surface-card/60 p-4 text-sm text-text-secondary">
                  No assignment geo notes are linked to this work order yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {geoNotes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-surface-border bg-surface-card p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{note.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">{formatGeoPoint(note.locationGeojson)} · {formatDateTime(note.createdAt)}</p>
                        </div>
                        <Badge variant={note.showOnDisplayBoard ? 'active' : 'hold'}>
                          {note.showOnDisplayBoard ? 'Display board' : 'Internal'}
                        </Badge>
                      </div>
                      {note.content ? <p className="mt-2 text-sm text-text-secondary">{note.content}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {signaturesLoading ? (
              <p className="text-xs text-text-muted">Loading signatures...</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
