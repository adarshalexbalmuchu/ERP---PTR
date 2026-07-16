import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapInventoryStock } from '../lib/mappers';
import { postOpeningBalance as postOpeningBalanceRpc } from '../lib/inventoryRpc';
import { logInventoryAction } from '../lib/audit';
import useStore from '../store/useStore';
import type { InventoryStock } from '../types';

// RLS (inventory_stock_staff_read / inventory_stock_director) already scopes
// which rows come back — director sees everything, inventory_staff only
// their assigned locations — so this query never needs a client-side filter.
export function useInventoryStock() {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['inventory-stock'],
    queryFn: async (): Promise<InventoryStock[]> => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select('*, inventory_items(name, unit_id, min_stock, reorder_level, inventory_units(abbreviation, allows_fractional)), inventory_locations(name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data.map(mapInventoryStock);
    },
  });

  const channelId = useRef(crypto.randomUUID()).current;
  useEffect(() => {
    const channel = supabase
      .channel(`inventory-stock-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_stock' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, channelId]);

  const postOpeningBalance = useMutation({
    mutationFn: async (args: Parameters<typeof postOpeningBalanceRpc>[0]) => {
      const applied = await postOpeningBalanceRpc(args);
      // A retried call recognized as a duplicate (applied === false) must
      // not re-send the audit entry a second time.
      if (!applied) return;
      if (currentUser) {
        await logInventoryAction(currentUser.id, 'inventory_opening_balance_posted', `Posted opening balance of ${args.quantity} unit(s)`, {
          itemId: args.itemId,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
    },
  });

  return { stock, isLoading, postOpeningBalance };
}
