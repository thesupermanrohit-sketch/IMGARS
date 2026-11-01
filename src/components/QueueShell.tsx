import React from 'react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useForgeStore } from '../store/useForgeStore';
import { useDndSensors } from '../hooks/useDndSensors';
import { formatSizeDelta } from '../utils/formatSizeDelta';
import { downloadBlob } from '../utils/downloadBlob';
import { SortableImageCard } from './SortableImageCard';
import { getQueueItemMode } from '../utils/queueMode';

interface QueueShellProps {
  actionLabel: string;
  processingLabel: string;
  controlsSlot?: React.ReactNode;
}

export function QueueShell({
  actionLabel,
  processingLabel,
  controlsSlot,
}: QueueShellProps) {
  const allItems = useForgeStore((state) => state.queue);
  const activeTab = useForgeStore((state) => state.activeTab);
  const queue = allItems.filter((item) => getQueueItemMode(item) === activeTab);
  const isProcessingAll = useForgeStore((state) => state.isProcessingAll);
  const processAll = useForgeStore((state) => state.processAll);
  const clearQueue = useForgeStore((state) => state.clearQueue);
  const removeFile = useForgeStore((state) => state.removeFile);
  const reorderQueue = useForgeStore((state) => state.reorderQueue);
  const getDownloadItem = useForgeStore((state) => state.getDownloadItem);

  const sensors = useDndSensors();

  if (queue.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    reorderQueue(String(active.id), String(over.id));
  };

  const handleDownloadItem = async (id: string) => {
    const downloadInfo = await getDownloadItem(id);
    if (downloadInfo) {
      downloadBlob(downloadInfo.blob, downloadInfo.fileName);
    }
  };

  return (
    <div className="flex flex-col gap-5 mt-2">
      {/* Queue Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[#1f1f1f] pb-3 flex-wrap">
        <h2 className="text-sm font-medium text-white tracking-wide">
          Queue <span className="text-[#666666] font-normal">({queue.length} files)</span>
        </h2>

        <div className="flex items-center gap-4">
          <button
            onClick={clearQueue}
            disabled={isProcessingAll}
            className="text-xs text-[#666666] hover:text-[#ff4444] font-medium transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            Clear Queue
          </button>

          <button
            onClick={processAll}
            disabled={isProcessingAll || queue.length === 0}
            className="bg-white text-black px-3 py-1.5 text-xs font-medium rounded-none hover:bg-gray-200 transition-colors disabled:bg-[#1f1f1f] disabled:text-[#666666] disabled:cursor-not-allowed cursor-pointer"
          >
            {isProcessingAll ? processingLabel : actionLabel}
          </button>
        </div>
      </div>

      {/* Feature Controls Slot */}
      {controlsSlot}

      {/* Queue Cards with DndContext */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={queue.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {queue.map((item) => (
              <SortableImageCard
                key={item.id}
                id={item.id}
                name={item.name}
                previewUrl={item.previewUrl || ''}
                subtitle={formatSizeDelta(item)}
                skipMessage={item.skipReason ? `Skipped: ${item.skipReason}` : undefined}
                error={item.status === 'failed' ? item.error : undefined}
                onRemove={removeFile}
                onDownload={item.status === 'done' ? () => handleDownloadItem(item.id) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
