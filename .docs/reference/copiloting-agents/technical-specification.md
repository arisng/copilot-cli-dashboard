# Copilot Sessions Dashboard — Technical Specification

> Complete technical reference for the Copilot Sessions Dashboard implementation.  
> **Version:** 1.0.0  
> **Last Updated:** 2026-04-10

---

## 1. Architecture Overview

### 1.1 Project Structure

```
copiloting-agents/
├── client/                    # React 18 SPA (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── api/              # API client and TypeScript types
│   │   ├── components/       # React components (see §4)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── styles/           # Global CSS and Tailwind directives
│   │   ├── utils/            # Utility functions
│   │   ├── App.tsx           # Main app with routing
│   │   └── main.tsx          # React entry point
│   ├── tailwind.config.ts    # Tailwind configuration (see §3)
│   ├── vite.config.ts        # Vite build configuration
│   └── index.html            # HTML entry point
├── server/                    # Express API (Node.js + TypeScript)
│   └── src/
│       ├── index.ts          # Server entry point
│       ├── router.ts         # Express route handlers
│       ├── sessionReader.ts  # Core session parsing logic
│       └── utils/            # Utility modules
├── package.json              # Root package with npm workspaces
└── AGENTS.md                 # Project documentation
```

### 1.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Server Framework** | Express | 4.x | REST API server |
| **Client Framework** | React | 18.x | UI library |
| **Build Tool** | Vite | 5.x | Development server & bundler |
| **Language** | TypeScript | 5.x | Type safety (strict mode) |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS |
| **Routing** | React Router | 6.x | Client-side routing |
| **Database** | better-sqlite3 | — | SQLite access for session store |
| **Markdown** | react-markdown | — | Markdown rendering |

---

## 2. Color System & Dark Theme

### 2.1 GitHub-Inspired Dark Palette

The theme is a **class-based dark mode** implementation using Tailwind CSS with custom color tokens. The palette mirrors GitHub's dark theme (`dark_dimmed`) with carefully selected accent colors.

#### Core Color Tokens

| Token | Hex Value | RGB | Usage |
|-------|-----------|-----|-------|
| `gh-bg` | `#0d1117` | `rgb(13, 17, 23)` | Page background, canvas, theme-color |
| `gh-surface` | `#161b22` | `rgb(22, 27, 34)` | Card backgrounds, elevated surfaces |
| `gh-border` | `#30363d` | `rgb(48, 54, 61)` | Borders, dividers, separators |
| `gh-text` | `#e6edf3` | `rgb(230, 237, 243)` | Primary text, headings |
| `gh-muted` | `#8b949e` | `rgb(139, 148, 158)` | Secondary text, placeholders, meta |
| `gh-accent` | `#58a6ff` | `rgb(88, 166, 255)` | Links, primary buttons, focus states |
| `gh-attention` | `#f85149` | `rgb(248, 81, 73)` | Errors, critical alerts, "needs attention" |
| `gh-active` | `#3fb950` | `rgb(63, 185, 80)` | Success states, active indicators, running |
| `gh-warning` | `#d29922` | `rgb(210, 153, 34)` | Warnings, cautions |

#### Color Token Configuration

**File:** `client/tailwind.config.ts`

```typescript
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',  // Class-based dark mode
  theme: {
    extend: {
      colors: {
        gh: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          text: '#e6edf3',
          muted: '#8b949e',
          accent: '#58a6ff',
          attention: '#f85149',
          active: '#3fb950',
          warning: '#d29922',
        },
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  safelist: [
    // Mode badge + border classes for dynamic usage
    'border-green-400/30', 'text-green-400', 'bg-green-400/5',
    'border-sky-400/30',   'text-sky-400',   'bg-sky-400/5',
    'border-gray-500/30',  'text-gray-400',  'bg-gray-400/5',
  ],
  plugins: [],
};
```

### 2.2 Theme Activation

**File:** `client/index.html`

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="theme-color" content="#0d1117" />
  <!-- ... -->
