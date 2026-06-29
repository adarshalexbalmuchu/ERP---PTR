import { useState, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import useStore from '../store/useStore';
import type { Task, User, TaskPriority, TaskCategory } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Task, 'id' | 'createdAt' | 'comments' | 'attachments' | 'taskUpdates'>) => void;
  assignableUsers: User[];
  initialData?: Task | null;
  currentUserId: string;
  defaultRangeId?: string;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Critical', label: 'Critical' },
];

const CATEGORIES: TaskCategory[] = [
  'Patrol',
  'Camera Trap',
  'Survey',
  'Maintenance',
  'Admin',
  'Other',
];

export default function TaskForm({
  isOpen,
  onClose,
  onSave,
  assignableUsers,
  initialData,
  currentUserId,
  defaultRangeId,
}: Props) {
  const ranges = useStore((s) => s.ranges);
  const areas = useStore((s) => s.areas);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [rangeId, setRangeId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [category, setCategory] = useState<TaskCategory>('Patrol');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredAreas = areas.filter((a) => a.rangeId === rangeId);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title ?? '');
      setDescription(initialData?.description ?? '');
      setAssigneeId(initialData?.assigneeId ?? '');
      setRangeId(initialData?.rangeId ?? defaultRangeId ?? '');
      setAreaId(initialData?.areaId ?? '');
      setPriority(initialData?.priority ?? 'Medium');
      setCategory(initialData?.category ?? 'Patrol');
      setDueDate(initialData?.dueDate ? initialData.dueDate.substring(0, 10) : '');
      setErrors({});
    }
  }, [isOpen, initialData, defaultRangeId]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!assigneeId) errs.assigneeId = 'Please select an assignee';
    if (!rangeId) errs.rangeId = 'Please select a range';
    if (!dueDate) errs.dueDate = 'Due date is required';
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({
      title: title.trim(),
      description: description.trim(),
      assigneeId,
      createdById: currentUserId,
      rangeId,
      areaId: areaId || undefined,
      status: initialData?.status ?? 'NotStarted',
      priority,
      category,
      dueDate: new Date(dueDate + 'T00:00:00').toISOString(),
      completionPercentage: initialData?.completionPercentage ?? 0,
      acknowledgedAt: initialData?.acknowledgedAt,
      completedAt: initialData?.completedAt,
      archivedAt: initialData?.archivedAt,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-ptr-cream-dark">
          <h2 className="text-lg font-semibold text-ptr-brown">
            {initialData ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-ptr-cream transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-ptr-brown-light" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })); }}
              placeholder="Enter task title"
              className={`input-field ${errors.title ? 'input-error' : ''}`}
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task in detail..."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">
              Assign To <span className="text-red-500">*</span>
            </label>
            <select
              value={assigneeId}
              onChange={(e) => { setAssigneeId(e.target.value); setErrors((p) => ({ ...p, assigneeId: '' })); }}
              className={`input-field ${errors.assigneeId ? 'input-error' : ''}`}
            >
              <option value="">Select staff member</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.designation}
                </option>
              ))}
            </select>
            {errors.assigneeId && <p className="text-xs text-red-600 mt-1">{errors.assigneeId}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">
                Range <span className="text-red-500">*</span>
              </label>
              <select
                value={rangeId}
                onChange={(e) => { setRangeId(e.target.value); setAreaId(''); setErrors((p) => ({ ...p, rangeId: '' })); }}
                className={`input-field ${errors.rangeId ? 'input-error' : ''}`}
                disabled={!!defaultRangeId}
              >
                <option value="">Select range</option>
                {ranges.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {errors.rangeId && <p className="text-xs text-red-600 mt-1">{errors.rangeId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Area / Zone</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="input-field"
                disabled={!rangeId}
              >
                <option value="">All areas</option>
                {filteredAreas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="input-field"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="input-field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); setErrors((p) => ({ ...p, dueDate: '' })); }}
              className={`input-field ${errors.dueDate ? 'input-error' : ''}`}
            />
            {errors.dueDate && <p className="text-xs text-red-600 mt-1">{errors.dueDate}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-ptr-cream-dark">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">
              {initialData ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
