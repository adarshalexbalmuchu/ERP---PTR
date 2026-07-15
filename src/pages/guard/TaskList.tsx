import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import MobileTaskList from '../mobile/MobileTaskList';

// The bottom-nav "Tasks" tab for field personnel — a full task list distinct
// from the curated "Home" screen. Guards only ever see their own assigned
// tasks (RLS-scoped already at the query layer), so no assignee column/filter.
export default function GuardTaskList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tasks, isLoading } = useTasks();
  const { users } = useUsers();
  const { ranges, areas } = useRanges();

  return (
    <MobileTaskList
      title="My tasks"
      tasks={tasks}
      users={users}
      ranges={ranges}
      areas={areas}
      showAssignee={false}
      loading={isLoading && tasks.length === 0}
      onOpen={(t) => navigate(`/guard/tasks/${t.id}`)}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
    />
  );
}