</head>
```

- The `class="dark"` on `<html>` forces dark mode (Tailwind's `darkMode: 'class'`)
- `theme-color` meta tag sets the browser chrome color on mobile

### 2.3 Semantic Color Usage Patterns

#### Surface Hierarchy
```
Level 0 (Canvas):     bg-gh-bg        #0d1117
Level 1 (Cards):      bg-gh-surface   #161b22
Level 2 (Elevated):   bg-gh-surface   with border or shadow
```

#### Interactive States

| State | Background | Border | Text |
|-------|------------|--------|------|
| **Default** | `bg-gh-surface` | `border-gh-border` | `text-gh-text` |
| **Hover** | `hover:bg-gh-surface/80` | `hover:border-gh-border/80` | — |
| **Focus** | — | `focus-visible:ring-2 focus-visible:ring-gh-accent/40` | — |
| **Active** | `bg-gh-active/10` | `border-gh-active/25` | `text-gh-active` |
| **Attention** | `bg-gh-attention/10` | `border-gh-attention/30` | `text-gh-attention` |

#### Opacity Variants (Common Patterns)
- `bg-gh-surface/80` — Slightly transparent surface
- `border-gh-border/50` — Subtle border
- `bg-gh-accent/10` — Accent tint (subtle backgrounds)
- `bg-gh-active/5` — Very subtle success tint

---

## 3. Global Styles & CSS

### 3.1 Global CSS File

**File:** `client/src/styles/globals.css` (192 lines)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Font Faces: JetBrains Mono (self-hosted) */
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* Additional weights: 500, 600, 700, 400 italic */

@layer base {
  body {
    @apply bg-gh-bg text-gh-text;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }

  /* Scrollbar Styling — GitHub Dark Theme */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #0d1117;
  }
  ::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #58a6ff;
  }

  /* Inline Code Display Rules */
  p > code { display: inline !important; }
  li > code, li > p > code { display: inline !important; }
  /* ... 60+ lines of specific inline code selectors ... */

  /* List Styling */
  ul > li {
    padding-top: 0.125rem !important;
    padding-bottom: 0.125rem !important;
    margin-bottom: 0.375rem !important;
  }

  /* Nested List Indentation */
  ul > li > ul, ul > li > ol {
    margin-left: 1rem !important;
    margin-top: 0.25rem !important;
    margin-bottom: 0.25rem !important;
  }

  /* Custom List Bullet */
  ul > li::before {
    content: "›" !important;
    color: #58a6ff !important;  /* gh-accent */
    font-weight: 700 !important;
  }

  /* List Text */
  ul > li, ol > li {
    font-size: 0.875rem !important;  /* 14px */
    line-height: 1.25rem !important;
    color: #e6edf3 !important;  /* gh-text */
  }

  /* Markdown Viewer Fixes */
  .markdown-viewer li button { width: unset !important; padding-left: .5rem; }
  .markdown-viewer ul li { display: block !important; }
  .markdown-viewer section button { align-items: center !important; }
}
```

### 3.2 Typography System

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Body | JetBrains Mono | `text-sm` (14px) | 400 | 1.5 |
| Headings | JetBrains Mono | `text-base` to `text-xl` | 600 | 1.3 |
| Code | JetBrains Mono | `text-xs` (12px) | 400 | 1.5 |
| Labels | JetBrains Mono | `text-xs` (11-12px) | 500 | 1.25 |
| Meta | JetBrains Mono | `text-xs` | 400 | 1.25 |

**Font Stack:**
```
'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace
```

### 3.3 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing, icon gaps |
| `space-2` | 8px | Inline element gaps |
| `space-3` | 12px | Card internal padding |
| `space-4` | 16px | Standard padding |
| `space-6` | 24px | Section gaps |
| `space-8` | 32px | Large section spacing |

### 3.4 Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 2px | Small elements |
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards, panels |
| `rounded-xl` | 12px | Large cards |
| `rounded-2xl` | 16px | Modals, dialogs |
| `rounded-full` | 9999px | Pills, avatars |

---

## 4. Component Architecture

### 4.1 Directory Organization

