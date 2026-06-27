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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
