import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchResearch, type SearchResult } from '../../../api/client.ts';
import { useCommandPalette } from './useCommandPalette.ts';
import { CommandPaletteResult } from './CommandPaletteResult.tsx';

const DEBOUNCE_MS = 300;
const MAX_RECENT_FILES = 10;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Fetch recent files when query is empty
  const fetchRecentFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchResearch('');
      // Sort by lastModified and take first 10
      const recent = data
        .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified))
        .slice(0, MAX_RECENT_FILES);
      setResults(recent);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recent files');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (query.trim() === '') {
      fetchRecentFiles();
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchResearch(query);
        setResults(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query, isOpen, fetchRecentFiles]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      fetchRecentFiles();
      // Focus input after a short delay
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, fetchRecentFiles]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? Math.max(results.length - 1, 0) : prev - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    navigate(`/sessions/${result.sessionId}?tab=artifacts&file=${encodeURIComponent(result.filePath)}`);
    onClose();
  };

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusIn = (event: FocusEvent) => {
      const modal = document.getElementById('command-palette-modal');
      if (modal && !modal.contains(event.target as Node)) {
        inputRef.current?.focus();
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] md:pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        id="command-palette-modal"
        className="relative w-full max-w-2xl mx-4 bg-gh-surface border border-gh-border rounded-lg shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gh-border">
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            className="text-gh-muted shrink-0"
            fill="currentColor"
          >
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search research files..."
            className="flex-1 bg-transparent text-gh-text placeholder-gh-muted outline-none text-sm"
            aria-label="Search query"
          />

          <kbd className="hidden md:inline-block px-2 py-1 text-[10px] font-mono text-gh-muted bg-gh-bg border border-gh-border rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto" role="listbox">
          {loading && (
            <div className="px-4 py-8 text-center">
              <div className="inline-block w-5 h-5 border-2 border-gh-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-6 text-center text-gh-attention text-sm">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="px-4 py-6 text-center text-gh-muted text-sm">
              {query.trim() ? 'No results found' : 'No recent research files'}
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <>
              {/* Result count announcement for screen readers */}
              <div className="sr-only" role="status" aria-live="polite">
                {results.length} results found
              </div>

              {query.trim() === '' && (
                <div className="px-4 py-2 text-xs text-gh-muted bg-gh-bg/50 border-b border-gh-border">
                  Recent files
                </div>
              )}

              {results.map((result, index) => (
                <CommandPaletteResult
                  key={`${result.sessionId}-${result.filePath}`}
                  result={result}
                  isSelected={index === selectedIndex}
                  onClick={() => handleSelect(result)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gh-bg border-t border-gh-border flex items-center justify-between text-[10px] text-gh-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gh-surface border border-gh-border rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gh-surface border border-gh-border rounded">↓</kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gh-surface border border-gh-border rounded">↵</kbd>
              <span className="ml-1">to select</span>
            </span>
          </div>

          <span>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export { useCommandPalette };