```
client/src/components/
├── SessionDetail/              # Session detail view (7 files)
│   ├── SessionDetail.tsx       # Main detail container
│   ├── MessageBubble.tsx       # Message rendering
│   ├── SessionTabNav.tsx       # Tab navigation
│   ├── FileTree.tsx            # File tree display
│   ├── ImagePreview.tsx        # Image preview modal
│   ├── SessionMeta.tsx         # Session metadata
│   └── WorkflowTopologyView.tsx # Workflow visualization
├── SessionList/                # List view components (5 files)
│   ├── SessionList.tsx         # Main list container
│   ├── SessionCard.tsx         # Card view item
│   ├── SessionRow.tsx          # Row view item
│   ├── SessionStatusBadge.tsx  # Status indicators
│   └── AttentionBadge.tsx      # Attention alerts
├── SessionWatchMode/           # Watch mode (2 files)
│   ├── SessionWatchMode.tsx
│   └── SessionWatchPane.tsx
├── mobile/                     # Mobile-optimized (8 files)
│   ├── MobileLayout.tsx
│   ├── MobileSessionList.tsx
│   ├── MobileSessionDetail.tsx
│   ├── MobileSessionPane.tsx
│   ├── MobileToolBlocks.tsx
│   ├── MobileInfoCard.tsx
│   ├── mobileSessionState.ts
│   └── mobileSessionViewModels.ts
└── shared/                     # Shared components
    ├── Layout.tsx              # Desktop layout shell
    ├── LoadingSpinner.tsx      # Loading indicator
    ├── RelativeTime.tsx        # Time display
    ├── modeBadge.tsx           # Mode indicator
    ├── SessionBrowseControls.tsx
    ├── MessageFilterBar.tsx
    ├── CommandPalette/         # (4 files)
    └── MarkdownRenderer/       # (3 files)
```

### 4.2 Common Component Patterns

#### Surface Card Pattern
```tsx
<div className="rounded-lg border border-gh-border bg-gh-surface">
  {/* Card content */}
</div>
```

#### Interactive List Item Pattern
```tsx
<div className="
  rounded-lg border border-gh-border bg-gh-surface
  hover:border-gh-border/80 hover:bg-gh-surface/80
  transition-colors cursor-pointer
">
  {/* Item content */}
</div>
```

#### Status Badge Pattern
```tsx
// Active/Running
<span className="
  inline-flex items-center gap-1.5 px-2 py-0.5
  rounded-full text-xs font-medium
  border border-gh-active/25 bg-gh-active/10 text-gh-active
">
  <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
  Active
</span>

// Attention/Error
<span className="
  inline-flex items-center gap-1.5 px-2 py-0.5
  rounded-full text-xs font-medium
  border border-gh-attention/30 bg-gh-attention/10 text-gh-attention
">
  Needs Attention
</span>
```

#### Button Pattern
```tsx
// Primary (Accent)
<button className="
  px-3 py-1.5 rounded-md
  border border-gh-accent/30 bg-gh-accent/10
  text-gh-accent text-sm font-medium
  hover:bg-gh-accent/15
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40
">
  Action
</button>

// Secondary (Muted)
<button className="
  px-3 py-1.5 rounded-md
  border border-gh-border bg-gh-surface
  text-gh-text text-sm
  hover:bg-gh-surface/80
">
  Cancel
</button>
```

### 4.3 Mode Badge Color System

Dynamic color classes for session modes:

| Mode | Border | Text | Background |
|------|--------|------|------------|
| `autopilot` | `border-green-400/30` | `text-green-400` | `bg-green-400/5` |
| `plan mode` | `border-sky-400/30` | `text-sky-400` | `bg-sky-400/5` |
| Other | `border-gray-500/30` | `text-gray-400` | `bg-gray-400/5` |

### 4.4 Tool Call Color Coding

