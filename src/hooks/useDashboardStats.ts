import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DashboardStats {
  totalTasks: number;
  criticalCount: number;
  inProgressCount: number;
  completedCount: number;
  archivedCount: number;
  overdueCount: number;
}

export interface RangeStat {
  rangeId: string;
  rangeName: string;
  total: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  archivedCount: number;
  completed: number;
  overdue: number;
}

// Reads the task_dashboard_stats / task_range_stats Postgres views instead
// of fetching every task row and counting client-side — stays fast as task
// history grows into the thousands. RLS on the underlying tasks table still
// scopes results per role (see security_invoker in schema.sql).
export function useDashboardStats() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.from('task_dashboard_stats').select('*').single();
      if (error) throw error;
      return {
        totalTasks: data.total_tasks,
        criticalCount: data.critical_count,
        inProgressCount: data.in_progress_count,
        completedCount: data.completed_count,
        archivedCount: data.archived_count,
        overdueCount: data.overdue_count,
      };
    },
  });

  const { data: rangeStats = [], isLoading: rangeStatsLoading } = useQuery({
    queryKey: ['dashboard-range-stats'],
    queryFn: async (): Promise<RangeStat[]> => {
      const { data, error } = await supabase.from('task_range_stats').select('*');
      if (error) throw error;
      return data.map((r) => ({
        rangeId: r.range_id,
        rangeName: r.range_name,
        total: r.total,
        notStartedCount: r.not_started_count,
        inProgressCount: r.in_progress_count,
        completedCount: r.completed_count,
        archivedCount: r.archived_count,
        completed: r.completed,
        overdue: r.overdue,
      }));
    },
  });

  return { stats, rangeStats, loading: statsLoading || rangeStatsLoading };
}
