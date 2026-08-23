import { formatBytes } from './formatBytes';
import type { FileItem } from '../types/store';

/**
 * Formats the card subtitle displaying original and processed file sizes
 * along with the relative size change percentage.
 */
export function formatSizeDelta(item: FileItem): string {
  if (item.status !== 'done' || item.processedSize === undefined) {
    return formatBytes(item.originalSize);
  }

  if (item.skipReason) {
    return formatBytes(item.originalSize);
  }

  const origStr = formatBytes(item.originalSize);
  const procStr = formatBytes(item.processedSize);
  const diff = item.originalSize - item.processedSize;

  if (item.originalSize === 0) {
    return `${origStr} → ${procStr}`;
  }

  const pct = Math.round((Math.abs(diff) / item.originalSize) * 100);

  let pctSign = '0%';
  if (diff > 0) {
    pctSign = `−${pct}%`;
  } else if (diff < 0) {
    pctSign = `+${pct}%`;
  }

  return `${origStr} → ${procStr} (${pctSign})`;
}
