import React, { useState, useEffect, useMemo } from 'react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Info } from 'lucide-react';
import { useForgeStore } from '../store/useForgeStore';
import type { OutputFormat } from '../features/convert/types';
import { getSupportedFormats } from '../features/convert/formatSupport';
import type { CompressResolutionPreset } from '../features/compress/types';
import { formatBytes } from '../utils/formatBytes';
import { downloadBlob } from '../utils/downloadBlob';
import { useDndSensors } from '../hooks/useDndSensors';
import { SegmentedControl, type SegmentedControlOption } from './SegmentedControl';
import { SortableImageCard } from './SortableImageCard';

function DimensionInfoTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleClose = () => {
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleClose, { capture: true, passive: true });
    window.addEventListener('click', handleClose);
    window.addEventListener('touchstart', handleClose);

    return () => {
      window.removeEventListener('scroll', handleClose, { capture: true });
      window.removeEventListener('click', handleClose);
      window.removeEventListener('touchstart', handleClose);
    };
  }, [isOpen]);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-[#666666] hover:text-white transition-colors focus:outline-none focus:text-white p-0.5 inline-flex items-center justify-center cursor-pointer"
        aria-label="Dimension info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full mb-2.5 left-0 sm:left-1/2 sm:-translate-x-1/2 p-3 bg-[#161616] border border-[#2a2a2a] rounded-md shadow-xl text-left text-xs z-50 pointer-events-none w-[260px] sm:w-[270px] max-w-[calc(100vw-3rem)]"
        >
          <div className="flex flex-col gap-1.5 text-[11px]">
            <p className="text-[#999999] leading-snug">
              <span className="text-white font-medium">• Web</span> — 1024 px (recommended for websites and sharing)
            </p>
            <p className="text-[#999999] leading-snug">
              <span className="text-white font-medium">• HD</span> — 1920 px (recommended for higher-quality viewing)
            </p>
          </div>
          <div className="absolute top-full left-2 sm:left-1/2 sm:-translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-[#2a2a2a]" />
        </div>
      )}
    </span>
  );
}

const formatOptions: SegmentedControlOption<OutputFormat>[] = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'png', label: 'PNG' },
];

const dimensionOptions: SegmentedControlOption<CompressResolutionPreset>[] = [
  { value: 'web', label: 'Web' },
  { value: 'fullHd', label: 'HD' },
];

