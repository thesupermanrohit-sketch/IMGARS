import React from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  label?: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  extraLabelRight?: React.ReactNode;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  extraLabelRight,
}: SegmentedControlProps<T>) {
  return (
    <div className={`flex items-center gap-4 flex-wrap ${disabled ? 'opacity-40' : ''}`}>
      {label && (
        <div className="flex items-center">
          <span className="text-xs text-[#666666]">{label}</span>
          {extraLabelRight}
          <span className="text-xs text-[#666666]">:</span>
        </div>
      )}
      <div role="radiogroup" aria-label={label || 'Options'} className="flex items-center gap-4">
        {options.map((option) => {
          const isOptionDisabled = disabled || option.disabled;
          const isSelected = value === option.value && !isOptionDisabled;
          return (
            <button
              key={option.value}
              role="radio"
              aria-checked={isSelected}
              type="button"
              disabled={isOptionDisabled}
              title={option.title}
              onClick={() => onChange(option.value)}
              className={`text-xs py-1 border-b transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${
                isSelected
                  ? 'text-white border-white'
                  : isOptionDisabled
                    ? 'text-[#333333] border-transparent cursor-not-allowed'
                    : 'text-[#666666] border-transparent hover:text-white disabled:hover:text-[#666666]'
              }`}
            >
              {option.label}
              {option.disabled ? <span className="ml-1 text-[10px] text-[#444444]">(unsupported)</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
