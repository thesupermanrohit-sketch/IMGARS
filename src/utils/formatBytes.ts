export function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B';

  const unit = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(unit)), sizes.length - 1);
  const value = bytes / Math.pow(unit, index);
  const precision = index >= 2 ? 2 : 1;

  return `${parseFloat(value.toFixed(precision))} ${sizes[index]}`;
}
