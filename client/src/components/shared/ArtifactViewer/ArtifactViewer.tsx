import React, { Suspense, lazy, useState, useCallback } from 'react';
import type { SessionArtifactEntry } from '../../../api/client';
import { isImageFile, isDocFile, shouldUseMonaco, getMonacoLanguage, getViewerType } from '../../../utils/fileUtils';
import { ImagePreview } from '../../SessionDetail/ImagePreview';
import { MarkdownRenderer } from '../MarkdownRenderer';

// Lazy-load Monaco Editor to avoid initial bundle impact
const MonacoEditor = lazy(() => import('../MonacoEditor'));

export type ViewerMode = 'auto' | 'preview' | 'source';

export interface ArtifactViewerProps {
  /** The artifact entry to display */
  entry: SessionArtifactEntry;
  /** Session ID for model URI generation */
  sessionId: string;
  /** 
   * Viewer mode for the artifact:
   * - 'auto': Automatically select based on file type (default)
   * - 'preview': Rendered markdown view (for markdown files)
   * - 'source': Source code view (Monaco for supported files)
   * 
   * @deprecated Use `defaultMode` instead for initial mode selection
   */
  forceMarkdown?: boolean;
  /**
   * Default viewer mode when component mounts.
   * For markdown files, defaults to 'preview'. For other files, defaults to 'source'.
   */
  defaultMode?: ViewerMode;
  /** Whether content should be collapsible */
  collapsible?: boolean;
  /** Whether this is a mobile view (uses fallback renderer) */
  isMobile?: boolean;
  /** Whether to show the mode toggle UI (for markdown files) */
  showModeToggle?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Determine the default viewer mode for a file.
 * - Markdown files default to 'preview' mode
 * - Other files default to 'source' mode
 */
function getDefaultMode(fileName: string, explicitMode?: ViewerMode): ViewerMode {
  if (explicitMode && explicitMode !== 'auto') {
    return explicitMode;
  }
  // Markdown files default to preview mode
  if (isDocFile(fileName)) {
    return 'preview';
  }
  // Other files default to source mode
  return 'source';
}

/**
 * ArtifactViewer - Unified component for displaying artifact files.
 * 
 * Automatically selects the appropriate viewer based on file type:
 * - Images: ImagePreview component
 * - Markdown files (desktop): Preview mode by default, with Source toggle
 * - Monaco-supported files (desktop): Monaco Editor with syntax highlighting
 * - Other text files / mobile: MarkdownRenderer as fallback
 * 
 * Usage:
 * ```tsx
 * <ArtifactViewer 
 *   entry={fileEntry} 
 *   sessionId={session.id}
 *   isMobile={false}
 * />
 * ```
 */
export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  entry,
  sessionId,
  forceMarkdown = false,
  defaultMode = 'auto',
  collapsible = false,
  isMobile = false,
  showModeToggle = true,
  className = '',
}) => {
  // Determine initial mode
  const initialMode = forceMarkdown ? 'preview' : getDefaultMode(entry.name, defaultMode);
  const [mode, setMode] = useState<ViewerMode>(initialMode);

  // Determine viewer type based on file
  const viewerType = getViewerType(entry.name, { isMobile });

  // Check if this is a markdown file that supports preview/source toggle
  const isMarkdown = isDocFile(entry.name);

  // Handle mode toggle
  const handleModeChange = useCallback((newMode: ViewerMode) => {
    setMode(newMode);
  }, []);

  // Handle image files - images always use ImagePreview regardless of mode
  if (viewerType === 'image') {
    return (
      <ImagePreview
        sessionId={sessionId}
        filePath={entry.path}
        fileName={entry.name}
        fileSizeBytes={entry.sizeBytes}
      />
    );
  }

  // Handle empty content
  const content = entry.content?.trim();
  if (!content) {
    return (
      <div className={`rounded-xl border border-dashed border-gh-border bg-gh-surface/20 p-4 text-sm text-gh-muted ${className}`}>
        No text content is available for this file.
      </div>
    );
  }

  // Determine effective mode based on file type and mode selection
  const effectiveMode = (() => {
    // Non-markdown files always use source mode (Monaco or fallback)
    if (!isMarkdown) {
      return 'source';
    }
    // Markdown files respect the selected mode
    return mode;
  })();

  // Render mode toggle for markdown files
  const renderModeToggle = () => {
    if (!isMarkdown || isMobile || !showModeToggle) {
      return null;
    }

    return (
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex rounded-lg border border-gh-border bg-gh-bg p-1">
          <button
            onClick={() => handleModeChange('preview')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'preview'
                ? 'bg-gh-accent text-white'
                : 'text-gh-muted hover:text-gh-text'
            }`}
            title="Rendered preview"
          >
            Preview
          </button>
          <button
            onClick={() => handleModeChange('source')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'source'
                ? 'bg-gh-accent text-white'
                : 'text-gh-muted hover:text-gh-text'
            }`}
            title="Source code"
          >
            Source
          </button>
        </div>
      </div>
    );
  };

  // Render the appropriate viewer based on effective mode
  const renderViewer = () => {
    // Preview mode: use MarkdownRenderer
    if (effectiveMode === 'preview') {
      return (
        <MarkdownRenderer 
          content={content} 
          variant={isMobile ? 'mobile' : 'desktop'} 
          collapsible={collapsible}
          enableMedia={true}
        />
      );
    }

    // Source mode: use Monaco for supported files, fallback for others
    if (viewerType === 'monaco' || shouldUseMonaco(entry.name)) {
      const language = getMonacoLanguage(entry.name);
      
      return (
        <Suspense
          fallback={
            <div className="rounded-xl border border-gh-border bg-gh-surface/20 p-4 text-sm text-gh-muted">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-gh-accent" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading editor…
              </div>
            </div>
          }
        >
          <MonacoEditor
            content={content}
            fileName={entry.name}
            filePath={entry.path}
            sessionId={sessionId}
            language={language}
            className={className}
            readOnly={true}
          />
        </Suspense>
      );
    }

    // Fallback: use MarkdownRenderer
    return (
      <MarkdownRenderer 
        content={content} 
        variant={isMobile ? 'mobile' : 'desktop'} 
        collapsible={collapsible}
        enableMedia={true}
      />
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {renderModeToggle()}
      <div className="flex-1 min-h-0 overflow-auto">
        {renderViewer()}
      </div>
    </div>
  );
};

/**
 * Check if a file can be viewed in Monaco Editor.
 * Useful for conditionally showing UI indicators (icons, badges, etc.)
 */
export function canUseMonacoViewer(fileName: string, isMobile: boolean = false): boolean {
  if (isMobile) return false;
  if (isImageFile(fileName)) return false;
  return shouldUseMonaco(fileName);
}

/**
 * Get a descriptive label for the viewer type.
 * Useful for tooltips or accessibility labels.
 */
export function getViewerTypeLabel(fileName: string, isMobile: boolean = false): string {
  const viewerType = getViewerType(fileName, { isMobile });
  
  switch (viewerType) {
    case 'image':
      return 'Image preview';
    case 'monaco':
      return 'Code editor';
    case 'markdown-fallback':
      return 'Text viewer';
    case 'binary-fallback':
      return 'Binary file';
    default:
      return 'File viewer';
  }
}

export default ArtifactViewer;
