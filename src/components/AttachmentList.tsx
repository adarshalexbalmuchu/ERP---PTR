import { type ChangeEvent } from 'react';
import { X, Image, FileText, File, Upload } from 'lucide-react';
import type { Attachment } from '../types';
import { formatFileSize } from '../utils/formatters';

interface Props {
  attachments: Attachment[];
  canUpload?: boolean;
  canRemove?: boolean;
  onUpload?: (files: FileList) => void;
  onRemove?: (id: string) => void;
}

function FileTypeIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
  if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

export default function AttachmentList({
  attachments,
  canUpload,
  canRemove,
  onUpload,
  onRemove,
}: Props) {
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUpload) {
      onUpload(e.target.files);
      e.target.value = '';
    }
  };

  if (attachments.length === 0 && !canUpload) {
    return <p className="text-sm text-ptr-brown-light italic">No attachments.</p>;
  }

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 bg-ptr-cream border border-ptr-cream-dark rounded-xl px-3 py-2"
            >
              {att.previewUrl ? (
                <a href={att.previewUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="w-8 h-8 rounded-lg object-cover border border-ptr-cream-dark"
                  />
                </a>
              ) : (
                <span className="text-ptr-brown-light">
                  <FileTypeIcon type={att.type} />
                </span>
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-ptr-brown truncate max-w-[120px]">
                  {att.name}
                </div>
                <div className="text-xs text-ptr-brown-light">{formatFileSize(att.size)}</div>
              </div>
              {canRemove && onRemove && (
                <button
                  onClick={() => onRemove(att.id)}
                  className="p-0.5 rounded-lg hover:bg-ptr-cream-dark text-ptr-brown-light hover:text-red-600 transition-colors flex-shrink-0"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canUpload && onUpload && (
        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-ptr-cream-dark rounded-xl text-sm text-ptr-brown-light hover:bg-ptr-cream cursor-pointer transition-colors min-h-[44px]">
          <Upload className="w-4 h-4" />
          <span>Upload file</span>
          <input
            type="file"
            className="sr-only"
            multiple
            onChange={handleFileInput}
          />
        </label>
      )}
    </div>
  );
}
