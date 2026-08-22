export const TABS = ['compress', 'convert', 'imagePdf'] as const;
export type Tab = typeof TABS[number];

export const DIMENSION_WEB = 1024;
export const DIMENSION_HD = 1920;
export const MAX_TARGET_SIZE_KB = 102400;
export const DEFAULT_TARGET_SIZE_KB = 100;
