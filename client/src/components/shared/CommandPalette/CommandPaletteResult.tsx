import { type SearchResult } from '../../../api/client.ts';
import { RelativeTime } from '../RelativeTime.tsx';

interface Props {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}

export function CommandPaletteResult({ result, isSelected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-4 py-3 flex flex-col gap-1
        transition-colors duration-150
        ${isSelected ? 'bg-gh-accent/20' : 'hover:bg-gh-surface'}
      `}
      aria-selected={isSelected}
      role="option"
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* File icon */}
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          className="shrink-0 text-gh-muted"
          fill="currentColor"
        >
          <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 14.25 16h-9.5A1.75 1.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 10 4.25V1.5Zm6.56.75a.25.25 0 0 0-.06.09l-.526 1.06a.75.75 0 0 1-1.342-.66l.526-1.06a.25.25 0 0 1 .09-.06.25.25 0 0 1 .118-.03h2.426a.25.25 0 0 1 .25.25v2.426a.25.25 0 0 1-.03.118.25.25 0 0 1-.06.09l-1.06.526a.75.75 0 0 1-.66-1.342l1.06-.526a.25.25 0 0 0 .09-.06.25.25 0 0 0 .03-.118V2.5Z" />
          <path d="M7.25 8.5a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75ZM5 8.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 3a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>

        {/* Session name */}
        <span className="text-xs text-gh-muted truncate">{result.sessionName}</span>

        <span className="text-gh-border">/</span>

        {/* File name */}
        <span className="text-sm font-medium text-gh-text truncate">{result.fileName}</span>
      </div>

      {/* Snippet */}
      {result.snippet && (
        <p className="text-xs text-gh-muted line-clamp-1 pl-5">{result.snippet}</p>
      )}

      {/* Last modified */}
      <div className="pl-5">
        <RelativeTime timestamp={result.lastModified} className="text-[10px] text-gh-muted/70" />
      </div>
    </button>
  );
}
