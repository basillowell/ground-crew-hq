export function handleSupabaseError(error: any, context: string): string {
  if (!error) return '';
  const msg = error.message || error.details || 'Unknown error';
  console.error(`[${context}]`, msg, error);
  return msg;
}

