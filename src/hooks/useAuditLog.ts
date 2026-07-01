import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapAuditLogEntry } from '../lib/mappers';
import type { AuditLogEntry } from '../types';

// RLS restricts this to director (all) / range_officer (their range only);
// guards get zero rows back, matching the "management-only" visibility
// this log is meant for.
export function useAuditLog() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data.map(mapAuditLogEntry);
    },
  });

  return { entries, isLoading };
}
