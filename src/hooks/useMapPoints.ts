import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Incident, IncidentSeverity, IncidentType } from '../types';

export interface PatrolPoint {
  id: string;
  taskId: string;
  taskTitle: string;
  note: string;
  progressPercentage: number;
  lat: number;
  lng: number;
  createdAt: string;
}

// Both queries rely on existing RLS on incidents/task_updates/tasks — a
// guard only ever sees their own range's points, same as everywhere else.
export function useMapPoints() {
  const { data: incidents = [], isLoading: incidentsLoading } = useQuery({
    queryKey: ['map-incidents'],
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        type: row.type as IncidentType,
        severity: row.severity as IncidentSeverity,
        description: row.description,
        rangeId: row.range_id,
        areaId: row.area_id ?? undefined,
        lat: row.lat ?? undefined,
        lng: row.lng ?? undefined,
        reportedBy: row.reported_by,
        incidentDate: row.incident_date,
        createdAt: row.created_at,
      }));
    },
  });

  const { data: patrolPoints = [], isLoading: patrolLoading } = useQuery({
    queryKey: ['map-patrol-points'],
    queryFn: async (): Promise<PatrolPoint[]> => {
      const { data, error } = await supabase
        .from('task_updates')
        .select('id, task_id, note, progress_percentage, lat, lng, created_at')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const points = data.filter(
        (row): row is typeof row & { lat: number; lng: number } => row.lat !== null && row.lng !== null,
      );
      const taskIds = [...new Set(points.map((p) => p.task_id))];
      const titleById = new Map<string, string>();
      if (taskIds.length > 0) {
        const { data: taskRows } = await supabase.from('tasks').select('id, title').in('id', taskIds);
        for (const t of taskRows ?? []) titleById.set(t.id, t.title);
      }

      return points.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        taskTitle: titleById.get(row.task_id) ?? 'Untitled task',
        note: row.note,
        progressPercentage: row.progress_percentage,
        lat: row.lat,
        lng: row.lng,
        createdAt: row.created_at,
      }));
    },
  });

  return { incidents, patrolPoints, loading: incidentsLoading || patrolLoading };
}
