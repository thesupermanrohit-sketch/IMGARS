import { useState, useEffect, useMemo } from 'react';
import { useForgeStore } from '../store/useForgeStore';
import type { OutputFormat } from '../features/convert/types';
import { getSupportedFormats } from '../features/convert/formatSupport';
import type { CompressResolutionPreset } from '../features/compress/types';
import { SegmentedControl, type SegmentedControlOption } from './SegmentedControl';
import { DimensionInfoTooltip } from './DimensionInfoTooltip';
import { QueueShell } from './QueueShell';

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

const targetSizeOptions: SegmentedControlOption<string>[] = [
  { value: '50', label: '50 KB' },
  { value: '100', label: '100 KB' },
];

interface TargetSizeControlProps {
  options: SegmentedControlOption<string>[];
  value: number;
  fallbackKb: number;
  placeholder?: string;
  onChange: (valueKb: number) => void;
}

function TargetSizeControl({
  options,
  value,
  fallbackKb,
  placeholder,
  onChange,
}: TargetSizeControlProps) {
  const [customInput, setCustomInput] = useState<string>('');
  const currentStr = customInput === '' ? String(value) : '';
  const resolvedPlaceholder = placeholder || `e.g. ${fallbackKb}`;

  const handlePresetChange = (valStr: string) => {
    const num = Number(valStr);
    if (Number.isInteger(num) && num > 0) {
      onChange(num);
    }
    setCustomInput('');
  };

  const handleBlur = () => {
    if (customInput === '') {
      onChange(fallbackKb);
      return;
    }
    const num = Number(customInput);
    if (!Number.isInteger(num) || num <= 0) {
      setCustomInput('');
      onChange(fallbackKb);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <SegmentedControl
        label="Target Size"
        options={options}
        value={currentStr}
        onChange={handlePresetChange}
      />
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="1"
          step="1"
          placeholder={resolvedPlaceholder}
          value={customInput}
          onBlur={handleBlur}
          onChange={(e) => {
            const val = e.target.value.trim();
            setCustomInput(val);
            if (val === '') {
              onChange(fallbackKb);
              return;
            }
            const num = Number(val);
            if (Number.isInteger(num) && num > 0) {
              onChange(num);
            }
          }}
          className="w-20 h-7 px-2 text-xs border border-[#1f1f1f] bg-[#111111] text-white rounded-none focus:outline-none focus:border-white placeholder:text-[#444444]"
          aria-label="Custom target size in KB"
        />
        <span className="text-xs text-[#666666]">KB</span>
      </div>
    </div>
  );
}

export function QueueList() {
  const activeTab = useForgeStore((state) => state.activeTab);
  const globalConvertFormat = useForgeStore((state) => state.globalConvertFormat);
  const setGlobalConvertFormat = useForgeStore((state) => state.setGlobalConvertFormat);
  const compressTargetSizeKb = useForgeStore((state) => state.compressTargetSizeKb);
  const setCompressTargetSizeKb = useForgeStore((state) => state.setCompressTargetSizeKb);
  const compressResolutionPreset = useForgeStore((state) => state.compressResolutionPreset);
  const setCompressResolutionPreset = useForgeStore((state) => state.setCompressResolutionPreset);
  const setIncreaseSizeTargetSizeKb = useForgeStore((state) => state.setIncreaseSizeTargetSizeKb);

  const [customIncreaseTargetInput, setCustomIncreaseTargetInput] = useState<string>('');
  const [supportedFormats, setSupportedFormats] = useState<Record<OutputFormat, boolean>>({
    jpeg: true,
    webp: true,
    avif: true,
    png: true,
  });

  useEffect(() => {
    let isMounted = true;
    getSupportedFormats().then((supportMap) => {
      if (!isMounted) return;
      setSupportedFormats(supportMap);

      const currentFormat = useForgeStore.getState().globalConvertFormat;
      if (!supportMap[currentFormat]) {
        const fallback = (['webp', 'jpeg', 'png'] as OutputFormat[]).find((fmt) => supportMap[fmt]) || 'jpeg';
        setGlobalConvertFormat(fallback);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [setGlobalConvertFormat]);

  const computedFormatOptions = useMemo(() => {
    return formatOptions.map((opt) => ({
      ...opt,
      disabled: !supportedFormats[opt.value],
      title: !supportedFormats[opt.value] ? `${opt.label} is not supported for canvas export in this browser` : undefined,
    }));
  }, [supportedFormats]);

  if (activeTab === 'convert') {
    return (
      <QueueShell
        actionLabel="Convert"
        processingLabel="Converting..."
        controlsSlot={
          <SegmentedControl
            label="Format"
            options={computedFormatOptions}
            value={globalConvertFormat}
            onChange={setGlobalConvertFormat}
          />
        }
      />
    );
  }

  if (activeTab === 'increaseSize') {
    return (
      <QueueShell
        actionLabel="Increase Size"
        processingLabel="Increasing..."
        controlsSlot={
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#666666]">Target Size:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 500"
                  value={customIncreaseTargetInput}
                  onBlur={() => {
                    if (customIncreaseTargetInput === '') {
                      setIncreaseSizeTargetSizeKb(500);
                      return;
                    }
                    const num = Number(customIncreaseTargetInput);
                    if (!Number.isInteger(num) || num <= 0) {
                      setCustomIncreaseTargetInput('');
                      setIncreaseSizeTargetSizeKb(500);
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setCustomIncreaseTargetInput(val);
                    if (val === '') {
                      setIncreaseSizeTargetSizeKb(500);
                      return;
                    }
                    const num = Number(val);
                    if (Number.isInteger(num) && num > 0) {
                      setIncreaseSizeTargetSizeKb(num);
                    }
                  }}
                  className="w-20 h-7 px-2 text-xs border border-[#1f1f1f] bg-[#111111] text-white rounded-none focus:outline-none focus:border-white placeholder:text-[#444444]"
                  aria-label="Target size in KB"
                />
                <span className="text-xs text-[#666666]">KB</span>
              </div>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <QueueShell
      actionLabel="Compress"
      processingLabel="Compressing..."
      controlsSlot={
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <TargetSizeControl
              options={targetSizeOptions}
              value={compressTargetSizeKb}
              fallbackKb={100}
              placeholder="e.g. 100"
              onChange={setCompressTargetSizeKb}
            />
          </div>

          <SegmentedControl
            label="Dimension"
            extraLabelRight={<DimensionInfoTooltip />}
            options={dimensionOptions}
            value={compressResolutionPreset}
            onChange={setCompressResolutionPreset}
          />
        </div>
      }
    />
  );
}
