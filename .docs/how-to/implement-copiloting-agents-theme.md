# How To: Implement the Copiloting Agents Dark Theme

> Step-by-step guide to adopting the GitHub-inspired dark theme in your React + Tailwind project.

---

## Prerequisites

- React 18+
- Tailwind CSS 3+
- TypeScript (recommended)

---

## Step 1: Configure Tailwind

Update your `tailwind.config.ts` (or `.js`):

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',  // Required: class-based dark mode
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
    // Mode badge colors (if using dynamic mode badges)
    'border-green-400/30', 'text-green-400', 'bg-green-400/5',
    'border-sky-400/30',   'text-sky-400',   'bg-sky-400/5',
    'border-gray-500/30',  'text-gray-400',  'bg-gray-400/5',
  ],
  plugins: [],
};

export default config;
```

---

## Step 2: Set Up Global Styles

Create or update `src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Optional: JetBrains Mono font (self-hosted) */
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@layer base {
  body {
    @apply bg-gh-bg text-gh-text;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }

  /* Scrollbar styling — GitHub dark theme */
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
}
```

---

## Step 3: Configure HTML

Update `index.html`:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="theme-color" content="#0d1117" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Important:**
- Add `class="dark"` to the `<html>` element
- Set `theme-color` meta tag to `#0d1117`

---

## Step 4: Component Patterns

### Card Component

```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`
      rounded-lg border border-gh-border bg-gh-surface
      ${className}
    `}>
      {children}
    </div>
  );
}
```

### Interactive Card (with hover)

```tsx
interface InteractiveCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function InteractiveCard({ children, onClick, className = '' }: InteractiveCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`
        rounded-lg border border-gh-border bg-gh-surface
        hover:border-gh-border/80 hover:bg-gh-surface/80
        transition-colors cursor-pointer
        ${className}
      `}
    >
      {children}
    </div>
  );
}
```

### Button Component

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ 
  children, 
  variant = 'primary', 
  className = '',
  ...props 
}: ButtonProps) {
  const variants = {
    primary: `
      border border-gh-accent/30 bg-gh-accent/10 text-gh-accent
      hover:bg-gh-accent/15
      focus-visible:ring-gh-accent/40
    `,
    secondary: `
      border border-gh-border bg-gh-surface text-gh-text
      hover:bg-gh-surface/80
      focus-visible:ring-gh-border/40
    `,
    danger: `
      border border-gh-attention/30 bg-gh-attention/10 text-gh-attention
      hover:bg-gh-attention/15
      focus-visible:ring-gh-attention/40
    `,
  };

  return (
    <button
      className={`
        px-3 py-1.5 rounded-md text-sm font-medium
        focus-visible:outline-none focus-visible:ring-2
        transition-colors
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
```

### Status Badge Component

```tsx
interface StatusBadgeProps {
  status: 'active' | 'attention' | 'warning' | 'default';
  children: React.ReactNode;
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const styles = {
    active: 'border-gh-active/25 bg-gh-active/10 text-gh-active',
    attention: 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention',
    warning: 'border-gh-warning/30 bg-gh-warning/10 text-gh-warning',
    default: 'border-gh-border bg-gh-surface text-gh-muted',
  };

  const indicators = {
    active: <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />,
    attention: <span>⚠</span>,
    warning: <span>▲</span>,
    default: null,
  };

  return (
    <span className={`
      inline-flex items-center gap-1.5 
      px-2 py-0.5 rounded-full 
      text-xs font-medium border
      ${styles[status]}
    `}>
      {indicators[status]}
      {children}
    </span>
  );
}
```

### Input Component

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`
        w-full px-3 py-2 
        rounded-md 
        border border-gh-border 
        bg-gh-bg text-gh-text 
        placeholder:text-gh-muted
        focus:outline-none focus:ring-2 focus:ring-gh-accent/40
        ${className}
      `}
      {...props}
    />
  );
}
```

---

## Step 5: Usage Examples

### Dashboard Layout

```tsx
function Dashboard() {
  return (
    <div className="min-h-screen bg-gh-bg text-gh-text">
      {/* Header */}
      <header className="border-b border-gh-border bg-gh-surface">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <Button variant="primary">New Item</Button>
        </div>
      </header>

      {/* Main content */}
      <main className="p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gh-muted">Active Sessions</h2>
              <StatusBadge status="active">12 Running</StatusBadge>
            </div>
            <p className="mt-2 text-2xl font-bold">24</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gh-muted">Attention Required</h2>
              <StatusBadge status="attention">3</StatusBadge>
            </div>
            <p className="mt-2 text-2xl font-bold text-gh-attention">3</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gh-muted">Completed</h2>
              <StatusBadge status="default">Done</StatusBadge>
            </div>
            <p className="mt-2 text-2xl font-bold text-gh-active">156</p>
          </Card>
        </div>
      </main>
    </div>
  );
}
```

---

## Common Patterns

### Opacity Modifiers

| Pattern | Class | Usage |
|---------|-------|-------|
| Subtle background | `bg-gh-surface/80` | Hover states |
| Very subtle | `bg-gh-active/5` | Light tint |
| Subtle border | `border-gh-border/50` | Dividers |
| Focus ring | `ring-gh-accent/40` | Focus states |

### Text Hierarchy

| Level | Class | Use For |
|-------|-------|---------|
| Primary | `text-gh-text` | Headings, body text |
| Secondary | `text-gh-muted` | Labels, meta info |
| Accent | `text-gh-accent` | Links, primary actions |
| Semantic | `text-gh-active` / `text-gh-attention` | Status text |

### Spacing

```tsx
// Card padding
className="p-4"          // 16px
className="px-4 py-3"    // Horizontal 16px, Vertical 12px

// Gap between elements
className="gap-2"        // 8px
className="gap-4"        // 16px
className="space-y-4"    // Vertical spacing
```

---

## Tips

1. **Always use `gh-*` tokens** instead of hardcoded colors for consistency
2. **Use opacity modifiers** (`/80`, `/50`, `/10`) for hover states and subtle variations
3. **Leverage `ring-*` for focus states** instead of `outline` for consistency
4. **Use `transition-colors`** on interactive elements for smooth state changes
5. **Prefer `gap-*` over margins** for component spacing

---

## Full Color Reference

| Token | Hex | Usage |
|-------|-----|-------|
| `gh-bg` | `#0d1117` | Page background |
| `gh-surface` | `#161b22` | Cards, elevated surfaces |
| `gh-border` | `#30363d` | Borders, dividers |
| `gh-text` | `#e6edf3` | Primary text |
| `gh-muted` | `#8b949e` | Secondary text |
| `gh-accent` | `#58a6ff` | Links, primary actions |
| `gh-active` | `#3fb950` | Success, active states |
| `gh-attention` | `#f85149` | Errors, alerts |
| `gh-warning` | `#d29922` | Warnings |

---

*See also: [Color Palette Reference](../reference/copiloting-agents/color-palette.md)*
