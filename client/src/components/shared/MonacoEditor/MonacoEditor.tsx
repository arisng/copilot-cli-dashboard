import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';

export interface MonacoEditorProps {
  /** File content to display */
  content: string;
  /** File name for language detection */
  fileName: string;
  /** File path for model URI */
  filePath: string;
  /** Session ID for unique model URI */
  sessionId: string;
  /** Monaco language ID (auto-detected from fileName if not provided) */
  language?: string;
  /** Optional CSS class name */
  className?: string;
  /** Whether the editor should be read-only (default: true for artifact viewing) */
  readOnly?: boolean;
}

// GitHub Dark theme colors matching the dashboard theme
const GITHUB_DARK_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'FF7B72' },
    { token: 'operator', foreground: 'FF7B72' },
    { token: 'string', foreground: 'A5D6FF' },
    { token: 'string.escape', foreground: '79C0FF' },
    { token: 'number', foreground: '79C0FF' },
    { token: 'regexp', foreground: 'A5D6FF' },
    { token: 'type', foreground: 'FFA657' },
    { token: 'class', foreground: 'FFA657' },
    { token: 'function', foreground: 'D2A8FF' },
    { token: 'identifier', foreground: 'E6EDF3' },
    { token: 'tag', foreground: '7EE787' },
    { token: 'attribute.name', foreground: 'D2A8FF' },
    { token: 'attribute.value', foreground: 'A5D6FF' },
    { token: 'delimiter', foreground: 'E6EDF3' },
    { token: 'predefined', foreground: '79C0FF' },
  ],
  colors: {
    'editor.background': '#0D1117',
    'editor.foreground': '#E6EDF3',
    'editor.lineHighlightBackground': '#161B22',
    'editor.lineHighlightBorder': '#30363D',
    'editor.selectionBackground': '#264F78',
    'editor.inactiveSelectionBackground': '#264F7855',
    'editorCursor.foreground': '#58A6FF',
    'editorLineNumber.foreground': '#6E7681',
    'editorLineNumber.activeForeground': '#E6EDF3',
    'editorGutter.background': '#0D1117',
    'editor.findMatchBackground': '#9E6A03',
    'editor.findMatchHighlightBackground': '#9E6A0355',
    'editor.findRangeHighlightBackground': '#264F7855',
    'editor.hoverHighlightBackground': '#264F7840',
    'editor.wordHighlightBackground': '#6E768140',
    'editor.wordHighlightStrongBackground': '#6E768160',
    'editorBracketMatch.background': '#6E768140',
    'editorBracketMatch.border': '#58A6FF',
    'editorCodeLens.foreground': '#6E7681',
    'editorLink.activeForeground': '#58A6FF',
    'editorOverviewRuler.border': '#30363D',
    'editorOverviewRuler.findMatchForeground': '#9E6A03',
    'editorOverviewRuler.rangeHighlightForeground': '#264F78',
    'editorOverviewRuler.selectionHighlightForeground': '#264F78',
    'editorOverviewRuler.wordHighlightForeground': '#6E7681',
    'editorOverviewRuler.wordHighlightStrongForeground': '#6E7681',
    'editorOverviewRuler.modifiedForeground': '#1F6FEB',
    'editorOverviewRuler.addedForeground': '#238636',
    'editorOverviewRuler.deletedForeground': '#DA3633',
    'editorOverviewRuler.errorForeground': '#F85149',
    'editorOverviewRuler.warningForeground': '#D29922',
    'editorOverviewRuler.infoForeground': '#58A6FF',
    'editorRuler.foreground': '#30363D',
    'editorSuggestWidget.background': '#161B22',
    'editorSuggestWidget.border': '#30363D',
    'editorSuggestWidget.foreground': '#E6EDF3',
    'editorSuggestWidget.highlightForeground': '#58A6FF',
    'editorSuggestWidget.selectedBackground': '#264F78',
    'peekView.border': '#1F6FEB',
    'peekViewEditor.background': '#0D1117',
    'peekViewEditor.matchHighlightBackground': '#9E6A03',
    'peekViewEditorGutter.background': '#0D1117',
    'peekViewResult.background': '#161B22',
    'peekViewResult.fileForeground': '#E6EDF3',
    'peekViewResult.lineForeground': '#8B949E',
    'peekViewResult.matchHighlightBackground': '#9E6A03',
    'peekViewResult.selectionBackground': '#264F78',
    'peekViewResult.selectionForeground': '#E6EDF3',
    'peekViewTitle.background': '#161B22',
    'peekViewTitleDescription.foreground': '#8B949E',
    'peekViewTitleLabel.foreground': '#E6EDF3',
  },
};

// Lazy-load Monaco to avoid initial bundle impact
let monacoInstance: typeof import('monaco-editor') | null = null;
let monacoLoadPromise: Promise<typeof import('monaco-editor')> | null = null;

