import { Button } from '@/components/ui/button';

type EquipmentQrCardProps = {
  qrToken?: string | null;
  scanUrl: string;
};

export function EquipmentQrCard({ qrToken, scanUrl }: EquipmentQrCardProps) {
  if (!qrToken || !scanUrl) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-elevated p-4 text-sm text-text-muted">
        This unit does not have a QR token yet.
      </div>
    );
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(scanUrl)}`;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="rounded-lg border border-surface-border bg-white p-2">
          <img src={qrImageUrl} alt="Equipment QR code" className="h-40 w-40" />
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="font-semibold text-text-primary">Field scan link</p>
          <p className="break-all text-xs text-text-muted">{scanUrl}</p>
          <p className="break-all text-[11px] uppercase tracking-[0.12em] text-text-muted">Token {qrToken}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(scanUrl)}
          >
            Copy link
          </Button>
        </div>
      </div>
    </div>
  );
}
