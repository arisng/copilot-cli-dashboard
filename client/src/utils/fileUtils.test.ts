import { describe, it, expect } from 'vitest';
import {
  isImageFile,
  isCodeFile,
  isDocFile,
  isArchiveFile,
  getFileTypeLabel,
  getFileExtension,
  formatBytes,
  shouldUseMonaco,
  getMonacoLanguage,
  getViewerType,
  getSupportedMonacoExtensions,
  getLanguageMappings,
} from './fileUtils.ts';

describe('isImageFile', () => {
  it('returns true for image extensions', () => {
    expect(isImageFile('photo.png')).toBe(true);
    expect(isImageFile('image.jpg')).toBe(true);
    expect(isImageFile('graphic.jpeg')).toBe(true);
    expect(isImageFile('icon.gif')).toBe(true);
    expect(isImageFile('vector.svg')).toBe(true);
    expect(isImageFile('webp-image.webp')).toBe(true);
  });

  it('returns false for non-image files', () => {
    expect(isImageFile('script.js')).toBe(false);
    expect(isImageFile('README.md')).toBe(false);
    expect(isImageFile('data.json')).toBe(false);
    expect(isImageFile('archive.zip')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isImageFile('PHOTO.PNG')).toBe(true);
    expect(isImageFile('Image.JPG')).toBe(true);
  });
});

describe('isCodeFile', () => {
  it('returns true for code extensions', () => {
    expect(isCodeFile('script.ts')).toBe(true);
    expect(isCodeFile('component.tsx')).toBe(true);
    expect(isCodeFile('app.js')).toBe(true);
    expect(isCodeFile('config.json')).toBe(true);
    expect(isCodeFile('data.yaml')).toBe(true);
  });

  it('returns false for non-code files', () => {
    expect(isCodeFile('image.png')).toBe(false);
    expect(isCodeFile('README.txt')).toBe(false);
  });
});

describe('isDocFile', () => {
  it('returns true for document extensions', () => {
    expect(isDocFile('README.md')).toBe(true);
    expect(isDocFile('notes.markdown')).toBe(true);
    expect(isDocFile('help.txt')).toBe(true);
    expect(isDocFile('guide.mdown')).toBe(true);
  });

  it('returns false for non-document files', () => {
    expect(isDocFile('script.js')).toBe(false);
    expect(isDocFile('image.png')).toBe(false);
  });
});

describe('isArchiveFile', () => {
  it('returns true for archive extensions', () => {
    expect(isArchiveFile('files.zip')).toBe(true);
    expect(isArchiveFile('backup.tar')).toBe(true);
    expect(isArchiveFile('compressed.gz')).toBe(true);
    expect(isArchiveFile('archive.7z')).toBe(true);
  });

  it('returns false for non-archive files', () => {
    expect(isArchiveFile('script.js')).toBe(false);
    expect(isArchiveFile('README.md')).toBe(false);
  });
});

describe('getFileTypeLabel', () => {
  it('returns correct labels for different file types', () => {
    expect(getFileTypeLabel('photo.png')).toBe('image');
    expect(getFileTypeLabel('script.ts')).toBe('code');
    expect(getFileTypeLabel('README.md')).toBe('doc');
    expect(getFileTypeLabel('archive.zip')).toBe('archive');
    expect(getFileTypeLabel('unknown.xyz')).toBe('file');
  });
});

describe('getFileExtension', () => {
  it('returns the file extension in lowercase', () => {
    expect(getFileExtension('file.txt')).toBe('.txt');
    expect(getFileExtension('script.JS')).toBe('.js');
    expect(getFileExtension('Photo.PNG')).toBe('.png');
  });

  it('returns empty string for files without extension', () => {
    expect(getFileExtension('Dockerfile')).toBe('');
    expect(getFileExtension('Makefile')).toBe('');
    expect(getFileExtension('README')).toBe('');
  });

  it('handles files with multiple dots', () => {
    expect(getFileExtension('my.file.name.txt')).toBe('.txt');
    expect(getFileExtension('archive.tar.gz')).toBe('.gz');
  });
});

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('handles edge cases', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
    expect(formatBytes(Infinity)).toBe('0 B');
  });
});

