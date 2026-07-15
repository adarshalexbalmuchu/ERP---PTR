import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), 'dd MMM yyyy');
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  try {
    return format(parseISO(isoString), 'dd MMM yyyy, hh:mm a');
  } catch {
    return isoString;
  }
}

export function formatRelative(isoString: string): string {
  try {
    return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
  } catch {
    return isoString;
  }
}

// Whole calendar days between today and a due date (positive = future).
function dueDayDelta(isoString: string): number {
  const due = parseISO(isoString);
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(due); d1.setHours(0, 0, 0, 0);
  return Math.round((d1.getTime() - d0.getTime()) / 86_400_000);
}

export type DueTone = 'overdue' | 'soon' | 'normal';

// Operational due-date phrasing: "2 days overdue" / "Due today" / "Due
// tomorrow" / neutral future date. `tone` drives colour (red/amber/neutral).
export function formatDueRelative(isoString: string, isDone = false): { text: string; tone: DueTone } {
  try {
    const delta = dueDayDelta(isoString);
    if (isDone) return { text: '', tone: 'normal' };
    if (delta < 0) {
      const n = Math.abs(delta);
      return { text: n === 1 ? '1 day overdue' : `${n} days overdue`, tone: 'overdue' };
    }
    if (delta === 0) return { text: 'Due today', tone: 'soon' };
    if (delta === 1) return { text: 'Due tomorrow', tone: 'soon' };
    if (delta <= 3) return { text: `Due in ${delta} days`, tone: 'soon' };
    return { text: '', tone: 'normal' };
  } catch {
    return { text: '', tone: 'normal' };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
