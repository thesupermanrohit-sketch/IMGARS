import { IMAGE_PDF_ACCEPTED_TYPES } from '../features/imagePdf/types';
import type { Tab } from '../constants/tabs';

export function isSupportedImageMimeType(type: string, mode?: Tab) {
  if (mode === 'increaseSize') {
    return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
  }

  return IMAGE_PDF_ACCEPTED_TYPES.has(type);
}
