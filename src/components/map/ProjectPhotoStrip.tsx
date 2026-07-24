'use client';

import { ChangeEvent, useCallback, useRef } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import {
  PROJECT_PHOTO_ALLOWED_TYPES,
  PROJECT_PHOTO_MAX_BYTES,
  useDeleteProjectPhoto,
  useProjectPhotos,
  useUploadProjectPhoto,
  type ProjectPhoto,
} from '@/lib/supabase-queries';

type ProjectPhotoStripProps = {
  orgId?: string | null;
  propertyId: string;
  projectId: string;
  timelineEventId: string;
  canManage: boolean;
  uploadedBy?: string | null;
};

function formatPhotoSize(sizeBytes: number | null) {
  if (!sizeBytes || !Number.isFinite(sizeBytes)) return '';
  const sizeMb = sizeBytes / (1024 * 1024);
  return `${sizeMb.toFixed(sizeMb >= 1 ? 1 : 2)} MB`;
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

export function ProjectPhotoStrip({
  orgId,
  propertyId,
  projectId,
  timelineEventId,
  canManage,
  uploadedBy,
}: ProjectPhotoStripProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const photosQuery = useProjectPhotos({ timelineEventId }, orgId ?? undefined);
  const uploadPhotoMutation = useUploadProjectPhoto(orgId ?? undefined);
  const deletePhotoMutation = useDeleteProjectPhoto(orgId ?? undefined);
  const photos = photosQuery.data ?? [];
  const isUploading = uploadPhotoMutation.isPending;
  const isDeleting = deletePhotoMutation.isPending;
  const handleRetryPhotos = useCallback(() => {
    void photosQuery.refetch();
  }, [photosQuery.refetch]);

  const handlePhotoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isUploading) return;
    const validationError = validatePhoto(file);
    if (validationError) {
      toast.error(validationError);
      event.target.value = '';
      return;
    }
    try {
      await uploadPhotoMutation.mutateAsync({
        file,
        propertyId,
        projectId,
        timelineEventId,
        uploadedBy: uploadedBy ?? null,
      });
      toast.success('Photo added.');
      event.target.value = '';
    } catch (error) {
      console.error('Project photo upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Photo could not be added.');
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (photo: ProjectPhoto) => {
    if (isDeleting) return;
    const confirmed = window.confirm('Remove this photo?');
    if (!confirmed) return;
    try {
      await deletePhotoMutation.mutateAsync({ photo });
      toast.success('Photo removed.');
    } catch (error) {
      console.error('Project photo delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Photo could not be removed.');
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Photos</div>
        {photosQuery.isError ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleRetryPhotos} disabled={photosQuery.isFetching}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${photosQuery.isFetching ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        ) : null}
      </div>

      {photosQuery.isLoading && !photosQuery.data ? (
        <div className="flex gap-2">
          <Skeleton className="h-20 w-20 rounded-lg" />
          <Skeleton className="h-20 w-20 rounded-lg" />
        </div>
      ) : photosQuery.isError ? (
        <Card className="border-status-warning/50 bg-surface-card p-3">
          <div className="text-sm font-medium text-text-primary">Photos could not load.</div>
          <p className="mt-1 text-xs text-text-secondary">{(photosQuery.error as Error).message}</p>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-surface-border bg-surface-elevated">
              <img
                src={photo.signedUrl}
                alt={photo.caption || 'Project progress photo'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {photo.sizeBytes ? (
                <div className="absolute bottom-0 left-0 right-0 bg-surface-base/80 px-1 py-0.5 text-[10px] text-text-secondary">
                  {formatPhotoSize(photo.sizeBytes)}
                </div>
              ) : null}
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7 bg-surface-card/90 text-status-warning opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
                  onClick={() => void handleDeletePhoto(photo)}
                  disabled={isDeleting}
                  aria-label="Remove photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ))}
          {photos.length === 0 ? (
            <div className="flex h-20 min-w-40 items-center rounded-lg border border-dashed border-surface-border px-3 text-sm text-text-secondary">
              No photos yet.
            </div>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              className="h-20 w-20 flex-col gap-1 rounded-lg border-dashed px-2 text-xs"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading || isDeleting}
            >
              <ImagePlus className="h-4 w-4" />
              {isUploading ? 'Adding...' : 'Add'}
            </Button>
          ) : null}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={PROJECT_PHOTO_ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={(event) => void handlePhotoSelected(event)}
        disabled={!canManage || isUploading || isDeleting}
      />
    </div>
  );
}
