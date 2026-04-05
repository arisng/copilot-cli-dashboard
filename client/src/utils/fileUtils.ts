/**
 * File utility functions for handling artifact files
 */

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'];
const DOC_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkdn', '.mkd', '.txt', '.rst'];
const ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar'];

/**
 * Check if a file is an image based on its extension
 */
export function isImageFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Check if a file is a code file based on its extension
 */
export function isCodeFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return CODE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Check if a file is a document file based on its extension
 */
export function isDocFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return DOC_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Check if a file is an archive file based on its extension
 */
export function isArchiveFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Get file type label for display
 */
export function getFileTypeLabel(fileName: string): string {
  if (isImageFile(fileName)) return 'image';
  if (isCodeFile(fileName)) return 'code';
  if (isDocFile(fileName)) return 'doc';
  if (isArchiveFile(fileName)) return 'archive';
  return 'file';
}

/**
 * Get the file extension from a file name
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(lastDot).toLowerCase() : '';
}

/**
 * Format a file size in bytes to a human-readable string
 */
export function formatBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let value = sizeBytes;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
