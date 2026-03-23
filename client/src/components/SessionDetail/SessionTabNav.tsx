import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ActiveSubAgent } from '../../api/client.ts';

const MAX_PRIMARY_TABS = 8;

export interface SessionDetailTab {
  id: string;
  label: string;
  description?: string;
  isCompleted?: boolean;
  isSubAgent: boolean;
  isPlan?: boolean;
  isPlanPending?: boolean;
  isTodos?: boolean;
  isMain?: boolean;
  agent?: ActiveSubAgent;
  accentColor?: 'blue' | 'sky';
}

interface Props {
  tabs: SessionDetailTab[];
  activeId: string;
  onChange: (id: string) => void;
}

function sanitizeTabId(tabId: string) {
  const sanitized = tabId.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'tab';
}

export function getSessionDetailTabId(tabId: string) {
  return `session-detail-tab-${sanitizeTabId(tabId)}`;
}

export function getSessionDetailPanelId(tabId: string) {
  return `session-detail-panel-${sanitizeTabId(tabId)}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function TabIcon({ tab }: { tab: SessionDetailTab }) {
  if (tab.isPlan) {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gh-attention/12 text-gh-attention">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M0 1.75A.75.75 0 01.75 1h4.253c1.227 0 2.317.59 3 1.501A3.744 3.744 0 0111.006 1h4.245a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-4.507a2.25 2.25 0 00-1.591.659l-.622.621a.75.75 0 01-1.06 0l-.622-.621A2.25 2.25 0 005.258 13H.75a.75.75 0 01-.75-.75zm7.251 10.324l.022-.067v-8.51c-.09-.198-.2-.37-.33-.517A2.25 2.25 0 005.003 2.5H1.5v9.013h3.757a3.75 3.75 0 012-.689zm1.499-8.577v8.51l.022.068a3.75 3.75 0 012-.711H14.5V2.5h-3.244a2.25 2.25 0 00-1.852.979c-.13.148-.24.32-.154.518z" />
        </svg>
      </span>
    );
  }

  if (tab.isTodos) {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gh-active/12 text-gh-active">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h3.17a.75.75 0 010 1.5H2.75A1.75 1.75 0 011 13.25V1.75C1 .784 1.784 0 2.75 0h8.5C12.216 0 13 .784 13 1.75v7.736a.75.75 0 01-1.5 0V1.75a.25.25 0 00-.25-.25h-8.5a.25.25 0 00-.25.25zm11.03 9.58a.75.75 0 10-1.06-1.06l-2.97 2.97-1.22-1.22a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.5-3.5zM4.75 4a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm-.75 3.75A.75.75 0 014.75 7h2a.75.75 0 010 1.5h-2A.75.75 0 014 7.75z" />
        </svg>
      </span>
    );
  }

  if (tab.isSubAgent) {
    return (
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          tab.accentColor === 'sky' ? 'bg-sky-400/15 text-sky-400' : 'bg-gh-accent/15 text-gh-accent'
        }`}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
          <path d="M1.5 1.75a.25.25 0 01.25-.25h12.5a.25.25 0 010 .5H1.75a.25.25 0 01-.25-.25zM1.5 8a.25.25 0 01.25-.25h12.5a.25.25 0 010 .5H1.75A.25.25 0 011.5 8zm.25 5.75a.25.25 0 000 .5h12.5a.25.25 0 000-.5H1.75z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gh-accent/12 text-gh-accent">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M1.75 2A1.75 1.75 0 000 3.75v6.5C0 11.216.784 12 1.75 12h2.794l2.968 2.42a.75.75 0 001.238-.582V12h5.5A1.75 1.75 0 0016 10.25v-6.5A1.75 1.75 0 0014.25 2zm-.25 1.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v6.5a.25.25 0 01-.25.25H8A.75.75 0 007.25 11v1.174l-1.78-1.45A.75.75 0 005 10.56H1.75a.25.25 0 01-.25-.25z" />
      </svg>
    </span>
  );
}

