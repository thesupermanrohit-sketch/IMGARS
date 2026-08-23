import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Download, GripVertical, X } from 'lucide-react';

export interface SortableImageCardProps {
  id: string;
  name: string;
  previewUrl: string;
  subtitle: string;
  error?: string;
  skipMessage?: string;
  onRemove: (id: string) => void;
  onDownload?: () => void;
}

export const SortableImageCard: React.FC<SortableImageCardProps> = ({
  id,
  name,
  previewUrl,
  subtitle,
  error,
  skipMessage,
  onRemove,
  onDownload,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#111111] border border-[#1f1f1f] rounded-none p-3 grid grid-cols-[72px_1fr] sm:grid-cols-[88px_1fr_auto] gap-3 items-center"
    >
      <img
        src={previewUrl}
        alt=""
        className="w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] object-cover bg-[#0a0a0a]"
      />

      <div className="min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate" title={name}>
            {name}
          </p>
          <p className="text-xs text-[#666666]">{subtitle}</p>
          {skipMessage && <p className="text-xs text-[#888888] mt-0.5">{skipMessage}</p>}
          {error && <p className="text-xs text-[#ff4444] mt-0.5">{error}</p>}
        </div>
      </div>


      <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-4">
        {onDownload && (
          <button
            type="button"
            title="Download"
            aria-label={`Download ${name}`}
            onClick={onDownload}
            className="text-[#666666] hover:text-white transition-colors focus-visible:outline-none focus-visible:text-white p-0.5"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          title="Drag to reorder"
          aria-label={`Drag to reorder ${name}`}
          className="text-[#666666] hover:text-white cursor-grab touch-none focus-visible:outline-none focus-visible:text-white p-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Remove"
          aria-label={`Remove ${name} from queue`}
          onClick={() => onRemove(id)}
          className="text-[#ff4444] hover:text-white transition-colors focus-visible:outline-none focus-visible:text-white p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
