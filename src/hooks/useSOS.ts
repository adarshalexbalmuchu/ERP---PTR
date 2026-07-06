import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getCurrentPosition } from '../utils/geolocation';
import { useTasks } from './useTasks';
import { findActiveTask } from './useLiveLocation';
import useStore from '../store/useStore';
import type { NotificationType } from '../lib/database.types';

// Emergency alert triggered by a field-role user during an active patrol
// task — creates a Critical incident (visible on the map/incident log) and
// pushes an immediate notification to the Director and to Range Officers
// covering the task's range.
export function useSOS() {
  const currentUser = useStore((s) => s.currentUser);
  const { tasks } = useTasks();
  const queryClient = useQueryClient();
  const activeTask = currentUser ? findActiveTask(tasks, currentUser.id) : undefined;

  const trigger = useMutation({
    mutationFn: async () => {
      if (!currentUser || !activeTask) throw new Error('No active patrol task to attach this alert to.');
      const position = await getCurrentPosition();

      const { data: incident, error: incidentErr } = await supabase
        .from('incidents')
        .insert({
          type: 'other',
          severity: 'Critical',
          description: `SOS emergency alert triggered by ${currentUser.name} during "${activeTask.title}".`,
          range_id: activeTask.rangeId,
          area_id: activeTask.areaId ?? null,
          lat: position?.lat ?? null,
          lng: position?.lng ?? null,
          reported_by: currentUser.id,
        })
        .select()
        .single();
      if (incidentErr) throw incidentErr;

      const [{ data: directors }, { data: rangeOfficers }, { data: officerRangeRows }] = await Promise.all([
        supabase.from('profiles').select('id').eq('role', 'director'),
        supabase.from('profiles').select('id').eq('role', 'range_officer').eq('range_id', activeTask.rangeId),
        supabase.from('officer_ranges').select('user_id').eq('range_id', activeTask.rangeId),
      ]);

      const recipients = [
        ...new Set([
          ...(directors ?? []).map((r) => r.id),
          ...(rangeOfficers ?? []).map((r) => r.id),
          ...(officerRangeRows ?? []).map((r) => r.user_id),
        ]),
      ].filter((id) => id !== currentUser.id);

      if (recipients.length > 0) {
        const { error: notifyErr } = await supabase.from('notifications').insert(
          recipients.map((userId) => ({
            user_id: userId,
            type: 'sos_alert' as NotificationType,
            title: 'SOS EMERGENCY ALERT',
            message: `${currentUser.name} triggered an SOS during "${activeTask.title}".`,
            task_id: activeTask.id,
          })),
        );
        if (notifyErr) console.error('SOS notification insert failed', notifyErr);
      }

      return incident;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['map-incidents'] });
    },
  });

  return { trigger, canTrigger: !!activeTask };
}