function TabStateDot({ tab }: { tab: SessionDetailTab }) {
  if (tab.isPlanPending) {
    return <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gh-attention animate-pulse" aria-hidden="true" />;
  }

  if (tab.isSubAgent) {
    return (
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tab.isCompleted ? 'bg-gh-muted' : 'bg-gh-active animate-pulse'}`}
        aria-hidden="true"
      />
    );
  }

  return null;
}

export function SessionTabNav({ tabs, activeId, onChange }: Props) {
  const primaryTabs = tabs.slice(0, MAX_PRIMARY_TABS);
  const overflowTabs = tabs.slice(MAX_PRIMARY_TABS);
  const activeInOverflow = overflowTabs.some((tab) => tab.id === activeId);
  const [isMoreOpen, setIsMoreOpen] = useState(activeInOverflow);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (activeInOverflow) {
      setIsMoreOpen(true);
    }
  }, [activeInOverflow]);

  function focusTab(tab: SessionDetailTab) {
    if (overflowTabs.some((overflowTab) => overflowTab.id === tab.id)) {
      setIsMoreOpen(true);
    }

    onChange(tab.id);
    window.requestAnimationFrame(() => {
      tabRefs.current[tab.id]?.focus();
    });
  }

  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentId: string) {
    const currentIndex = tabs.findIndex((tab) => tab.id === currentId);
    if (currentIndex === -1) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(tabs[(currentIndex + 1) % tabs.length]);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusTab(tabs[0]);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusTab(tabs[tabs.length - 1]);
    }
  }

  function handleMoreKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (overflowTabs.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      setIsMoreOpen(true);
      focusTab(overflowTabs[0]);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(primaryTabs[primaryTabs.length - 1]);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusTab(tabs[0]);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setIsMoreOpen(true);
      focusTab(tabs[tabs.length - 1]);
    }
  }

  function renderTabButton(tab: SessionDetailTab) {
    const isActive = tab.id === activeId;

    return (
      <button
        key={tab.id}
        ref={(element) => {
          tabRefs.current[tab.id] = element;
        }}
        id={getSessionDetailTabId(tab.id)}
        role="tab"
        type="button"
        aria-selected={isActive}
        aria-controls={getSessionDetailPanelId(tab.id)}
        tabIndex={isActive ? 0 : -1}
        title={tab.label}
        onClick={() => onChange(tab.id)}
        onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
        className={`group flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors duration-200 focus:outline-none focus-visible:border-gh-accent/60 focus-visible:bg-gh-surface/80 focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface focus-visible:shadow-[0_0_0_1px_rgba(47,129,247,0.45)] ${
          isActive
            ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-text'
            : 'border-transparent bg-transparent text-gh-muted hover:border-gh-border hover:bg-gh-surface/70 hover:text-gh-text'
        }`}
      >
        <TabIcon tab={tab} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="truncate text-sm font-medium leading-5">{tab.label}</span>
            <TabStateDot tab={tab} />
          </span>
          {tab.description && (
            <span className="mt-1 block break-words text-xs leading-5 text-gh-muted/90">
              {tab.description}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="min-h-0 space-y-1.5 overflow-y-auto pr-1"
        role="tablist"
        aria-label="Session detail navigation"
        aria-orientation="vertical"
      >
        {primaryTabs.map(renderTabButton)}
      </div>

      {overflowTabs.length > 0 && (
        <div className="mt-3 border-t border-gh-border/70 pt-3">
          <button
            type="button"
            onClick={() => setIsMoreOpen((previous) => !previous)}
            onKeyDown={handleMoreKeyDown}
            aria-expanded={isMoreOpen}
            aria-controls="session-tab-nav-overflow"
            className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:border-gh-accent/60 focus-visible:bg-gh-surface/80 focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface focus-visible:shadow-[0_0_0_1px_rgba(47,129,247,0.45)] ${
              activeInOverflow || isMoreOpen
                ? 'border-gh-accent/30 bg-gh-accent/10 text-gh-text'
                : 'border-gh-border/70 bg-gh-bg/70 text-gh-muted hover:border-gh-border hover:text-gh-text'
            }`}
          >
            <span>More threads</span>
            <span className="flex items-center gap-2">
              <span className="text-gh-muted/80">{pluralize(overflowTabs.length, 'tab')}</span>
              <svg
                viewBox="0 0 16 16"
                width="12"
                height="12"
                fill="currentColor"
                className={`transition-transform duration-200 ${isMoreOpen ? 'rotate-90' : ''}`}
                aria-hidden="true"
              >
                <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
              </svg>
            </span>
          </button>

          {isMoreOpen && (
            <div
              id="session-tab-nav-overflow"
              className="mt-2 max-h-64 space-y-1.5 overflow-y-auto border-l border-gh-border/70 pl-2 pr-1"
              role="tablist"
              aria-label="Additional session detail threads"
              aria-orientation="vertical"
            >
              {overflowTabs.map(renderTabButton)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
