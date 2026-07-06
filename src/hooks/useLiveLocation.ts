import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapLiveLocation } from '../lib/mappers';
import { useTasks } from './useTasks';
import useStore from '../store/useStore';
import { isFieldRole } from '../types';
import type { LiveLocation, Task } from '../types';

// Only re-upsert this often at most, even if the GPS callback fires more
// frequently — keeps writes light without meaningfully hurting freshness.
const MIN_UPDATE_INTERVAL_MS = 30_000;
// A location older than this is shown as "last known" rather than live —
// see STALE_AFTER_MS usage in MapView.
export const STALE_AFTER_MS = 15 * 60 * 1000;

// The task a user is actively patrolling right now, if any — drives where
// useLocationSharing reports position.
export function findActiveTask(tasks: Task[], userId: string): Task | undefined {
  return tasks.find(
    (t) => t.status === 'InProgress' && (t.assigneeId === userId || t.coAssigneeIds.includes(userId)),
  );
}

// Shares the signed-in field-role user's live location for as long as they
// have an active (InProgress) patrol task — visible only to their Director
// and Range Officer (see live_locations RLS in schema.sql). This is fully
// disclosed: callers must render the "sharing" indicator this returns
// (isSharing) wherever this hook is used — there is no hidden variant.
export function useLocationSharing() {
  const currentUser = useStore((s) => s.currentUser);
  const { tasks } = useTasks();
  const [isSharing, setIsSharing] = useState(false);
  const lastSentAt = useRef(0);

  const activeTask = currentUser ? findActiveTask(tasks, currentUser.id) : undefined;

  useEffect(() => {
    if (!currentUser || !isFieldRole(currentUser.role) || !activeTask) {
      setIsSharing(false);
      return;
    }
    if (!('geolocation' in navigator)) {
      setIsSharing(false);
      return;
    }

    const taskId = activeTask.id;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentAt.current < MIN_UPDATE_INTERVAL_MS) return;
        lastSentAt.current = now;
        void supabase
          .from('live_locations')
          .upsert(
            {
              user_id: currentUser.id,
              task_id: taskId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            },
            { onConflict: 'user_id' },
          )
          .then(({ error }) => {
            if (error) console.error('live_locations upsert failed', error);
            else setIsSharing(true);
          });
      },
      () => setIsSharing(false),
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsSharing(false);
    };
  }, [currentUser, activeTask?.id]);

  return { isSharing, activeTask };
}

// Director/Range-officer side: polls everyone's current live location.
// RLS already scopes rows to what the caller is allowed to see, so this
// query returns nothing for a field-role user.
export function useLiveLocations() {
  const currentUser = useStore((s) => s.currentUser);
  const enabled = currentUser?.role === 'director' || currentUser?.role === 'range_officer';

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['live-locations'],
    queryFn: async (): Promise<LiveLocation[]> => {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*, profiles(name, avatar_initials, designation), tasks(title)');
      if (error) throw error;
      return data.map(mapLiveLocation);
    },
    enabled,
    refetchInterval: 20_000,
  });

  return { locations, isLoading };
}
