import { useState } from 'react';
import { formatBytes } from '../../utils/fileUtils.ts';

interface ImagePreviewProps {
  sessionId: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
}

type ImageLoadState = 'loading' | 'success' | 'error';

export function ImagePreview({ sessionId, filePath, fileName, fileSizeBytes }: ImagePreviewProps) {
  const [loadState, setLoadState] = useState<ImageLoadState>('loading');
  const [retryKey, setRetryKey] = useState(0);

  const imageUrl = `/api/sessions/${encodeURIComponent(sessionId)}/artifacts/file?path=${encodeURIComponent(filePath)}&_t=${retryKey}`;

  const handleRetry = () => {
    setLoadState('loading');
    setRetryKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* File info header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[11px] text-gh-muted">
          image
        </span>
        <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[11px] text-gh-muted">
          {formatBytes(fileSizeBytes)}
        </span>
        <span className="text-[11px] font-mono text-gh-muted">{filePath}</span>
      </div>

      {/* Image container */}
      <div className="rounded-xl border border-gh-border bg-gh-bg/50 p-4">
        {loadState === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-sm text-gh-muted">
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading image...</span>
            </div>
          </div>
        )}

        {loadState === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full border border-gh-attention/30 bg-gh-attention/10 p-3">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
                className="text-gh-attention"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gh-text">Failed to load image</p>
              <p className="mt-1 text-xs text-gh-muted">
                The image could not be loaded. It may be corrupted or in an unsupported format.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gh-border bg-gh-bg px-3 py-1.5 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                  <path d="M4.5 2.75a.75.75 0 00-1.107-.66l-3 1.75a.75.75 0 000 1.32l3 1.75a.75.75 0 001.107-.66V5.5h7.25a.25.25 0 00.25-.25V2.75a.75.75 0 00-1.5 0v1.5h-6v-1.5zM15.25 9.5H8v-1.25a.75.75 0 00-1.107-.66l-3 1.75a.75.75 0 000 1.32l3 1.75a.75.75 0 001.107-.66V11h7.25a.25.25 0 00.25-.25V9.5z" />
                </svg>
                Retry
              </button>
              <a
                href={imageUrl}
                download={fileName}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gh-border bg-gh-bg px-3 py-1.5 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                  <path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z" />
                </svg>
                Download
              </a>
            </div>
          </div>
        )}

        {loadState !== 'error' && (
          <img
            key={retryKey}
            src={imageUrl}
            alt={fileName}
            className={`max-w-full rounded-lg ${loadState === 'success' ? 'opacity-100' : 'opacity-0'}`}
            style={{ maxHeight: '70vh' }}
            onLoad={() => setLoadState('success')}
            onError={() => setLoadState('error')}
          />
        )}
      </div>

      {/* Download link */}
      {loadState === 'success' && (
        <div className="flex justify-end">
          <a
            href={imageUrl}
            download={fileName}
            className="inline-flex items-center gap-1.5 text-xs text-gh-accent transition-colors hover:text-gh-text"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
              <path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z" />
            </svg>
            Download image
          </a>
        </div>
      )}
    </div>
  );
}
