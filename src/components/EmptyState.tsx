
import { ClipboardList } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export default function EmptyState({ title, description, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-ptr-cream-dark flex items-center justify-center mb-4 text-ptr-brown-light">
        {icon || <ClipboardList className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-semibold text-ptr-brown mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-ptr-brown-light max-w-xs">{description}</p>
      )}
    </div>
  );
}
