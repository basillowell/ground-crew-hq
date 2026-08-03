import { useRouter, useSearchParams } from 'next/navigation';
import { OpenTaskDayReviewPanel } from '@/components/workboard/OpenTaskDayReviewPanel';

export default function OpenTaskDayReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <OpenTaskDayReviewPanel
      employeeId={searchParams.get('employeeId')}
      date={searchParams.get('date')}
      showBackButton
      onBack={() => router.push('/app/open-tasks')}
    />
  );
}
