import React, { useCallback, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  desktopMarkdownComponents,
  mobileMarkdownComponents,
  desktopBaseHeadingClasses,
  mobileBaseHeadingClasses,
} from './MarkdownRenderer.js';

interface MarkdownSection {
  level: number;
  title: string;
  id: string;
  headingLine: string;
  body: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
}

export function parseMarkdownSections(content: string): { prelude: string; sections: MarkdownSection[] } | null {
  const lines = content.replace(/\r/g, '').split('\n');
  const headings: Array<{ index: number; level: number; title: string; line: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.+)$/m.exec(lines[i]);
    if (match) {
      headings.push({
        index: i,
        level: match[1].length,
        title: match[2].trim(),
        line: lines[i],
      });
    }
  }

  if (headings.length === 0) return null;

  const sections: MarkdownSection[] = [];
  const prelude = headings[0].index > 0 ? lines.slice(0, headings[0].index).join('\n') : '';

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const startIndex = h.index + 1;
    let endIndex = lines.length;

    for (let j = i + 1; j < headings.length; j++) {
      // Stop at the next heading of any level to prevent child heading content
      // from appearing in parent body (fixes duplicate content bug)
      endIndex = headings[j].index;
      break;
    }

    sections.push({
      level: h.level,
      title: stripMarkdownInline(h.title),
      id: `${slugify(h.title)}-${i}`,
      headingLine: h.line,
      body: lines.slice(startIndex, endIndex).join('\n'),
    });
  }

  return { prelude, sections };
}

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className={className}>
      <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
    </svg>
  );
}

function SectionHeading({
  level,
  children,
  variant,
  isExpanded,
  onToggle,
}: {
  level: number;
  children: React.ReactNode;
  variant: 'desktop' | 'mobile';
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const classes = variant === 'mobile' ? mobileBaseHeadingClasses : desktopBaseHeadingClasses;
  const className = classes[`h${level}` as keyof typeof classes];
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full items-start gap-1.5 text-left"
      aria-expanded={isExpanded}
      title={isExpanded ? 'Collapse section' : 'Expand section'}
    >
      <span className="shrink-0 rounded-md p-1.5 text-gh-muted transition-colors hover:text-gh-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 mt-0.5 -ml-1.5">
        <ChevronIcon className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
      </span>
      <Tag className={`${className} flex-1 cursor-pointer group-hover:text-gh-accent transition-colors`}>
        {children}
      </Tag>
    </button>
  );
}

function Outline({
  sections,
  variant,
  onJump,
  activeId,
}: {
  sections: MarkdownSection[];
  variant: 'desktop' | 'mobile';
  onJump: (id: string) => void;
  activeId?: string;
}) {
  if (variant === 'mobile') {
    return (
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onJump(section.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeId === section.id
                  ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-accent'
                  : 'border-gh-border bg-gh-bg text-gh-muted hover:border-gh-accent/30 hover:text-gh-text'
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {sections.map((section) => (
        <li key={section.id} style={{ paddingLeft: `${(section.level - 1) * 12}px` }}>
          <button
            type="button"
            onClick={() => onJump(section.id)}
            className={`w-full text-left text-xs transition-colors hover:text-gh-accent ${
              activeId === section.id ? 'text-gh-accent font-medium' : 'text-gh-text'
            }`}
          >
            {section.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CollapsibleMarkdown({
  content,
  variant,
  className = '',
}: {
  content: string;
  variant: 'desktop' | 'mobile';
  className?: string;
}) {
  const parsed = useMemo(() => parseMarkdownSections(content), [content]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set(parsed?.sections.map((s) => s.id) ?? []);
  });
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>();

  const components = useMemo(() => {
    return variant === 'mobile' ? mobileMarkdownComponents : desktopMarkdownComponents;
  }, [variant]);

  const toggleSection = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (parsed) {
      setExpandedIds(new Set(parsed.sections.map((s) => s.id)));
    }
  }, [parsed]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const jumpToSection = useCallback((id: string) => {
    setActiveSectionId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (!parsed || parsed.sections.length < 2) {
    return (
      <div className={`markdown-viewer ${className}`}>
        <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml={false}>
          {content}
        </Markdown>
      </div>
    );
  }

  const allExpanded = expandedIds.size === parsed.sections.length && parsed.sections.length > 0;

  return (
    <div className={`markdown-viewer ${className}`}>
      <div className="mb-4 rounded-xl border border-gh-border bg-gh-surface/20 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gh-muted">Sections</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-xs font-medium text-gh-accent hover:text-gh-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={allExpanded}
            >
              Expand all
            </button>
            <span className="text-gh-border">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-xs font-medium text-gh-accent hover:text-gh-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={expandedIds.size === 0}
            >
              Collapse all
            </button>
          </div>
        </div>
        <Outline sections={parsed.sections} variant={variant} onJump={jumpToSection} activeId={activeSectionId} />
      </div>

      {parsed.prelude && (
        <div className="mb-4">
          <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml={false}>
            {parsed.prelude}
          </Markdown>
        </div>
      )}

      <div className="space-y-4">
        {parsed.sections.map((section) => {
          const isExpanded = expandedIds.has(section.id);
          return (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <SectionHeading
                level={section.level}
                variant={variant}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(section.id)}
              >
                {section.title}
              </SectionHeading>
              {isExpanded && (
                <div className={variant === 'mobile' ? 'pl-5' : 'pl-6'}>
                  <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml={false}>
                    {section.body}
                  </Markdown>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
