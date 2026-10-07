import { useEffect, useRef } from 'react';
import { proxy } from 'comlink';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Check, Download } from 'lucide-react';
import { DropZone } from '../../components/DropZone';
import { SortableImageCard } from '../../components/SortableImageCard';
import { SegmentedControl, type SegmentedControlOption } from '../../components/SegmentedControl';
import { useDndSensors } from '../../hooks/useDndSensors';
import { useForgeStore } from '../../store/useForgeStore';
import { formatBytes } from '../../utils/formatBytes';
import { downloadBlob } from '../../utils/downloadBlob';
import { createImagePdfWorker } from './imagePdfWorkerClient';
import {
  type ImagePdfOrientation,
  type ImagePdfPageSize,
  IMAGE_PDF_ACCEPT,
  IMAGE_PDF_ACCEPTED_TYPES as IMAGE_PDF_TYPES,
} from './types';
const DEFAULT_PDF_NAME = 'imgars-output.pdf';

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

function normalizePdfName(fileName: string) {
  const trimmedName = fileName.trim();
  const safeName = trimmedName.length > 0 ? trimmedName : DEFAULT_PDF_NAME;
  return safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
}

async function savePdf(blob: Blob, customName = DEFAULT_PDF_NAME) {
  const safeName = normalizePdfName(customName);
  const pickerWindow = window as SavePickerWindow;

  if (pickerWindow.showSaveFilePicker) {
    try {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: safeName,
        types: [
          {
            description: 'PDF',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      // Fallback to standard download
    }
  }

  downloadBlob(blob, safeName);
}

const pageSizeOptions: SegmentedControlOption<ImagePdfPageSize>[] = [
  { value: 'a4', label: 'A4' },
  { value: 'match', label: 'Match Image' },
];

const orientationOptions: SegmentedControlOption<ImagePdfOrientation>[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

export function ImagePdfPanel() {
  const {
    imagePdfItems,
    imagePdfPageSize,
    imagePdfOrientation,
    imagePdfResult,
    imagePdfReady,
    imagePdfIsGenerating,
    imagePdfProgress,
    imagePdfError,
    addImagePdfFiles,
    removeImagePdfFile,
    clearImagePdfFiles,
    reorderImagePdfFiles,
    setImagePdfPageSize,
    setImagePdfOrientation,
    setImagePdfGenerating,
    setImagePdfProgress,
    setImagePdfResult,
    setImagePdfError,
  } = useForgeStore();

  const isMountedRef = useRef(true);
  const sensors = useDndSensors();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    reorderImagePdfFiles(String(active.id), String(over.id));
  };

  const generatePdf = async () => {
    if (imagePdfItems.length === 0 || imagePdfIsGenerating) return;

    const { worker, api } = createImagePdfWorker();
    setImagePdfGenerating(true);
    setImagePdfError(undefined);
    setImagePdfResult(null);
    setImagePdfProgress('Generating PDF...');

    try {
      const result = await api.generatePdf(
        imagePdfItems.map((item) => ({
          id: item.id,
          file: item.file,
        })),
        { pageSize: imagePdfPageSize, orientation: imagePdfOrientation },
        proxy((message: string) => {
          if (isMountedRef.current) setImagePdfProgress(message);
        })
      );

      setImagePdfResult(result);
    } catch (error) {
      setImagePdfResult(null);
      setImagePdfError(error instanceof Error ? error.message : 'PDF generation failed.');
      setImagePdfProgress('');
    } finally {
      worker.terminate();
      setImagePdfGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!imagePdfResult) return;

    try {
      await savePdf(imagePdfResult.blob);
    } catch (error) {
      setImagePdfError(error instanceof Error ? error.message : 'Could not save the PDF.');
    }
  };

  if (imagePdfReady && imagePdfResult) {
    return (
      <div className="border-t border-[#1f1f1f] pt-5 flex flex-col gap-5">
        <div className="flex items-center gap-2 text-sm text-white">
          <Check className="w-4 h-4" />
          <span>PDF Ready</span>
        </div>

        <div className="flex flex-col border-t border-[#1f1f1f]">
          <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1f1f1f]">
            <span className="text-xs text-[#666666]">Filename</span>
            <span className="text-sm text-white truncate">{DEFAULT_PDF_NAME}</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1f1f1f]">
            <span className="text-xs text-[#666666]">File Size</span>
            <span className="text-sm text-white">{formatBytes(imagePdfResult.size)}</span>
          </div>
        </div>

        {imagePdfError && <p className="text-xs text-[#ff4444]">{imagePdfError}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            className="bg-white text-black py-2.5 text-sm font-medium rounded-none hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={clearImagePdfFiles}
            className="border border-[#1f1f1f] text-white py-2.5 text-sm font-medium rounded-none hover:border-white transition-colors"
          >
            Convert Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <DropZone
        accept={IMAGE_PDF_ACCEPT}
        prompt="Drop images here"
        isAcceptedFile={(file) => IMAGE_PDF_TYPES.has(file.type)}
        onFiles={addImagePdfFiles}
        onRejectedFiles={() => setImagePdfError('Upload JPEG, PNG, WebP, or AVIF images.')}
      />

      {imagePdfItems.length > 0 && (
        <div className="flex flex-col gap-5 mt-2">
          <div className="flex items-center justify-between gap-4 border-b border-[#1f1f1f] pb-3 flex-wrap">
            <h2 className="text-sm font-medium text-white tracking-wide">
              Images <span className="text-[#666666] font-normal">({imagePdfItems.length} files)</span>
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={clearImagePdfFiles}
                disabled={imagePdfIsGenerating}
                className="text-xs text-[#666666] hover:text-[#ff4444] font-medium transition-colors disabled:opacity-30"
              >
                Clear Queue
              </button>
              <button
                onClick={generatePdf}
                disabled={imagePdfIsGenerating || imagePdfItems.length === 0}
                className="bg-white text-black px-3 py-1.5 text-xs font-medium rounded-none hover:bg-gray-200 transition-colors disabled:bg-[#1f1f1f] disabled:text-[#666666] disabled:cursor-not-allowed"
              >
                {imagePdfIsGenerating ? imagePdfProgress || 'Generating PDF...' : 'Generate PDF'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-8 flex-wrap">
            <SegmentedControl
              label="Page Size"
              options={pageSizeOptions}
              value={imagePdfPageSize}
              onChange={setImagePdfPageSize}
            />
            <SegmentedControl
              label="Orientation"
              options={orientationOptions}
              value={imagePdfOrientation}
              onChange={setImagePdfOrientation}
              disabled={imagePdfPageSize === 'match'}
            />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={imagePdfItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3">
                {imagePdfItems.map((item) => (
                  <SortableImageCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    previewUrl={item.previewUrl}
                    subtitle={formatBytes(item.size)}
                    onRemove={removeImagePdfFile}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {(imagePdfProgress || imagePdfError || imagePdfReady) && (
        <div className="border-t border-[#1f1f1f] pt-5 flex flex-col gap-4">
          {imagePdfError && <p className="text-xs text-[#ff4444]">{imagePdfError}</p>}
          {!imagePdfError && imagePdfProgress && (
            <p className="text-sm text-white">{imagePdfProgress}</p>
          )}
        </div>
      )}
    </div>
  );
}
