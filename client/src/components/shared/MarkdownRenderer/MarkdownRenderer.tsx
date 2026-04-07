import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CollapsibleMarkdown } from './CollapsibleMarkdown.js';
import type { Components } from 'react-markdown';

// ============================================================================
// XML Tag Normalization
// ============================================================================

const KNOWN_XML_TAGS = new Set([
  'overview',
  'history',
  'work_done',
  'technical_details',
  'section',
]);

/**
 * Convert tag name to title case for headings
 * e.g., 'work_done' -> 'Work Done', 'technical_details' -> 'Technical Details'
 */
function toTitleCase(tagName: string): string {
  return tagName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Normalize known structural XML tags to markdown headings.
 * Unknown tags are preserved as-is for inline rendering.
 */
export function normalizeXmlTags(content: string): string {
  // Match XML-like tags with content: <tagname>...</tagname>
  // Handle multiline content using [\s\S] instead of .
  const tagRegex = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g;

  return content.replace(tagRegex, (match, tagName: string, innerContent: string) => {
    const lowerTag = tagName.toLowerCase();

    if (!KNOWN_XML_TAGS.has(lowerTag)) {
      // Unknown tag - keep as-is for inline rendering
      return match;
    }

    if (lowerTag === 'section') {
      // <section> just unwraps the content directly
      return innerContent.trim();
    }

    // Known structural tags become h2 headings
    const heading = toTitleCase(tagName);
    return `## ${heading}\n\n${innerContent.trim()}`;
  });
}
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';

// Register languages for syntax highlighting
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);

export interface MarkdownRendererProps {
  content: string;
  variant?: 'desktop' | 'mobile' | 'message';
  className?: string;
  sanitize?: boolean;
  collapsible?: boolean;
}

// ============================================================================
// Shared Base Styles
// ============================================================================

export const desktopBaseHeadingClasses = {
  h1: 'text-base font-bold text-gh-text border-b border-gh-border pb-2 mb-4 mt-6 first:mt-0',
  h2: 'text-sm font-semibold text-gh-accent mt-5 mb-2',
  h3: 'text-xs font-semibold text-gh-text uppercase tracking-wide mt-4 mb-1.5 opacity-80',
  h4: 'text-xs font-semibold text-gh-text mt-3 mb-1',
  h5: 'text-xs font-medium text-gh-muted mt-3 mb-1',
  h6: 'text-xs font-medium text-gh-muted mt-3 mb-1 opacity-70',
};

export const mobileBaseHeadingClasses = {
  h1: 'mb-3 border-b border-gh-border pb-2 text-base font-semibold text-gh-text first:mt-0',
  h2: 'mb-2 mt-4 text-sm font-semibold text-gh-accent',
  h3: 'mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-gh-muted',
  h4: 'mb-1.5 mt-3 text-xs font-semibold text-gh-text',
  h5: 'mb-1 mt-3 text-xs font-medium text-gh-muted',
  h6: 'mb-1 mt-3 text-xs font-medium text-gh-muted opacity-70',
};

const baseTextClasses = {
  p: 'text-sm text-gh-text leading-relaxed mb-3',
  strong: 'font-semibold text-gh-text',
  em: 'italic text-gh-text',
  del: 'line-through text-gh-muted',
};

// ============================================================================
// Desktop Components
// ============================================================================

