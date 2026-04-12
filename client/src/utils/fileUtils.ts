/**
 * File utility functions for handling artifact files
 */

// ============================================================================
// File Extension Categories
// ============================================================================

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'];
const DOC_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkdn', '.mkd', '.txt', '.rst'];
const ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar'];

// Extensions that should be displayed in Monaco Editor
const MONACO_SUPPORTED_EXTENSIONS = [
  // Documentation/Markup
  '.md', '.markdown', '.mdown', '.mkdn', '.mkd', '.txt',
  // Data formats
  '.json', '.yaml', '.yml',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Other languages
  '.sql', '.py', '.rb', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp',
  '.cs', '.php', '.swift', '.kt', '.scala', '.r', '.pl', '.sh', '.bash',
  '.ps1', '.zsh', '.fish',
  // Config files
  '.xml', '.toml', '.ini', '.conf', '.config', '.env', '.gitignore',
  '.dockerfile', '.properties', '.graphql', '.gql', '.proto',
];

// Mapping of file extensions to Monaco language IDs
const EXTENSION_TO_LANGUAGE_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  // Data formats
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  // Documentation/Markup
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdown': 'markdown',
  '.mkdn': 'markdown',
  '.mkd': 'markdown',
  '.xml': 'xml',
  // Programming languages
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.r': 'r',
  '.pl': 'perl',
  '.sql': 'sql',
  // Shell scripts
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.ps1': 'powershell',
  // Config files
  '.toml': 'ini',
  '.ini': 'ini',
  '.conf': 'ini',
  '.config': 'ini',
  '.properties': 'ini',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.proto': 'protobuf',
  // Dockerfile (special case - handled by filename)
  '.dockerfile': 'dockerfile',
};

// Files that should use a specific language regardless of extension
const FILENAME_TO_LANGUAGE_MAP: Record<string, string> = {
  'dockerfile': 'dockerfile',
  'dockerfile.prod': 'dockerfile',
  'dockerfile.dev': 'dockerfile',
  'makefile': 'makefile',
  'gemfile': 'ruby',
  'rakefile': 'ruby',
  'jenkinsfile': 'groovy',
};

// ============================================================================
// Basic File Type Checks
// ============================================================================

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

// ============================================================================
// Monaco Editor File Classification
// ============================================================================

/**
 * Check if a file should be displayed in Monaco Editor.
 * Monaco is not officially supported on mobile browsers, so this should be
 * used in conjunction with device detection for mobile fallback.
 */
export function shouldUseMonaco(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  
  // Check filename-based matches first (e.g., "Dockerfile")
  const baseName = lowerName.split('/').pop()?.split('\\').pop() ?? lowerName;
  if (FILENAME_TO_LANGUAGE_MAP[baseName]) {
    return true;
  }
  
  // Check extension-based matches
  return MONACO_SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Get the Monaco Editor language ID for a given file.
 * Returns undefined if no specific language mapping exists (will use plain text).
 */
export function getMonacoLanguage(fileName: string): string | undefined {
  const lowerName = fileName.toLowerCase();
  
  // Check filename-based matches first
  const baseName = lowerName.split('/').pop()?.split('\\').pop() ?? lowerName;
  if (FILENAME_TO_LANGUAGE_MAP[baseName]) {
    return FILENAME_TO_LANGUAGE_MAP[baseName];
  }
  
  // Check extension-based matches
  const ext = getFileExtension(lowerName);
  return EXTENSION_TO_LANGUAGE_MAP[ext];
}

/**
 * Determine the appropriate viewer type for a file.
 * Returns one of: 'monaco', 'image', 'markdown-fallback', 'binary-fallback'
 */
export function getViewerType(fileName: string, options: { isMobile?: boolean } = {}): 'monaco' | 'image' | 'markdown-fallback' | 'binary-fallback' {
  // Images always use ImagePreview
  if (isImageFile(fileName)) {
    return 'image';
  }
  
  // Archives and other binary files use binary fallback
  if (isArchiveFile(fileName)) {
    return 'binary-fallback';
  }
  
  // For mobile, use markdown fallback even for Monaco-supported files
  // since Monaco is not officially supported on mobile browsers
  if (options.isMobile) {
    return 'markdown-fallback';
  }
  
  // For desktop, use Monaco if supported
  if (shouldUseMonaco(fileName)) {
    return 'monaco';
  }
  
  // Default to markdown fallback for plain text
  return 'markdown-fallback';
}

/**
 * Get all supported file extensions for documentation purposes
 */
export function getSupportedMonacoExtensions(): string[] {
  return [...MONACO_SUPPORTED_EXTENSIONS];
}

/**
 * Get all language mappings for documentation purposes
 */
export function getLanguageMappings(): Record<string, string> {
  return { ...EXTENSION_TO_LANGUAGE_MAP };
}
