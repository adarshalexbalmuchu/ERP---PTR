import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { X, Upload, Image, FileText, File as FileIcon, Search, ChevronDown } from 'lucide-react';
import { useRanges } from '../hooks/useRanges';
import { formatFileSize } from '../utils/formatters';
import AttachmentList from './AttachmentList';
import type { Task, User, TaskPriority, TaskCategory } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Task, 'id' | 'createdAt' | 'comments' | 'attachments' | 'taskUpdates'>, files: File[]) => void;
  assignableUsers: User[];
  initialData?: Task | null;
  currentUserId: string;
  defaultRangeId?: string;
  /** Wire these up (from TaskDetailPage) to allow adding/removing attachments while editing an existing task. */
  onUploadAttachment?: (file: File) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
}

function PendingFileIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
  if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
  return <FileIcon className="w-4 h-4" />;
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
  onUploadAttachment,
  onRemoveAttachment,
}: Props) {
  const { ranges, areas } = useRanges();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeBoxRef = useRef<HTMLDivElement>(null);
  const [rangeId, setRangeId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [category, setCategory] = useState<TaskCategory>('Patrol');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const filteredAreas = areas.filter((a) => a.rangeId === rangeId);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title ?? '');
      setDescription(initialData?.description ?? '');
      setAssigneeIds(
        initialData ? [initialData.assigneeId, ...initialData.coAssigneeIds] : [],
      );
      setAssigneeSearch('');
      setAssigneeDropdownOpen(false);
      setRangeId(initialData?.rangeId ?? defaultRangeId ?? '');
      setAreaId(initialData?.areaId ?? '');
      setPriority(initialData?.priority ?? 'Medium');
      setCategory(initialData?.category ?? 'Patrol');
      setDueDate(initialData?.dueDate ? initialData.dueDate.substring(0, 10) : '');
      setErrors({});
      setPendingFiles([]);
    }
  }, [isOpen, initialData, defaultRangeId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assigneeBoxRef.current && !assigneeBoxRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleAssignee = (userId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
    setErrors((p) => ({ ...p, assigneeIds: '' }));
  };

  const removeAssignee = (userId: string) => {
    setAssigneeIds((prev) => prev.filter((id) => id !== userId));
  };

  const filteredAssignableUsers = assignableUsers.filter((u) => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.designation.toLowerCase().includes(q);
  });

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = '';
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (assigneeIds.length === 0) errs.assigneeIds = 'Please select at least one assignee';
    if (!rangeId) errs.rangeId = 'Please select a range';
    if (!dueDate) errs.dueDate = 'Due date is required';
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const [assigneeId, ...coAssigneeIds] = assigneeIds;
    onSave({
      title: title.trim(),
      description: description.trim(),
      assigneeId,
      coAssigneeIds,
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
    }, pendingFiles);
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
              maxLength={300}
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
              maxLength={5000}
              className="input-field resize-none"
            />
          </div>

          <div ref={assigneeBoxRef} className="relative">
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">
              Assign To <span className="text-red-500">*</span>
              <span className="text-ptr-brown-light font-normal"> (select one or more)</span>
            </label>

            {assigneeIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assigneeIds.map((uid) => {
                  const u = assignableUsers.find((x) => x.id === uid);
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1.5 bg-ptr-green/10 text-ptr-green text-xs font-medium rounded-full pl-3 pr-1.5 py-1"
                    >
                      {u?.name ?? 'Unknown user'}
                      <button
                        type="button"
                        onClick={() => removeAssignee(uid)}
                        className="p-0.5 rounded-full hover:bg-ptr-green/20 transition-colors"
                        aria-label={`Remove ${u?.name ?? 'assignee'}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ptr-brown-light pointer-events-none" />
              <input
                type="text"
                value={assigneeSearch}
                onChange={(e) => { setAssigneeSearch(e.target.value); setAssigneeDropdownOpen(true); }}
                onFocus={() => setAssigneeDropdownOpen(true)}
                placeholder={`Search ${assignableUsers.length} staff by name or designation…`}
                className={`input-field pl-9 pr-9 ${errors.assigneeIds ? 'input-error' : ''}`}
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ptr-brown-light pointer-events-none" />
            </div>

            {assigneeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-ptr-cream-dark rounded-xl shadow-lg">
                {filteredAssignableUsers.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-ptr-brown-light">No matching staff found</p>
                ) : (
                  filteredAssignableUsers.map((u) => {
                    const selected = assigneeIds.includes(u.id);
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => toggleAssignee(u.id)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-ptr-cream transition-colors ${
                          selected ? 'bg-ptr-green/5' : ''
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-ptr-brown truncate">{u.name}</span>
                          <span className="block text-xs text-ptr-brown-light truncate">{u.designation}</span>
                        </span>
                        {selected && <span className="text-ptr-green text-xs font-semibold flex-shrink-0">Selected</span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {errors.assigneeIds && <p className="text-xs text-red-600 mt-1">{errors.assigneeIds}</p>}
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

          {!initialData && (
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">
                Attachments <span className="text-ptr-brown-light font-normal">(optional — documents for the assignee to work from)</span>
              </label>
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pendingFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2 bg-ptr-cream border border-ptr-cream-dark rounded-xl px-3 py-2"
                    >
                      <span className="text-ptr-brown-light"><PendingFileIcon type={file.type} /></span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-ptr-brown truncate max-w-[140px]">{file.name}</div>
                        <div className="text-xs text-ptr-brown-light">{formatFileSize(file.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="p-0.5 rounded-lg hover:bg-ptr-cream-dark text-ptr-brown-light hover:text-red-600 transition-colors flex-shrink-0"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-ptr-cream-dark rounded-xl text-sm text-ptr-brown-light hover:bg-ptr-cream cursor-pointer transition-colors min-h-[44px]">
                <Upload className="w-4 h-4" />
                <span>Upload PDF, image, or Excel/Word document</span>
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                  multiple
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          )}

          {initialData && onUploadAttachment && onRemoveAttachment && (
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">
                Attachments <span className="text-ptr-brown-light font-normal">(add or remove documents freely)</span>
              </label>
              <AttachmentList
                attachments={initialData.attachments}
                canUpload
                canRemove
                onUpload={(files) => Array.from(files).forEach((f) => onUploadAttachment(f))}
                onRemove={onRemoveAttachment}
              />
            </div>
          )}

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