export const desktopMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className={desktopBaseHeadingClasses.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={desktopBaseHeadingClasses.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={desktopBaseHeadingClasses.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={desktopBaseHeadingClasses.h4}>{children}</h4>,
  h5: ({ children }) => <h5 className={desktopBaseHeadingClasses.h5}>{children}</h5>,
  h6: ({ children }) => <h6 className={desktopBaseHeadingClasses.h6}>{children}</h6>,
  
  p: ({ children }) => <p className={baseTextClasses.p}>{children}</p>,
  strong: ({ children }) => <strong className={baseTextClasses.strong}>{children}</strong>,
  em: ({ children }) => <em className={baseTextClasses.em}>{children}</em>,
  del: ({ children }) => <del className={baseTextClasses.del}>{children}</del>,
  
  // List handling with proper nesting support
  ul: ({ children, ...props }) => (
    <ul className="space-y-1 mb-3 pl-0 list-none [&_ul]:ml-4 [&_ol]:ml-4" {...props}>
      {children}
    </ul>
  ),
  
  ol: ({ children, ...props }) => (
    <ol className="space-y-1.5 mb-3 pl-0 list-none counter-reset-[item] [&_ul]:ml-4 [&_ol]:ml-4" {...props}>
      {children}
    </ol>
  ),
  
  li: ({ children, ...props }) => {
    // Detect task list items (checkboxes)
    const childArr = Array.isArray(children) ? children : [children];
    const hasCheckbox = childArr.some(
      (c) => typeof c === 'object' && c !== null && (c as React.ReactElement)?.type === 'input'
    );
    
    // Check if this li contains nested lists (ul or ol)
    const hasNestedList = childArr.some(
      (c) => typeof c === 'object' && c !== null && 
        ((c as React.ReactElement)?.type === 'ul' || (c as React.ReactElement)?.type === 'ol')
    );
    
    if (hasCheckbox) {
      return (
        <li className="flex items-start gap-2 text-sm text-gh-text py-0.5" {...props}>
          {children}
        </li>
      );
    }
    
    // For items with nested lists, use block layout instead of flex to allow proper nesting
    if (hasNestedList) {
      return (
        <li 
          className="text-sm text-gh-text py-0.5 pl-4 relative before:content-['›'] before:text-gh-accent before:font-bold before:absolute before:left-0 before:top-0.5" 
          {...props}
        >
          {children}
        </li>
      );
    }
    
    return (
      <li 
        className="flex items-start gap-2 text-sm text-gh-text py-0.5 before:content-['›'] before:text-gh-accent before:font-bold before:shrink-0 before:mt-px" 
        {...props}
      >
        {children}
      </li>
    );
  },
  
  input: ({ type, checked }) => {
    if (type === 'checkbox') {
      return (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 mt-0.5 ${
          checked ? 'bg-gh-active border-gh-active text-white' : 'border-gh-border bg-gh-surface'
        }`}>
          {checked && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
        </span>
      );
    }
    return <input type={type} readOnly />;
  },
  
  code: ({ inline, className, children }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    if (!inline && language) {
      return (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: '0.75rem 0',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            border: '1px solid #30363d',
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }
    
    return inline ? (
      <code className="text-xs font-mono bg-gh-surface text-gh-accent px-1.5 py-0.5 rounded border border-gh-border/50">
        {children}
      </code>
    ) : (
      <code className="text-xs font-mono bg-gh-surface text-gh-accent px-1.5 py-0.5 rounded border border-gh-border/50 block overflow-x-auto">
        {children}
      </code>
    );
  },
  
  pre: ({ children }) => (
    <pre className="bg-gh-surface border border-gh-border rounded-lg p-3 overflow-x-auto text-xs font-mono text-gh-text mb-3 leading-relaxed">
      {children}
    </pre>
  ),
  
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gh-accent/50 pl-3 text-gh-muted italic text-sm mb-3">
      {children}
    </blockquote>
  ),
  
  a: ({ children, href }) => (
    <a 
      href={href} 
      className="text-gh-accent hover:underline" 
      target="_blank" 
      rel="noopener noreferrer nofollow"
    >
      {children}
    </a>
  ),
  
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  
  thead: ({ children }) => <thead className="bg-gh-surface">{children}</thead>,
  
  th: ({ children }) => (
    <th className="text-left px-3 py-2 text-gh-muted font-medium border border-gh-border">
      {children}
    </th>
  ),
  
  td: ({ children }) => (
    <td className="px-3 py-2 text-gh-text border border-gh-border">
      {children}
    </td>
  ),
  
  tr: ({ children }) => <tr className="even:bg-gh-surface/30">{children}</tr>,
  
  tbody: ({ children }) => <tbody>{children}</tbody>,
  
  hr: () => <hr className="border-gh-border my-4" />,
  
  // Preserve XML-like tags as plain text
  // @ts-expect-error - react-markdown doesn't expose this in types but it works
  html: ({ value }) => {
    // Render XML-like tags as preformatted text to preserve structure
    if (value && value.startsWith('<') && value.endsWith('>')) {
      return <span className="font-mono text-gh-accent text-xs">{value}</span>;
    }
    return <>{value}</>;
  },
};

// ============================================================================
// Mobile Components
// ============================================================================

export const mobileMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className={mobileBaseHeadingClasses.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={mobileBaseHeadingClasses.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={mobileBaseHeadingClasses.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={mobileBaseHeadingClasses.h4}>{children}</h4>,
  h5: ({ children }) => <h5 className={mobileBaseHeadingClasses.h5}>{children}</h5>,
  h6: ({ children }) => <h6 className={mobileBaseHeadingClasses.h6}>{children}</h6>,
  
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-gh-text">
      {children}
    </p>
  ),
  
  strong: ({ children }) => (
    <strong className="font-semibold text-gh-text">
      {children}
    </strong>
  ),
  
  em: ({ children }) => (
    <em className="italic text-gh-text">
      {children}
    </em>
  ),
  
  del: ({ children }) => (
    <del className="line-through text-gh-muted">
      {children}
    </del>
  ),
  
  // Lists with proper nesting for mobile
  ul: ({ children }) => (
    <ul className="mb-3 space-y-1.5 pl-4 text-sm text-gh-text list-disc marker:text-gh-muted">
      {children}
    </ul>
  ),
  
  ol: ({ children }) => (
    <ol className="mb-3 space-y-1.5 pl-4 text-sm text-gh-text list-decimal marker:text-gh-muted">
      {children}
    </ol>
  ),
  
  li: ({ children }) => (
    <li className="leading-relaxed pl-1">
      {children}
    </li>
  ),
  
  input: ({ type, checked }) => {
    if (type === 'checkbox') {
      return (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 mt-0.5 mr-2 ${
          checked ? 'bg-gh-active border-gh-active text-white' : 'border-gh-border bg-gh-surface'
        }`}>
          {checked && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
        </span>
      );
    }
    return <input type={type} readOnly />;
  },
  
  code: ({ inline, className, children }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    if (!inline && language) {
      return (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: '0.75rem 0',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            border: '1px solid #30363d',
            maxWidth: '100vw',
            overflowX: 'auto',
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }
    
    return inline ? (
      <code className="rounded border border-gh-border/60 bg-gh-bg px-1.5 py-0.5 font-mono text-xs text-gh-accent">
        {children}
      </code>
    ) : (
      <code className="rounded border border-gh-border/60 bg-gh-bg px-1.5 py-0.5 font-mono text-xs text-gh-accent block overflow-x-auto">
        {children}
      </code>
    );
  },
  
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl border border-gh-border bg-gh-bg p-3 text-xs leading-relaxed text-gh-text">
      {children}
    </pre>
  ),
  
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-gh-accent/50 pl-3 text-sm italic text-gh-muted">
      {children}
    </blockquote>
  ),
  
  a: ({ children, href }) => (
    <a 
      href={href} 
      className="text-gh-accent hover:underline" 
      target="_blank" 
      rel="noopener noreferrer nofollow"
    >
      {children}
    </a>
  ),
  
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto rounded-xl border border-gh-border">
      <table className="min-w-full text-left text-xs">{children}</table>
    </div>
  ),
  
  thead: ({ children }) => <thead className="bg-gh-bg/80 text-gh-muted">{children}</thead>,
  
  tbody: ({ children }) => <tbody className="divide-y divide-gh-border/60">{children}</tbody>,
  
  th: ({ children }) => (
    <th className="px-3 py-2 font-medium">{children}</th>
  ),
  
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-gh-text">{children}</td>
  ),
  
  tr: ({ children }) => <tr>{children}</tr>,
  
  hr: () => <hr className="my-4 border-gh-border" />,
  
  // @ts-expect-error - react-markdown doesn't expose this in types but it works
  html: ({ value }) => {
    if (value && value.startsWith('<') && value.endsWith('>')) {
      return <span className="font-mono text-gh-accent text-xs">{value}</span>;
    }
    return <>{value}</>;
  },
};

