# Component Library Reference

> Catalog of UI components and patterns from the Copilot Sessions Dashboard.

---

## Layout Components

### Layout (Desktop)

**File:** `client/src/components/shared/Layout.tsx`

Main desktop layout shell with navigation and responsive content area.

```tsx
<Layout>
  {/* Main content */}
</Layout>
```

**Key Classes:**
- Background: `bg-gh-bg`
- Nav: `bg-gh-surface border-b border-gh-border`

---

### MobileLayout

**File:** `client/src/components/mobile/MobileLayout.tsx`

Mobile-optimized layout with bottom navigation.

---

## Display Components

### Card

Surface container for content grouping.

```tsx
<div className="rounded-lg border border-gh-border bg-gh-surface p-4">
  {/* Content */}
</div>
```

**Variations:**
- Default: `bg-gh-surface border-gh-border`
- Hoverable: Add `hover:bg-gh-surface/80 hover:border-gh-border/80 transition-colors cursor-pointer`
- Elevated: Add shadow or border accent

---

### LoadingSpinner

**File:** `client/src/components/shared/LoadingSpinner.tsx`

```tsx
<div className="flex items-center justify-center py-12">
  <div className="w-8 h-8 border-2 border-gh-border border-t-gh-accent rounded-full animate-spin" />
</div>
```

---

### RelativeTime

**File:** `client/src/components/shared/RelativeTime.tsx`

Time display with relative formatting (e.g., "2 minutes ago").

---

## Form Components

### Button

```tsx
// Primary (Accent)
<button className="
  px-3 py-1.5 rounded-md
  border border-gh-accent/30 bg-gh-accent/10
  text-gh-accent text-sm font-medium
  hover:bg-gh-accent/15
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40
">
  Primary
</button>

// Secondary
<button className="
  px-3 py-1.5 rounded-md
  border border-gh-border bg-gh-surface
  text-gh-text text-sm
  hover:bg-gh-surface/80
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-border/40
">
  Secondary
</button>

// Danger
<button className="
  px-3 py-1.5 rounded-md
  border border-gh-attention/30 bg-gh-attention/10
  text-gh-attention text-sm font-medium
  hover:bg-gh-attention/15
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-attention/40
">
  Danger
</button>

// Ghost
<button className="
  px-3 py-1.5 rounded-md
  text-gh-muted text-sm
  hover:text-gh-text
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40
">
  Ghost
</button>
```

---

### Input

```tsx
<input
  className="
    w-full px-3 py-2 
    rounded-md 
    border border-gh-border 
    bg-gh-bg text-gh-text 
    placeholder:text-gh-muted
    focus:outline-none focus:ring-2 focus:ring-gh-accent/40
  "
  placeholder="Search..."
/>
```

---

### Select/Dropdown

```tsx
<select
  className="
    px-3 py-1.5 
    rounded-md 
    border border-gh-border 
    bg-gh-bg text-gh-text text-sm
    focus:outline-none focus:ring-2 focus:ring-gh-accent/40
  "
>
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

---

## Badge Components

### StatusBadge

```tsx
interface StatusBadgeProps {
  status: 'active' | 'attention' | 'warning' | 'default';
}
```

**Active:**
```tsx
<span className="
  inline-flex items-center gap-1.5 
  px-2 py-0.5 rounded-full 
  text-xs font-medium
  border border-gh-active/25 bg-gh-active/10 text-gh-active
">
  <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
  Active
</span>
```

**Attention:**
```tsx
<span className="
  inline-flex items-center gap-1.5 
  px-2 py-0.5 rounded-full 
  text-xs font-medium
  border border-gh-attention/30 bg-gh-attention/10 text-gh-attention
">
  Needs Attention
</span>
```

**Warning:**
```tsx
<span className="
  inline-flex items-center gap-1.5 
  px-2 py-0.5 rounded-full 
  text-xs font-medium
  border border-gh-warning/30 bg-gh-warning/10 text-gh-warning
">
  Warning
</span>
```

---

### ModeBadge

**File:** `client/src/components/shared/modeBadge.tsx`

Dynamic badge for session modes with color coding.

| Mode | Colors |
|------|--------|
| `autopilot` | `border-green-400/30 bg-green-400/5 text-green-400` |
| `plan mode` | `border-sky-400/30 bg-sky-400/5 text-sky-400` |
| Other | `border-gray-500/30 bg-gray-400/5 text-gray-400` |

---

## List Components

### List Item

```tsx
<div className="
  flex items-center gap-3 
  px-4 py-3 
  border-b border-gh-border
  hover:bg-gh-surface/50
