import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import useStore from '../store/useStore';

export interface MyInventoryLocation {
  id: string;
  name: string;
}

// Inventory access is capability-based, not role-based: the director
// always has full access; any other user (in practice, an existing guard)
// gets it only through an active inventory_location_staff assignment.
// Queried per-user (keyed on currentUser.id) so a different signed-in user
// never sees a stale/previous user's cached assignment list — on top of
// AuthContext's existing full queryClient.clear() on every sign-out.
export function useMyInventoryAccess() {
  const currentUser = useStore((s) => s.currentUser);
  const isDirector = currentUser?.role === 'director';

  const { data: assignedLocations = [], isLoading } = useQuery({
    queryKey: ['my-inventory-locations', currentUser?.id],
    queryFn: async (): Promise<MyInventoryLocation[]> => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from('inventory_location_staff')
        .select('inventory_locations(id, name)')
        .eq('user_id', currentUser.id)
        .eq('active', true);
      if (error) throw error;
      const rows = data as unknown as { inventory_locations: MyInventoryLocation | null }[];
      return rows
        .map((r) => r.inventory_locations)
        .filter((l): l is MyInventoryLocation => l !== null);
    },
    enabled: !!currentUser && !isDirector,
  });

  const hasInventoryAccess = isDirector || assignedLocations.length > 0;

  return {
    hasInventoryAccess,
    assignedLocations,
    isLoading: isDirector ? false : isLoading,
  };
}

const SELECTED_LOCATION_KEY = 'ptr-inventory-selected-location';

// A guard covering more than one location (e.g. one person assigned to two
// facilities) needs an explicit "which location am I working in right now"
// choice — stock/requests/transactions must never be silently merged across
// their assigned locations. A single-location guard is auto-selected with
// nothing to choose. Persisted per-user (not just per-browser) so signing
// in as a different account never inherits someone else's last pick.
export function useSelectedInventoryLocation() {
  const currentUser = useStore((s) => s.currentUser);
  const { assignedLocations, isLoading } = useMyInventoryAccess();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || isLoading) return;
    if (assignedLocations.length === 0) {
      setSelectedId(null);
      return;
    }
    if (assignedLocations.length === 1) {
      setSelectedId(assignedLocations[0].id);
      return;
    }
    const stored = localStorage.getItem(`${SELECTED_LOCATION_KEY}:${currentUser.id}`);
    setSelectedId(stored && assignedLocations.some((l) => l.id === stored) ? stored : null);
  }, [currentUser, isLoading, assignedLocations]);

  const selectLocation = (locationId: string) => {
    if (currentUser) localStorage.setItem(`${SELECTED_LOCATION_KEY}:${currentUser.id}`, locationId);
    setSelectedId(locationId);
  };

  return {
    assignedLocations,
    selectedLocationId: selectedId,
    selectedLocation: assignedLocations.find((l) => l.id === selectedId) ?? null,
    selectLocation,
    needsSelection: !isLoading && assignedLocations.length > 1 && !selectedId,
    isLoading,
  };
}
