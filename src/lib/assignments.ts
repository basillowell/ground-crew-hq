export const PAYROLL_SUBMITTED_LOCK_MESSAGE = 'Submitted to payroll \u2014 locked (review only)';

export function getAssignmentApprovedAt(
  assignment?: { approvedAt?: string | null; approved_at?: string | null } | null,
) {
  return assignment?.approvedAt ?? assignment?.approved_at ?? null;
}