">
  {/* Item content */}
</div>
```

### Interactive List Item

```tsx
<div className="
  flex items-center gap-3 
  px-4 py-3 
  rounded-lg
  border border-gh-border bg-gh-surface
  hover:border-gh-border/80 hover:bg-gh-surface/80
  transition-colors cursor-pointer
">
  {/* Item content */}
</div>
```

---

## Navigation Components

### Tab Navigation

**File:** `client/src/components/SessionDetail/SessionTabNav.tsx`

```tsx
<div className="flex border-b border-gh-border">
  <button className="
    px-4 py-2 
    text-sm font-medium
    border-b-2 border-gh-accent text-gh-accent
  ">
    Active Tab
  </button>
  <button className="
    px-4 py-2 
    text-sm font-medium
    border-b-2 border-transparent text-gh-muted
    hover:text-gh-text
  ">
    Inactive Tab
  </button>
</div>
```

---

## Data Display

### File Tree

**File:** `client/src/components/SessionDetail/FileTree.tsx`

Tree view for file hierarchies with collapsible sections.

---

### Code Block

Using `react-syntax-highlighter` with `vscDarkPlus` theme:

```tsx
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

<SyntaxHighlighter
  language="typescript"
  style={vscDarkPlus}
  customStyle={{
    margin: 0,
    borderRadius: '6px',
    border: '1px solid #30363d',
    fontSize: '0.75rem',
  }}
>
  {code}
</SyntaxHighlighter>
```

---

### Markdown Renderer

**File:** `client/src/components/shared/MarkdownRenderer/MarkdownRenderer.tsx`

Custom markdown renderer with `react-markdown` and `remark-gfm`.

---

## Feedback Components

### Empty State

```tsx
<div className="
  flex flex-col items-center justify-center 
  py-12 px-4
  text-center
">
  <div className="text-gh-muted mb-2">
    {/* Icon */}
  </div>
  <h3 className="text-gh-text font-medium mb-1">No items</h3>
  <p className="text-gh-muted text-sm">
    Get started by creating a new item.
  </p>
</div>
```

### Error State

```tsx
<div className="
  rounded-lg 
  border border-gh-attention/30 
  bg-gh-attention/10 
  p-4
">
  <div className="flex items-center gap-2 text-gh-attention mb-2">
    {/* Error icon */}
    <span className="font-medium">Error</span>
  </div>
  <p className="text-gh-text text-sm">
    Something went wrong. Please try again.
  </p>
</div>
```

---

## Specialized Components

### SessionCard

**File:** `client/src/components/SessionList/SessionCard.tsx`

Card display for session items with status, metadata, and actions.

### SessionRow

**File:** `client/src/components/SessionList/SessionRow.tsx`

Compact row display for session lists.

### MessageBubble

**File:** `client/src/components/SessionDetail/MessageBubble.tsx`

Chat message display with tool call formatting.

### CommandPalette

**File:** `client/src/components/shared/CommandPalette/`

Modal search interface with keyboard navigation.

---

## Common Class Combinations

### Card Variants

| Variant | Classes |
|---------|---------|
| Default | `rounded-lg border border-gh-border bg-gh-surface` |
| Hoverable | `rounded-lg border border-gh-border bg-gh-surface hover:border-gh-border/80 hover:bg-gh-surface/80 transition-colors cursor-pointer` |
| Selected | `rounded-lg border border-gh-accent/50 bg-gh-accent/5` |
| Elevated | `rounded-lg border border-gh-border bg-gh-surface shadow-lg` |

### Text Variants

| Purpose | Classes |
|---------|---------|
| Heading | `text-base font-semibold text-gh-text` |
| Subheading | `text-sm font-medium text-gh-muted` |
| Body | `text-sm text-gh-text` |
| Meta | `text-xs text-gh-muted` |
| Link | `text-sm text-gh-accent hover:underline` |

### Spacing Patterns

| Pattern | Classes |
|---------|---------|
| Card padding | `p-4` or `px-4 py-3` |
| Section gap | `gap-4` or `space-y-4` |
| Tight gap | `gap-2` or `space-y-2` |
| Content padding | `px-4 py-3` |

---

*For implementation details, see [How To: Implement the Theme](../how-to/implement-copiloting-agents-theme.md)*
