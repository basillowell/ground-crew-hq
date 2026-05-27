import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ChemicalApplicationLog } from '@/data/seedData';

type ChemicalLogRow = ChemicalApplicationLog & {
  org_id?: string | null;
  property_id?: string | null;
};

export function useChemicalLogs(orgId?: string, propertyId?: string) {
  return useQuery({
    queryKey: ['chemical-logs', orgId ?? 'no-org', propertyId ?? 'all-properties'],
    enabled: Boolean(orgId),
    retry: false,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!orgId) return [] as ChemicalLogRow[];

      let query = supabase
        .from('chemical_application_logs')
        .select('*')
        .eq('org_id', orgId)
        .order('applicationDate', { ascending: false });
      // property_id is not part of the documented chemical_application_logs schema.
      // Keep reads org-scoped and let page-level filters apply operational context.
      void propertyId;

      const { data, error } = await query;
      if (error) {
        console.error('[chemical_application_logs] query failed', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw new Error(error.message);
      }

      return (data as ChemicalLogRow[] | null) ?? [];
    },
  });
}
