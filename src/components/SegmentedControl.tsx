import React from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
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
      <div className="flex items-center gap-4">
        {options.map((option) => {
          const isSelected = value === option.value && !disabled;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`text-xs py-1 border-b transition-colors disabled:cursor-not-allowed ${
                isSelected
                  ? 'text-white border-white'
                  : 'text-[#666666] border-transparent hover:text-white disabled:hover:text-[#666666]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
