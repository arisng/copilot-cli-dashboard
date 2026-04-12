import React, { Suspense, lazy } from 'react';
import type { SessionArtifactEntry } from '../../../api/client';
import { isImageFile, shouldUseMonaco, getMonacoLanguage, getViewerType } from '../../../utils/fileUtils';
import { ImagePreview } from '../../SessionDetail/ImagePreview';
import { MarkdownRenderer } from '../MarkdownRenderer';

// Lazy-load Monaco Editor to avoid initial bundle impact
const MonacoEditor = lazy(() => import('../MonacoEditor'));

export interface ArtifactViewerProps {
  /** The artifact entry to display */
  entry: SessionArtifactEntry;
  /** Session ID for model URI generation */
  sessionId: string;
  /** Whether to force markdown rendering (for rendered markdown view) */
  forceMarkdown?: boolean;
  /** Whether content should be collapsible */
  collapsible?: boolean;
  /** Whether this is a mobile view (uses fallback renderer) */
  isMobile?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * ArtifactViewer - Unified component for displaying artifact files.
 * 
 * Automatically selects the appropriate viewer based on file type:
 * - Images: ImagePreview component
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
  collapsible = false,
  isMobile = false,
  className = '',
}) => {
  // Determine viewer type based on file
  const viewerType = getViewerType(entry.name, { isMobile });

  // Handle image files
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

  // Handle forceMarkdown flag (for rendered markdown preview)
  if (forceMarkdown) {
    return (
      <MarkdownRenderer 
        content={content} 
        variant={isMobile ? 'mobile' : 'desktop'} 
        collapsible={collapsible} 
      />
    );
  }

  // For Monaco-supported files on desktop, use Monaco Editor
  if (viewerType === 'monaco') {
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

  // Default: use MarkdownRenderer as fallback
  return (
    <MarkdownRenderer 
      content={content} 
      variant={isMobile ? 'mobile' : 'desktop'} 
      collapsible={collapsible} 
    />
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