describe('shouldUseMonaco', () => {
  it('returns true for Monaco-supported code files', () => {
    expect(shouldUseMonaco('script.ts')).toBe(true);
    expect(shouldUseMonaco('app.js')).toBe(true);
    expect(shouldUseMonaco('style.css')).toBe(true);
    expect(shouldUseMonaco('page.html')).toBe(true);
    expect(shouldUseMonaco('data.json')).toBe(true);
    expect(shouldUseMonaco('config.yaml')).toBe(true);
    expect(shouldUseMonaco('query.sql')).toBe(true);
    expect(shouldUseMonaco('main.py')).toBe(true);
  });

  it('returns true for Monaco-supported document files', () => {
    expect(shouldUseMonaco('README.md')).toBe(true);
    expect(shouldUseMonaco('notes.txt')).toBe(true);
  });

  it('returns true for special filenames', () => {
    expect(shouldUseMonaco('Dockerfile')).toBe(true);
    expect(shouldUseMonaco('Makefile')).toBe(true);
    expect(shouldUseMonaco('Gemfile')).toBe(true);
  });

  it('returns false for unsupported files', () => {
    expect(shouldUseMonaco('photo.png')).toBe(false);
    expect(shouldUseMonaco('archive.zip')).toBe(false);
    expect(shouldUseMonaco('binary.exe')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(shouldUseMonaco('SCRIPT.TS')).toBe(true);
    expect(shouldUseMonaco('README.MD')).toBe(true);
    expect(shouldUseMonaco('DOCKERFILE')).toBe(true);
  });
});

describe('getMonacoLanguage', () => {
  it('returns correct language for TypeScript files', () => {
    expect(getMonacoLanguage('script.ts')).toBe('typescript');
    expect(getMonacoLanguage('component.tsx')).toBe('typescript');
  });

  it('returns correct language for JavaScript files', () => {
    expect(getMonacoLanguage('app.js')).toBe('javascript');
    expect(getMonacoLanguage('page.jsx')).toBe('javascript');
  });

  it('returns correct language for web files', () => {
    expect(getMonacoLanguage('index.html')).toBe('html');
    expect(getMonacoLanguage('style.css')).toBe('css');
    expect(getMonacoLanguage('theme.scss')).toBe('scss');
  });

  it('returns correct language for data files', () => {
    expect(getMonacoLanguage('data.json')).toBe('json');
    expect(getMonacoLanguage('config.yaml')).toBe('yaml');
    expect(getMonacoLanguage('settings.yml')).toBe('yaml');
  });

  it('returns correct language for document files', () => {
    expect(getMonacoLanguage('README.md')).toBe('markdown');
    expect(getMonacoLanguage('notes.txt')).toBe(undefined);
  });

  it('returns correct language for programming languages', () => {
    expect(getMonacoLanguage('script.py')).toBe('python');
    expect(getMonacoLanguage('main.go')).toBe('go');
    expect(getMonacoLanguage('lib.rs')).toBe('rust');
    expect(getMonacoLanguage('query.sql')).toBe('sql');
  });

  it('returns correct language for special filenames', () => {
    expect(getMonacoLanguage('Dockerfile')).toBe('dockerfile');
    expect(getMonacoLanguage('Makefile')).toBe('makefile');
    expect(getMonacoLanguage('Gemfile')).toBe('ruby');
  });

  it('returns undefined for unknown extensions', () => {
    expect(getMonacoLanguage('file.xyz')).toBe(undefined);
    expect(getMonacoLanguage('binary')).toBe(undefined);
  });

  it('handles paths correctly', () => {
    expect(getMonacoLanguage('/path/to/script.ts')).toBe('typescript');
    expect(getMonacoLanguage('C:\\Users\\dev\\app.js')).toBe('javascript');
  });
});

describe('getViewerType', () => {
  it('returns "image" for image files', () => {
    expect(getViewerType('photo.png')).toBe('image');
    expect(getViewerType('image.jpg', { isMobile: false })).toBe('image');
    expect(getViewerType('icon.svg', { isMobile: true })).toBe('image');
  });

  it('returns "binary-fallback" for archive files', () => {
    expect(getViewerType('archive.zip')).toBe('binary-fallback');
    expect(getViewerType('backup.tar.gz')).toBe('binary-fallback');
  });

  it('returns "monaco" for code files on desktop', () => {
    expect(getViewerType('script.ts', { isMobile: false })).toBe('monaco');
    expect(getViewerType('app.js', { isMobile: false })).toBe('monaco');
    expect(getViewerType('README.md', { isMobile: false })).toBe('monaco');
  });

  it('returns "markdown-fallback" for code files on mobile', () => {
    expect(getViewerType('script.ts', { isMobile: true })).toBe('markdown-fallback');
    expect(getViewerType('app.js', { isMobile: true })).toBe('markdown-fallback');
    expect(getViewerType('README.md', { isMobile: true })).toBe('markdown-fallback');
  });

  it('returns "markdown-fallback" for unsupported files', () => {
    expect(getViewerType('unknown.xyz')).toBe('markdown-fallback');
    expect(getViewerType('file.noext')).toBe('markdown-fallback');
  });

  it('defaults to desktop behavior when isMobile is not specified', () => {
    expect(getViewerType('script.ts')).toBe('monaco');
    expect(getViewerType('README.md')).toBe('monaco');
  });
});



describe('getSupportedMonacoExtensions', () => {
  it('returns an array of supported extensions', () => {
    const extensions = getSupportedMonacoExtensions();
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);
    expect(extensions).toContain('.ts');
    expect(extensions).toContain('.js');
    expect(extensions).toContain('.md');
    expect(extensions).toContain('.json');
  });
});

describe('getLanguageMappings', () => {
  it('returns a map of extensions to languages', () => {
    const mappings = getLanguageMappings();
    expect(typeof mappings).toBe('object');
    expect(mappings['.ts']).toBe('typescript');
    expect(mappings['.js']).toBe('javascript');
    expect(mappings['.md']).toBe('markdown');
    expect(mappings['.json']).toBe('json');
  });
});
