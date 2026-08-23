import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Compress', path: '/compress' },
  { label: 'Increase Size', path: '/increase-size' },
  { label: 'Convert', path: '/convert' },
  { label: 'Image to PDF', path: '/image-to-pdf' },
];


export const NavBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const isItemActive = (path: string) => {
    return location.pathname === path || (location.pathname === '/' && path === '/compress');
  };

  const activeItem = NAV_ITEMS.find((item) => isItemActive(item.path)) || NAV_ITEMS[0];

  // Close trigger 1: Outside click (mousedown)
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close trigger 2: Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Close trigger 3: Route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <header className="w-full border-b border-[#1f1f1f] bg-[#0a0a0a]">
      <div className="max-w-[720px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="text-sm font-medium tracking-tight text-white select-none">
          IMGARS
        </div>

        {/* Desktop Navigation (>= 768px) */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`text-xs font-medium tracking-wide transition-colors duration-150 py-1 border-b ${
                  active
                    ? 'text-white border-white'
                    : 'text-[#666666] border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile Navigation (< 768px) */}
        <div ref={navRef} className="relative md:hidden">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label="Navigation menu"
            className="text-xs font-medium tracking-wide text-white hover:text-white transition-colors cursor-pointer py-1 select-none flex items-center gap-1.5"
          >
            <span>{activeItem.label}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-44 bg-[#0a0a0a] border border-white/10 z-50 flex flex-col"
            >
              {NAV_ITEMS.map((item) => {
                const active = isItemActive(item.path);
                return (
                  <button
                    key={item.path}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      navigate(item.path);
                      setIsOpen(false);
                    }}
                    className="w-full text-left py-3 px-4 border-b border-white/10 last:border-b-0 cursor-pointer flex items-center"
                  >
                    <span
                      className={`text-xs font-medium tracking-wide transition-colors duration-150 py-0.5 border-b ${
                        active
                          ? 'text-white border-white'
                          : 'text-[#666666] border-transparent hover:text-white'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
