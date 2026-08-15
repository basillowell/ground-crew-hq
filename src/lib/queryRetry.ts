export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out/i.test(error.message);
}

export function retryTimeoutOnly(failureCount: number, error: unknown): boolean {
  return isTimeoutError(error) && failureCount < 2; // one retry on timeout
}

export const timeoutRetryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 4000);
