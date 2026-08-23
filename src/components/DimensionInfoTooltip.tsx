import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

export function DimensionInfoTooltip() {
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
