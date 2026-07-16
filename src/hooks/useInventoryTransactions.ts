import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapInventoryTransaction } from '../lib/mappers';
import type { InventoryTransaction } from '../types';

// Immutable ledger, read-only from the client (see inventory_transactions_*
// RLS in schema.sql) — every write happens inside the issue/opening-balance
// RPCs, never a direct insert from here.
export function useInventoryTransactions() {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: async (): Promise<InventoryTransaction[]> => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('*, inventory_items(name), inventory_locations(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data.map(mapInventoryTransaction);
    },
  });

  return { transactions, isLoading };
}
