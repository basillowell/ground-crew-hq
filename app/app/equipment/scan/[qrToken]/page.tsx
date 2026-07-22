import { EquipmentScanActions } from '@/src/components/equipment/EquipmentScanActions';

export default async function EquipmentScanPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  return <EquipmentScanActions qrToken={qrToken} />;
}