async function loadMonaco(): Promise<typeof import('monaco-editor')> {
  if (monacoInstance) {
    return monacoInstance;
  }
  
  if (monacoLoadPromise) {
    return monacoLoadPromise;
  }
  
  monacoLoadPromise = import('monaco-editor').then((monaco) => {
    monacoInstance = monaco;
    
    // Define GitHub Dark theme
    monaco.editor.defineTheme('github-dark', GITHUB_DARK_THEME);
    
    // Set default options for all editors
    monaco.editor.setTheme('github-dark');
    
    return monaco;
  });
  
  return monacoLoadPromise;
}

/**
 * Monaco Editor component for displaying artifact files.
 * 
 * Features:
 * - Lazy-loaded Monaco bundle (only loads when first used)
 * - GitHub Dark theme matching the dashboard
 * - Read-only mode for artifact viewing
 * - Automatic language detection from file extension
 * - Proper model cleanup on unmount/file change
 * - Line numbers and syntax highlighting
 */
export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  content,
  fileName,
  filePath,
  sessionId,
  language: providedLanguage,
  className = '',
  readOnly = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<editor.ITextModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize the model URI to ensure stability
  const modelUri = useMemo(() => {
    // Create a unique URI for this file in this session
    const safePath = filePath.replace(/[^a-zA-Z0-9-_./]/g, '_');
    return `inmemory://sessions/${sessionId}/${safePath}`;
  }, [filePath, sessionId]);

  // Determine language from file extension if not provided
  const language = useMemo(() => {
    if (providedLanguage) return providedLanguage;
    
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'cjs': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'markdown': 'markdown',
      'mdown': 'markdown',
      'mkdn': 'markdown',
      'mkd': 'markdown',
      'xml': 'xml',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'pl': 'perl',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'toml': 'ini',
      'ini': 'ini',
      'conf': 'ini',
      'config': 'ini',
      'properties': 'ini',
      'graphql': 'graphql',
      'gql': 'graphql',
      'proto': 'protobuf',
      'dockerfile': 'dockerfile',
    };
    
    // Check for filename-based matches (e.g., "Dockerfile")
    const baseName = fileName.toLowerCase().split('/').pop()?.split('\\').pop() ?? '';
    const filenameMap: Record<string, string> = {
      'dockerfile': 'dockerfile',
      'dockerfile.prod': 'dockerfile',
      'dockerfile.dev': 'dockerfile',
      'makefile': 'makefile',
      'gemfile': 'ruby',
      'rakefile': 'ruby',
      'jenkinsfile': 'groovy',
    };
    
    return filenameMap[baseName] ?? languageMap[ext] ?? 'plaintext';
  }, [fileName, providedLanguage]);

  // Initialize editor
  useEffect(() => {
    let isCancelled = false;
    
    async function initEditor() {
      try {
        setIsLoading(true);
        setError(null);
        
        const monaco = await loadMonaco();
        
        if (isCancelled || !containerRef.current) {
          return;
        }

        // Create model with unique URI
        const uri = monaco.Uri.parse(modelUri);
        
        // Dispose existing model for this URI if it exists
        const existingModel = monaco.editor.getModel(uri);
        if (existingModel) {
          existingModel.dispose();
        }
        
        modelRef.current = monaco.editor.createModel(content, language, uri);
        
        // Create editor
        editorRef.current = monaco.editor.create(containerRef.current, {
          model: modelRef.current,
          theme: 'github-dark',
          readOnly,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'line',
          fontSize: 13,
          fontFamily: 'JetBrains Mono, Monaco, Menlo, Consolas, monospace',
          lineNumbers: 'on',
          folding: true,
          wordWrap: 'on',
          wrappingStrategy: 'advanced',
          renderWhitespace: 'selection',
          scrollbar: {
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            vertical: 'auto',
            horizontal: 'auto',
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          renderValidationDecorations: 'off',
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          wordBasedSuggestions: 'off',
          occurrencesHighlight: 'off',
          codeLens: false,
          colorDecorators: false,
        });
        
        setIsLoading(false);
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize editor');
          setIsLoading(false);
        }
      }
    }
    
    initEditor();
    
    return () => {
      isCancelled = true;
      
      // Clean up editor and model
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
      
      if (modelRef.current) {
        modelRef.current.dispose();
        modelRef.current = null;
      }
    };
  }, [modelUri, language, readOnly]);

  // Update content when it changes
  useEffect(() => {
    if (modelRef.current && editorRef.current) {
      const currentValue = modelRef.current.getValue();
      if (currentValue !== content) {
        modelRef.current.setValue(content);
      }
    }
  }, [content]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      editorRef.current?.layout();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (error) {
    return (
      <div className={`rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention ${className}`}>
        <p className="font-medium">Unable to load editor</p>
        <p className="mt-1 opacity-80">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gh-bg/50 rounded-xl z-10">
          <div className="flex items-center gap-2 text-sm text-gh-muted">
            <svg className="animate-spin h-4 w-4 text-gh-accent" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading editor…
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="rounded-xl border border-gh-border overflow-hidden"
        style={{ height: '600px', minHeight: '300px' }}
      />
    </div>
  );
};

export default MonacoEditor;
