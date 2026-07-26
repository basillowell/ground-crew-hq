'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import {
  PROJECT_PHOTO_ALLOWED_TYPES,
  PROJECT_PHOTO_MAX_BYTES,
  useProjectPhotosByProject,
  useProjects,
  useUploadProjectPhoto,
} from '@/lib/supabase-queries';

type FieldPhotoCaptureProps = {
  orgId?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  uploadedBy?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatePhoto(file: File) {
  if (!PROJECT_PHOTO_ALLOWED_TYPES.includes(file.type as typeof PROJECT_PHOTO_ALLOWED_TYPES[number])) {
    return 'Choose a JPEG, PNG, WebP, HEIC, or HEIF image.';
  }
  if (file.size > PROJECT_PHOTO_MAX_BYTES) {
    return 'Photos must be 10 MB or smaller.';
  }
  return null;
}

function isConcreteUuid(value?: string | null): value is string {
  return Boolean(value && value !== 'all' && UUID_PATTERN.test(value));
}

export function FieldPhotoCapture({ orgId, propertyId, propertyName, uploadedBy }: FieldPhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadInFlightRef = useRef(false);
  const validPropertyId = useMemo(() => (isConcreteUuid(propertyId) ? propertyId : undefined), [propertyId]);
  const projectsQuery = useProjects(validPropertyId, orgId ?? undefined);
  const projects = projectsQuery.data ?? [];
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const photosQuery = useProjectPhotosByProject(selectedProjectId || undefined, orgId ?? undefined);
  const uploadPhotoMutation = useUploadProjectPhoto(orgId ?? undefined);
  const isUploading = uploadPhotoMutation.isPending || uploadInFlightRef.current;

  useEffect(() => {
    if (!validPropertyId || projects.length === 0) {
      setSelectedProjectId('');
      return;
    }
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, validPropertyId]);

  const handleRetryProjects = useCallback(() => {
    void projectsQuery.refetch();
  }, [projectsQuery]);

  const handleRetryPhotos = useCallback(() => {
    void photosQuery.refetch();
  }, [photosQuery]);

  const handleTakePhoto = useCallback(() => {
    if (!validPropertyId) {
      toast.error('Property is not available for photos.');
      return;
    }
    if (!selectedProjectId || !selectedProject) {
      toast.error('Choose a project before adding a photo.');
      return;
    }
    if (isUploading) return;
    inputRef.current?.click();
  }, [isUploading, selectedProject, selectedProjectId, validPropertyId]);

  const handlePhotoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (uploadInFlightRef.current || uploadPhotoMutation.isPending) {
      event.target.value = '';
      return;
    }

    const validationError = validatePhoto(file);
    if (validationError) {
      toast.error(validationError);
      event.target.value = '';
      return;
    }
    if (!validPropertyId || !isConcreteUuid(validPropertyId)) {
      toast.error('Property is not available for photos.');
      event.target.value = '';
      return;
    }
    if (!selectedProjectId || selectedProjectId === 'all' || !selectedProject || selectedProject.propertyId !== validPropertyId) {
      toast.error('Choose a project before adding a photo.');
      event.target.value = '';
      return;
    }

    uploadInFlightRef.current = true;
    try {
      await uploadPhotoMutation.mutateAsync({
        file,
        propertyId: validPropertyId,
        projectId: selectedProjectId,
        timelineEventId: null,
        uploadedBy: uploadedBy ?? null,
      });
      toast.success('Progress photo added.');
    } catch (error) {
      console.error('Field photo upload failed:', error);
      toast.error('Photo could not be added.');
    } finally {
      uploadInFlightRef.current = false;
      event.target.value = '';
    }
  };

  return (
    <section className="mb-4 rounded-2xl border border-surface-border bg-surface-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Progress photos</p>
          <p className="mt-1 text-sm text-text-secondary">{propertyName || 'Assigned property'}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
          <Camera className="h-5 w-5 text-brand-bright" />
        </div>
      </div>

      {!validPropertyId ? (
        <p className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-3 text-sm text-text-secondary">
          Property is not available for photos.
        </p>
      ) : projectsQuery.isLoading && !projectsQuery.data ? (
        <div className="space-y-3">
          <Skeleton className="h-11 w-full rounded-lg bg-surface-elevated" />
          <Skeleton className="h-24 w-full rounded-xl bg-surface-elevated" />
        </div>
      ) : projectsQuery.isError ? (
        <div className="rounded-xl border border-status-warning/50 bg-surface-elevated px-3 py-3">
          <p className="text-sm font-medium text-text-primary">Projects could not load.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-10 border-surface-border bg-surface-card text-text-primary"
            onClick={handleRetryProjects}
            disabled={projectsQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${projectsQuery.isFetching ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface-border bg-surface-elevated px-3 py-4 text-sm text-text-secondary">
          No projects to add photos to yet.
        </p>
      ) : (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-text-secondary">
            Project
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-surface-border bg-surface-base px-3 text-sm text-text-primary"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={isUploading}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <Button
            type="button"
            className="min-h-11 w-full bg-brand-bright text-text-inverse hover:bg-brand-bright/90"
            onClick={handleTakePhoto}
            disabled={isUploading || !selectedProjectId}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {isUploading ? 'Adding photo...' : 'Take photo'}
          </Button>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Photos</p>
              {photosQuery.isError ? (
                <button
                  type="button"
                  className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-text-secondary"
                  onClick={handleRetryPhotos}
                  disabled={photosQuery.isFetching}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${photosQuery.isFetching ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              ) : null}
            </div>

            {photosQuery.isLoading && !photosQuery.data ? (
              <div className="flex gap-2 overflow-hidden">
                <Skeleton className="h-20 w-20 shrink-0 rounded-lg bg-surface-elevated" />
                <Skeleton className="h-20 w-20 shrink-0 rounded-lg bg-surface-elevated" />
                <Skeleton className="h-20 w-20 shrink-0 rounded-lg bg-surface-elevated" />
              </div>
            ) : photosQuery.isError ? (
              <p className="rounded-xl border border-status-warning/50 bg-surface-elevated px-3 py-3 text-sm text-text-secondary">
                Photos could not load.
              </p>
            ) : (photosQuery.data ?? []).length === 0 ? (
              <div className="flex min-h-20 items-center gap-2 rounded-xl border border-dashed border-surface-border bg-surface-elevated px-3 text-sm text-text-secondary">
                <ImageIcon className="h-4 w-4 shrink-0" />
                No progress photos yet.
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(photosQuery.data ?? []).map((photo) => (
                  <div key={photo.id} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-surface-border bg-surface-elevated">
                    <img
                      src={photo.signedUrl}
                      alt={photo.caption || 'Progress photo'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handlePhotoSelected(event)}
        disabled={isUploading}
      />
    </section>
  );
}
