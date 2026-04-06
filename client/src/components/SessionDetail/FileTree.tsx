import { useState, useCallback, useMemo } from 'react';
import type { SessionArtifactEntry } from '../../api/client.ts';
import { isImageFile, isCodeFile, isDocFile, isArchiveFile, formatBytes } from '../../utils/fileUtils.ts';
import { RelativeTime } from '../shared/RelativeTime.tsx';

interface FileTreeProps {
  entries: SessionArtifactEntry[];
  selectedPath: string;
  onSelectFile: (path: string) => void;
  showTimestamps?: boolean;
}

interface FileTreeItemProps {
  entry: SessionArtifactEntry;
  selectedPath: string;
  onSelectFile: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  depth?: number;
  showTimestamps?: boolean;
}

/**
 * Get the appropriate icon for a file based on its type
 */
function getFileIcon(fileName: string): string {
  if (isImageFile(fileName)) return '🖼';
  if (isCodeFile(fileName)) return '📄';
  if (isDocFile(fileName)) return '📝';
  if (isArchiveFile(fileName)) return '📦';
  return '📄';
}

/**
 * Collect all folder paths from entries recursively
 */
function collectFolderPaths(entries: SessionArtifactEntry[]): string[] {
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'directory') {
      paths.push(entry.path);
      if (entry.children) {
        paths.push(...collectFolderPaths(entry.children));
      }
    }
  }
  return paths;
}

/**
 * Count files in a folder recursively
 */
function countFiles(entry: SessionArtifactEntry): number {
  if (entry.kind === 'file') return 1;
  if (!entry.children) return 0;
  return entry.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function FileTreeItem({
  entry,
  selectedPath,
  onSelectFile,
  expandedPaths,
  onToggleExpand,
  depth = 0,
  showTimestamps = false,
}: FileTreeItemProps) {
  const isFolder = entry.kind === 'directory';
  const isSelected = !isFolder && entry.path === selectedPath;
  const isExpanded = expandedPaths.has(entry.path);
  const hasChildren = isFolder && entry.children && entry.children.length > 0;
  const fileCount = isFolder ? countFiles(entry) : 0;

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleExpand(entry.path);
    } else {
      onSelectFile(entry.path);
    }
  }, [isFolder, entry.path, onToggleExpand, onSelectFile]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
      if (isFolder && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault();
        onToggleExpand(entry.path);
      }
    },
    [handleClick, isFolder, entry.path, onToggleExpand]
  );

  // Calculate indentation based on depth
  const indentStyle = { paddingLeft: `${depth * 12}px` };

  return (
    <div className="select-none">
      <div
        role={isFolder ? 'button' : undefined}
        tabIndex={isFolder ? 0 : -1}
        onClick={handleClick}
        onKeyDown={isFolder ? handleKeyDown : undefined}
        style={indentStyle}
        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
          isFolder
            ? 'cursor-pointer hover:bg-gh-surface/60'
            : isSelected
              ? 'cursor-pointer bg-gh-accent/10 text-gh-text'
              : 'cursor-pointer hover:bg-gh-surface/60'
        }`}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        {/* Expand/collapse indicator for folders */}
        {isFolder ? (
          <span
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-gh-muted transition-transform duration-150 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </span>
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}

        {/* Icon */}
        <span
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs ${
            isFolder
              ? 'bg-gh-accent/15 text-gh-accent'
              : isSelected
                ? 'bg-gh-active/20 text-gh-active'
                : 'text-gh-muted'
          }`}
        >
          {isFolder ? (isExpanded ? '📂' : '📁') : getFileIcon(entry.name)}
        </span>

        {/* Name and metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`truncate text-sm ${
                isFolder
                  ? 'font-medium text-gh-text'
                  : isSelected
                    ? 'font-medium text-gh-text'
                    : 'text-gh-muted group-hover:text-gh-text'
              }`}
              title={entry.name}
            >
              {entry.name}
            </span>
            {isFolder && fileCount > 0 && (
              <span className="shrink-0 text-[10px] text-gh-muted/70">
                {fileCount} item{fileCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {/* Size and timestamp for files */}
        {!isFolder && (
          <div className="flex shrink-0 items-center gap-2">
            {showTimestamps && entry.modifiedAt && (
              <span className="text-[10px] text-gh-muted/50">
                <RelativeTime timestamp={entry.modifiedAt} />
              </span>
            )}
            <span className="text-[10px] text-gh-muted/60">
              {formatBytes(entry.sizeBytes)}
            </span>
          </div>
        )}
      </div>

      {/* Render children if expanded */}
      {isFolder && isExpanded && hasChildren && (
        <div className="mt-0.5">
          {entry.children!.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
              showTimestamps={showTimestamps}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * FileTree component with collapsible folder support
 */
export function FileTree({ entries, selectedPath, onSelectFile, showTimestamps = false }: FileTreeProps) {
  // Track expanded folder paths
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Start with all folders expanded
    const allFolders = collectFolderPaths(entries);
    return new Set(allFolders);
  });

  // Toggle a single folder
  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Expand all folders
  const handleExpandAll = useCallback(() => {
    const allFolders = collectFolderPaths(entries);
    setExpandedPaths(new Set(allFolders));
  }, [entries]);

  // Collapse all folders
  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // Check if all folders are expanded
  const allFolderPaths = useMemo(() => collectFolderPaths(entries), [entries]);
  const allExpanded = allFolderPaths.length > 0 && allFolderPaths.every((path) => expandedPaths.has(path));
  const allCollapsed = expandedPaths.size === 0;

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gh-border bg-gh-bg/50 p-4 text-sm text-gh-muted">
        No files found.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-gh-border/50 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">
          File explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleExpandAll}
            disabled={allExpanded}
            className="inline-flex items-center rounded px-2 py-1 text-[11px] text-gh-muted transition-colors hover:bg-gh-surface/60 hover:text-gh-text disabled:cursor-not-allowed disabled:opacity-40"
            title="Expand all folders"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className="mr-1">
              <path d="M8 4a.75.75 0 01.75.75v2.5h2.5a.75.75 0 010 1.5h-2.5v2.5a.75.75 0 01-1.5 0v-2.5h-2.5a.75.75 0 010-1.5h2.5v-2.5A.75.75 0 018 4z" />
            </svg>
            Expand
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            disabled={allCollapsed}
            className="inline-flex items-center rounded px-2 py-1 text-[11px] text-gh-muted transition-colors hover:bg-gh-surface/60 hover:text-gh-text disabled:cursor-not-allowed disabled:opacity-40"
            title="Collapse all folders"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className="mr-1">
              <path d="M4 8a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5A.75.75 0 014 8z" />
            </svg>
            Collapse
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-0.5">
          {entries.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              expandedPaths={expandedPaths}
              onToggleExpand={handleToggleExpand}
              depth={0}
              showTimestamps={showTimestamps}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default FileTree;