// ============================================================================
// Message Components (for MessageBubble)
// ============================================================================

export const messageMarkdownComponents: Components = {
  ...desktopMarkdownComponents,
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  h1: ({ children }) => (
    <h1 className="text-gh-text text-base font-semibold mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-gh-text text-sm font-semibold mt-3 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-gh-text text-sm font-semibold mt-3 mb-1">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 pl-4 list-disc marker:text-gh-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 pl-4 list-decimal marker:text-gh-muted">{children}</ol>
  ),
  li: ({ children }) => <li className="my-0.5 leading-relaxed">{children}</li>,
  code: ({ inline, className, children }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    if (!inline && language) {
      return (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: '0.75rem 0',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            border: '1px solid #30363d',
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }
    
    return inline ? (
      <code className="text-gh-accent bg-gh-bg px-1.5 py-0.5 rounded text-xs font-mono border border-gh-border/50">
        {children}
      </code>
    ) : (
      <code className="text-gh-accent bg-gh-bg px-1.5 py-0.5 rounded text-xs font-mono border border-gh-border/50 block overflow-x-auto">
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gh-border pl-3 text-gh-muted my-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <table className="w-full border-collapse my-3 text-sm">{children}</table>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-1.5 border border-gh-border bg-gh-surface text-gh-text font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 border border-gh-border text-gh-muted">
      {children}
    </td>
  ),
  a: ({ children, href }) => (
    <a 
      href={href} 
      className="text-gh-accent no-underline hover:underline" 
      target="_blank" 
      rel="noopener noreferrer nofollow"
    >
      {children}
    </a>
  ),
};

// ============================================================================
// Main Component
// ============================================================================

export function MarkdownRenderer({ 
  content, 
  variant = 'desktop',
  className = '',
  sanitize = true,
  collapsible = false,
}: MarkdownRendererProps) {
  const components = useMemo(() => {
    switch (variant) {
      case 'mobile':
        return mobileMarkdownComponents;
      case 'message':
        return messageMarkdownComponents;
      case 'desktop':
      default:
        return desktopMarkdownComponents;
    }
  }, [variant]);

  // Sanitize content and normalize XML tags
  const sanitizedContent = useMemo(() => {
    // First normalize XML tags to markdown
    let processed = normalizeXmlTags(content);
    
    if (!sanitize) return processed;
    
    // Basic sanitization: remove script tags and dangerous attributes
    // Allow common markdown content including XML-like tags
    return processed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[Script removed]')
      .replace(/javascript:/gi, 'disabled-javascript:');
  }, [content, sanitize]);

  if (!content.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-gh-border bg-gh-surface/20 p-4 text-sm text-gh-muted">
        No content to display.
      </div>
    );
  }

  if (collapsible && variant !== 'message') {
    return <CollapsibleMarkdown content={sanitizedContent} variant={variant} className={className} />;
  }

  return (
    <div className={className}>
      <Markdown 
        remarkPlugins={[remarkGfm]}
        components={components}
        // Allow HTML to pass through for XML-like tags - we sanitize manually above
        skipHtml={false}
      >
        {sanitizedContent}
      </Markdown>
    </div>
  );
}

// Convenience export of all markdown components
export const markdownComponents = {
  desktop: desktopMarkdownComponents,
  mobile: mobileMarkdownComponents,
  message: messageMarkdownComponents,
};

// ============================================================================
// Loading/Error/Empty States
// ============================================================================

export function MarkdownLoadingState() {
  return (
    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4">
      <div className="flex items-center gap-2 text-sm text-gh-muted">
        <svg className="animate-spin h-4 w-4 text-gh-accent" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Loading content…
      </div>
    </div>
  );
}

export function MarkdownErrorState({ error }: { error: string }) {
  return (
    <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
      <p className="font-medium">Unable to render content</p>
      <p className="mt-1 opacity-80">{error}</p>
    </div>
  );
}

export function MarkdownEmptyState({ message = 'No content available.' }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gh-border bg-gh-surface/20 p-4 text-sm text-gh-muted">
      {message}
    </div>
  );
}
