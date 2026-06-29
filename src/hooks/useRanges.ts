import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Range, Area } from '../types';

export function useRanges() {
  const { data: ranges = [], isLoading: rangesLoading } = useQuery({
    queryKey: ['ranges'],
    queryFn: async (): Promise<Range[]> => {
      const { data, error } = await supabase.from('ranges').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase.from('areas').select('id, range_id, name').order('name');
      if (error) throw error;
      return data.map((a) => ({ id: a.id, rangeId: a.range_id, name: a.name }));
    },
  });

  return { ranges, areas, loading: rangesLoading || areasLoading };
}
