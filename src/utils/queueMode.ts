import type { Tab } from '../constants/tabs';
import type { FileItem } from '../types/store';

export function getQueueItemMode(item: FileItem): Tab {
  // Match setGlobalConvertFormat's compatibility handling of mode-less entries.
  return item.mode ?? 'convert';
}