| Tool Category | Color | Example Tools |
|---------------|-------|---------------|
| Shell/Execution | `blue-400` | `bash` |
| File Edit | `yellow-400` | `edit` |
| File Read | `purple-400` | `view`, `read`, `glob`, `grep` |
| File Write | `orange-400` | `write` |
| Agent/Task | `green-400` | `task`, `read_agent` |
| User Input | `pink-400` | `ask_user` |
| Reporting | `gray-400` | `report_intent` |
| Web | `gh-accent` (#58a6ff) | `web_fetch`, `web_search` |

---

## 5. Syntax Highlighting

**Library:** `react-syntax-highlighter` with `vscDarkPlus` theme

**Code Block Styling:**
```css
/* Border matches gh-border */
border: 1px solid #30363d;

/* Font size for code blocks */
font-size: 0.75rem;  /* 12px */

/* Theme: vscDarkPlus (Visual Studio Code Dark+) */
```

---

## 6. Layout Patterns

### 6.1 Desktop Layout (`Layout.tsx`)

```
┌─────────────────────────────────────────────────────────────┐
│  Nav Bar (gh-surface, border-b gh-border)                   │
├─────────────────────────────────────────┬───────────────────┤
│                                         │                   │
│  Session List                           │  Session Detail   │
│  (flexible width, scrollable)           │  (flexible,       │
│                                         │   tabbed view)    │
│  - Filters                              │                   │
│  - Cards/Rows                           │  - Messages       │
│                                         │  - Plan           │
│                                         │  - Todos          │
│                                         │  - Checkpoints    │
│                                         │                   │
└─────────────────────────────────────────┴───────────────────┘
```

### 6.2 Mobile Layout (`MobileLayout.tsx`)

Single-column responsive layout with bottom navigation and slide-over panels.

---

## 7. State Management & Data Flow

### 7.1 Hooks Architecture

| Hook | Purpose | Polling Interval |
|------|---------|------------------|
| `useSessions` | Fetch all sessions | 5 seconds |
| `useSession(id)` | Fetch single session detail | 5 seconds |
| `useNotifications` | Browser notifications | — |
| `useSessionBrowse` | URL-based filter/sort state | — |

### 7.2 API Client

**Base URL:** `http://localhost:3001/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness check |
| `/sessions` | GET | All sessions (active + closed) |
| `/sessions/:id` | GET | Full session detail |

---

## 8. Build Configuration

### 8.1 Vite Configuration

**File:** `client/vite.config.ts`

Key settings:
- Port: 5173 (dev server)
- Proxy: `/api` → `http://localhost:3001`
- Plugins: `@vitejs/plugin-react`

### 8.2 TypeScript Configuration

- **Strict mode:** Enabled
- **Module:** ES modules (`"type": "module"`)
- **Target:** ES2020+

### 8.3 NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server (3001) + client (5173) |
| `npm run build` | Production build |
| `npm start` | Build + serve production |

---

## 9. Environment Variables

### Server
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `COPILOT_SESSION_STATE` | — | Override session-state path |

### Client (Vite)
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_TARGET` | http://localhost:3001 | API proxy target |
| `HOST` | localhost | Bind address |

---

## 10. Key Implementation Notes

### 10.1 Color Token Usage Statistics

Total `gh-*` token occurrences across 31 files: **2,027+**

| File | Token Count |
|------|-------------|
| `SessionDetail.tsx` | 417 |
| `MobileSessionPane.tsx` | 321 |
| `MobileSessionList.tsx` | 115 |
| `MarkdownRenderer.tsx` | 101 |
| `MessageBubble.tsx` | 132 |
| `MobileToolBlocks.tsx` | 98 |
| `SessionMeta.tsx` | 94 |
| `MessageFilterBar.tsx` | 77 |

### 10.2 Accessibility Considerations

- Focus states use `focus-visible` with `ring-gh-accent/40`
- Color contrast ratios meet WCAG AA standards
- Interactive elements have visible focus indicators
- Reduced motion respects `prefers-reduced-motion`

### 10.3 Performance Notes

- Polling-based updates (5s interval) instead of WebSockets
- File signature caching in session reader
- No server-side session caching (fresh reads each request)
- Tailwind purges unused styles in production

---

## 11. Migration Guide for Other Teams

### 11.1 To Adopt This Theme

1. **Copy Tailwind Config:**
   ```typescript
   // tailwind.config.ts
   colors: {
     gh: {
       bg: '#0d1117',
       surface: '#161b22',
       border: '#30363d',
       text: '#e6edf3',
       muted: '#8b949e',
       accent: '#58a6ff',
       attention: '#f85149',
       active: '#3fb950',
       warning: '#d29922',
     },
   },
   darkMode: 'class',
   ```

2. **Add Dark Class to HTML:**
   ```html
   <html class="dark">
   ```

3. **Import Global CSS:**
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   
   @layer base {
     body {
       @apply bg-gh-bg text-gh-text;
     }
   }
   ```

4. **Use Component Patterns:**
   - Surface cards: `rounded-lg border border-gh-border bg-gh-surface`
   - Status badges: Semantic colors with `border-{color}/30 bg-{color}/10 text-{color}`
   - Hover states: `hover:bg-gh-surface/80 hover:border-gh-border/80`

### 11.2 Color Mapping Reference

| Semantic Use | Token | Hex |
|--------------|-------|-----|
| Page background | `gh-bg` | `#0d1117` |
| Card background | `gh-surface` | `#161b22` |
| Borders | `gh-border` | `#30363d` |
| Primary text | `gh-text` | `#e6edf3` |
| Secondary text | `gh-muted` | `#8b949e` |
| Links/Primary | `gh-accent` | `#58a6ff` |
| Success/Active | `gh-active` | `#3fb950` |
| Error/Critical | `gh-attention` | `#f85149` |
| Warning | `gh-warning` | `#d29922` |

---

*End of Technical Specification*
