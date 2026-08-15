export type AbortableSupabaseRequest<T extends PromiseLike<unknown>> = T & {
  abortSignal: (signal: AbortSignal) => T;
};

export async function withRequestTimeout<T extends PromiseLike<unknown>>(
  request: AbortableSupabaseRequest<T>,
  timeoutMessage: string,
  timeoutMs = 15_000,
): Promise<Awaited<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timeoutMessage);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
