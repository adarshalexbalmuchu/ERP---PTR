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
// Below this age a pin is shown as actively "Live" — set a little above
// MIN_UPDATE_INTERVAL_MS to allow for normal network latency between fixes.
export const FRESH_AFTER_MS = 90 * 1000;
// A location older than this is shown as "no signal" rather than merely
// stale — see STALE_AFTER_MS usage in MapView.
export const STALE_AFTER_MS = 15 * 60 * 1000;

// localStorage key for the single most recent GPS fix that failed to
// reach Supabase (no network — a common case for a patrol walking through
// a no-signal zone in the reserve). Only the LATEST fix is ever kept: since
// live_locations stores one current-position row per user rather than a
// track log, an older queued fix would just be overwritten by the time it
// could be flushed anyway.
const PENDING_LOCATION_KEY = 'ptr-pending-location';

interface PendingLocation {
  userId: string;
  taskId: string;
  lat: number;
  lng: number;
}

function savePendingLocation(p: PendingLocation): void {
  try {
    window.localStorage.setItem(PENDING_LOCATION_KEY, JSON.stringify(p));
  } catch {
    // localStorage unavailable (private browsing etc.) — the next
    // successful GPS fix will just upload normally instead.
  }
}

function loadPendingLocation(): PendingLocation | null {
  try {
    const raw = window.localStorage.getItem(PENDING_LOCATION_KEY);
    return raw ? (JSON.parse(raw) as PendingLocation) : null;
  } catch {
    return null;
  }
}

function clearPendingLocation(): void {
  try {
    window.localStorage.removeItem(PENDING_LOCATION_KEY);
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}

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
//
// A GPS fix taken with no network reachable (a dead zone inside the
// reserve) would otherwise just be dropped — supabase-js has no built-in
// offline queue for a plain .upsert() the way React Query mutations do.
// This keeps the latest such fix in localStorage and retries it the moment
// the browser reports 'online' again, so a brief dead zone doesn't leave
// the director looking at a position that's stale by a full patrol leg.
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

    const userId = currentUser.id;
    const taskId = activeTask.id;

    const upload = (lat: number, lng: number) =>
      supabase
        .from('live_locations')
        .upsert({ user_id: userId, task_id: taskId, lat, lng }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) {
            console.error('live_locations upsert failed', error);
            savePendingLocation({ userId, taskId, lat, lng });
            setIsSharing(false);
          } else {
            clearPendingLocation();
            setIsSharing(true);
          }
        });

    // A fix already queued from before this task/session — most likely
    // left behind by a dead zone the app was closed during. Try it once
    // up front rather than waiting for the next GPS callback (which may be
    // MIN_UPDATE_INTERVAL_MS away) or for another 'offline' → 'online'
    // transition that might not happen again for a while.
    const pending = loadPendingLocation();
    if (pending && pending.userId === userId && pending.taskId === taskId) {
      void upload(pending.lat, pending.lng);
    } else if (pending) {
      clearPendingLocation(); // stale — belongs to a different task/user
    }

    const flushPending = () => {
      const p = loadPendingLocation();
      if (p && p.userId === userId && p.taskId === taskId) void upload(p.lat, p.lng);
    };
    window.addEventListener('online', flushPending);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentAt.current < MIN_UPDATE_INTERVAL_MS) return;
        lastSentAt.current = now;
        void upload(pos.coords.latitude, pos.coords.longitude);
      },
      () => setIsSharing(false),
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('online', flushPending);
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