export const QueueList: React.FC = () => {
  const {
    queue,
    activeTab,
    isProcessingAll,
    processAll,
    clearQueue,
    removeFile,
    reorderQueue,
    getDownloadItem,
    globalConvertFormat,
    setGlobalConvertFormat,
    compressTargetSizeKb,
    setCompressTargetSizeKb,
    compressResolutionPreset,
    setCompressResolutionPreset,
    increaseSizeTargetSizeKb,
    setIncreaseSizeTargetSizeKb,
  } = useForgeStore();

  const [customTargetInput, setCustomTargetInput] = useState<string>('');
  const [customIncreaseTargetInput, setCustomIncreaseTargetInput] = useState<string>('');
  const [supportedFormats, setSupportedFormats] = useState<Record<OutputFormat, boolean>>({
    jpeg: true,
    webp: true,
    avif: true,
    png: true,
  });
  const sensors = useDndSensors();


  useEffect(() => {
    let isMounted = true;
    getSupportedFormats().then((supportMap) => {
      if (!isMounted) return;
      setSupportedFormats(supportMap);

      // If current global format is unsupported, fall back to WebP, JPEG or PNG
      if (!supportMap[globalConvertFormat]) {
        const fallback = (['webp', 'jpeg', 'png'] as OutputFormat[]).find((fmt) => supportMap[fmt]) || 'jpeg';
        setGlobalConvertFormat(fallback);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [globalConvertFormat, setGlobalConvertFormat]);

  const computedFormatOptions = useMemo(() => {
    return formatOptions.map((opt) => ({
      ...opt,
      disabled: !supportedFormats[opt.value],
      title: !supportedFormats[opt.value] ? `${opt.label} is not supported for canvas export in this browser` : undefined,
    }));
  }, [supportedFormats]);

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

  if (queue.length === 0) return null;

  if (activeTab === 'convert') {
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
              className="text-xs text-[#666666] hover:text-[#ff4444] font-medium transition-colors disabled:opacity-30"
            >
              Clear Queue
            </button>
            
            <button
              onClick={processAll}
              disabled={isProcessingAll || queue.length === 0}
              className="bg-white text-black px-3 py-1.5 text-xs font-medium rounded-none hover:bg-gray-200 transition-colors disabled:bg-[#1f1f1f] disabled:text-[#666666] disabled:cursor-not-allowed"
            >
              {isProcessingAll ? 'Converting...' : 'Convert'}
            </button>
          </div>
        </div>

        {/* Global Format Selector */}
        <SegmentedControl
          label="Format"
          options={computedFormatOptions}
          value={globalConvertFormat}
          onChange={setGlobalConvertFormat}
        />

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
                  subtitle={
                    item.status === 'done' && item.processedSize !== undefined
                      ? (() => {
                          const origStr = formatBytes(item.originalSize);
                          const procStr = formatBytes(item.processedSize);
                          const diff = item.originalSize - item.processedSize;
                          const pct = Math.round((diff / item.originalSize) * 100);
                          const pctSign = pct > 0 ? `−${pct}%` : pct < 0 ? `+${Math.abs(pct)}%` : '0%';
                          return `${origStr} → ${procStr} (${pctSign})`;
                        })()
                      : formatBytes(item.originalSize)
                  }
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

  if (activeTab === 'increaseSize') {

    const increaseSizeOptions: SegmentedControlOption<string>[] = [
      { value: '100', label: '100 KB' },
      { value: '250', label: '250 KB' },
      { value: '500', label: '500 KB' },
      { value: '1000', label: '1000 KB' },
    ];

    const currentIncreaseTargetStr =
      customIncreaseTargetInput === '' ? String(increaseSizeTargetSizeKb) : '';

    const handleIncreaseTargetChange = (valStr: string) => {
      setIncreaseSizeTargetSizeKb(parseInt(valStr, 10));
      setCustomIncreaseTargetInput('');
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
              className="text-xs text-[#666666] hover:text-[#ff4444] font-medium transition-colors disabled:opacity-30"
            >
              Clear Queue
            </button>

            <button
              onClick={processAll}
              disabled={isProcessingAll || queue.length === 0}
              className="bg-white text-black px-3 py-1.5 text-xs font-medium rounded-none hover:bg-gray-200 transition-colors disabled:bg-[#1f1f1f] disabled:text-[#666666] disabled:cursor-not-allowed"
            >
              {isProcessingAll ? 'Increasing...' : 'Increase Size'}
            </button>
          </div>
        </div>

        {/* Global Controls: Target Size */}
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <SegmentedControl
              label="Target Size"
              options={increaseSizeOptions}
              value={currentIncreaseTargetStr}
              onChange={handleIncreaseTargetChange}
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                step="1"
                value={customIncreaseTargetInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomIncreaseTargetInput(val);
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num > 0) {
                    setIncreaseSizeTargetSizeKb(num);
                  }
                }}
                className="w-16 h-7 px-2 text-xs border border-[#1f1f1f] bg-[#111111] text-white rounded-none focus:outline-none focus:border-white"
              />
              <span className="text-xs text-[#666666]">KB</span>
            </div>
          </div>
        </div>

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
                  subtitle={
                    item.status === 'done' && item.processedSize !== undefined
                      ? (() => {
                          if (item.skipReason) {
                            return formatBytes(item.originalSize);
                          }
                          const origStr = formatBytes(item.originalSize);
                          const procStr = formatBytes(item.processedSize);
                          const diff = item.processedSize - item.originalSize;
                          const pct = Math.round((diff / item.originalSize) * 100);
                          const pctSign = pct > 0 ? `+${pct}%` : '0%';
                          return `${origStr} → ${procStr} (${pctSign})`;
                        })()
                      : formatBytes(item.originalSize)
                  }
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

  // Target Size selection options logic
  const targetSizeOptions: SegmentedControlOption<string>[] = [
    { value: '50', label: '50 KB' },
    { value: '100', label: '100 KB' },
  ];

  const currentTargetStr = customTargetInput === '' ? String(compressTargetSizeKb) : '';

  const handleTargetSizeChange = (valStr: string) => {
    setCompressTargetSizeKb(parseInt(valStr, 10));
    setCustomTargetInput('');
  };

  // Compress tab layout with Global Compression Controls
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
            className="text-xs text-[#666666] hover:text-[#ff4444] font-medium transition-colors disabled:opacity-30"
          >
            Clear Queue
          </button>
          
          <button
            onClick={processAll}
            disabled={isProcessingAll || queue.length === 0}
            className="bg-white text-black px-3 py-1.5 text-xs font-medium rounded-none hover:bg-gray-200 transition-colors disabled:bg-[#1f1f1f] disabled:text-[#666666] disabled:cursor-not-allowed"
          >
            {isProcessingAll ? 'Compressing...' : 'Compress'}
          </button>
        </div>
      </div>

      {/* Global Controls: Target Size & Dimension */}
      <div className="flex items-center justify-between gap-6 flex-wrap">
        {/* Target Size */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <SegmentedControl
              label="Target Size"
              options={targetSizeOptions}
              value={currentTargetStr}
              onChange={handleTargetSizeChange}
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                step="1"
                value={customTargetInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomTargetInput(val);
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num > 0) {
                    setCompressTargetSizeKb(num);
                  }
                }}
                className="w-16 h-7 px-2 text-xs border border-[#1f1f1f] bg-[#111111] text-white rounded-none focus:outline-none focus:border-white"
              />
              <span className="text-xs text-[#666666]">KB</span>
            </div>
          </div>
        </div>

        {/* Dimension */}
        <SegmentedControl
          label="Dimension"
          extraLabelRight={<DimensionInfoTooltip />}
          options={dimensionOptions}
          value={compressResolutionPreset}
          onChange={setCompressResolutionPreset}
        />
      </div>

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
                subtitle={
                  item.status === 'done' && item.processedSize !== undefined
                    ? (() => {
                        const origStr = formatBytes(item.originalSize);
                        const procStr = formatBytes(item.processedSize);
                        const diff = item.originalSize - item.processedSize;
                        const pct = Math.round((diff / item.originalSize) * 100);
                        const pctSign = pct > 0 ? `−${pct}%` : pct < 0 ? `+${Math.abs(pct)}%` : '0%';
                        return `${origStr} → ${procStr} (${pctSign})`;
                      })()
                    : formatBytes(item.originalSize)
                }
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
};
