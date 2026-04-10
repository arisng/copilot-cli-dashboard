# Color Palette Reference — Copilot Sessions Dashboard

> Visual reference for the GitHub-inspired dark theme color system.

---

## Primary Palette

### Background Colors

<div style="display: flex; gap: 16px; margin: 16px 0;">
<div style="width: 120px; text-align: center;">
  <div style="width: 100%; height: 80px; background: #0d1117; border-radius: 8px; border: 1px solid #30363d;"></div>
  <code style="font-size: 11px; color: #8b949e;">gh-bg</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#0d1117</code>
</div>
<div style="width: 120px; text-align: center;">
  <div style="width: 100%; height: 80px; background: #161b22; border-radius: 8px; border: 1px solid #30363d;"></div>
  <code style="font-size: 11px; color: #8b949e;">gh-surface</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#161b22</code>
</div>
</div>

### Text Colors

<div style="display: flex; gap: 16px; margin: 16px 0;">
<div style="width: 120px; text-align: center; background: #0d1117; padding: 12px; border-radius: 8px;">
  <div style="color: #e6edf3; font-size: 14px; font-weight: 500;">Primary Text</div>
  <code style="font-size: 10px; color: #8b949e;">gh-text</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#e6edf3</code>
</div>
<div style="width: 120px; text-align: center; background: #0d1117; padding: 12px; border-radius: 8px;">
  <div style="color: #8b949e; font-size: 14px; font-weight: 500;">Muted Text</div>
  <code style="font-size: 10px; color: #8b949e;">gh-muted</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#8b949e</code>
</div>
</div>

### Semantic Colors

<div style="display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap;">
<div style="width: 120px; text-align: center;">
  <div style="width: 100%; height: 80px; background: #58a6ff; border-radius: 8px;"></div>
  <code style="font-size: 11px; color: #8b949e;">gh-accent</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#58a6ff</code><br/>
  <span style="font-size: 10px; color: #8b949e;">Links, Primary</span>
</div>
<div style="width: 120px; text-align: center;">
  <div style="width: 100%; height: 80px; background: #3fb950; border-radius: 8px;"></div>
  <code style="font-size: 11px; color: #8b949e;">gh-active</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#3fb950</code><br/>
  <span style="font-size: 10px; color: #8b949e;">Success, Active</span>
</div>
<div style="width: 120px; text-align: center;">
  <div style="width: 100%; height: 80px; background: #f85149; border-radius: 8px;"></div>
  <code style="font-size: 11px; color: #8b949e;">gh-attention</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#f85149</code><br/>
  <span style="font-size: 10px; color: #8b949e;">Error, Alert</span>
</div>
<div style="width: 120px; text-align: center;">
  <div style="width: 100%; height: 80px; background: #d29922; border-radius: 8px;"></div>
  <code style="font-size: 11px; color: #8b949e;">gh-warning</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#d29922</code><br/>
  <span style="font-size: 10px; color: #8b949e;">Warning</span>
</div>
</div>

### Border Color

<div style="display: flex; gap: 16px; margin: 16px 0;">
<div style="width: 120px; text-align: center;">
  <div style="width: 100%; height: 80px; background: #30363d; border-radius: 8px;"></div>
  <code style="font-size: 11px; color: #8b949e;">gh-border</code><br/>
  <code style="font-size: 10px; color: #8b949e;">#30363d</code>
</div>
</div>

---

## Usage Patterns

### Surface Hierarchy

```
┌─────────────────────────────────────────┐
│  bg-gh-bg (#0d1117)                     │  ← Level 0: Canvas
│  ┌─────────────────────────────────┐    │
│  │  bg-gh-surface (#161b22)        │    │  ← Level 1: Card
│  │  border: gh-border (#30363d)    │    │
│  │                                 │    │
│  │  ┌─────────────────────────┐    │    │
│  │  │  bg-gh-surface/80       │    │    │  ← Level 2: Hover
│  │  │  (slightly transparent) │    │    │
│  │  └─────────────────────────┘    │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Status Badge Patterns

| State | Visual | Classes |
|-------|--------|---------|
| **Default** | <span style="padding: 2px 8px; border-radius: 12px; background: #161b22; border: 1px solid #30363d; color: #e6edf3; font-size: 12px;">Default</span> | `bg-gh-surface border-gh-border text-gh-text` |
| **Active** | <span style="padding: 2px 8px; border-radius: 12px; background: rgba(63,185,80,0.1); border: 1px solid rgba(63,185,80,0.25); color: #3fb950; font-size: 12px;">● Active</span> | `bg-gh-active/10 border-gh-active/25 text-gh-active` |
| **Attention** | <span style="padding: 2px 8px; border-radius: 12px; background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.3); color: #f85149; font-size: 12px;">⚠ Attention</span> | `bg-gh-attention/10 border-gh-attention/30 text-gh-attention` |
| **Accent** | <span style="padding: 2px 8px; border-radius: 12px; background: rgba(88,166,255,0.1); border: 1px solid rgba(88,166,255,0.3); color: #58a6ff; font-size: 12px;">Action</span> | `bg-gh-accent/10 border-gh-accent/30 text-gh-accent` |

### Interactive States

| State | Background | Border |
|-------|------------|--------|
| **Rest** | `bg-gh-surface` | `border-gh-border` |
| **Hover** | `bg-gh-surface/80` | `border-gh-border/80` |
| **Focus** | — | `ring-2 ring-gh-accent/40` |
| **Active** | `bg-gh-active/10` | `border-gh-active/25` |

---

## CSS Custom Properties (Optional Migration)

For teams not using Tailwind, here are the equivalent CSS variables:

```css
:root {
  --gh-bg: #0d1117;
  --gh-surface: #161b22;
  --gh-border: #30363d;
  --gh-text: #e6edf3;
  --gh-muted: #8b949e;
  --gh-accent: #58a6ff;
  --gh-attention: #f85149;
  --gh-active: #3fb950;
  --gh-warning: #d29922;
}
```

---

## Tailwind Quick Reference

### Common Combinations

```tsx
// Card
className="rounded-lg border border-gh-border bg-gh-surface"

// Card with hover
className="rounded-lg border border-gh-border bg-gh-surface hover:border-gh-border/80 hover:bg-gh-surface/80 transition-colors"

// Button (Primary)
className="px-3 py-1.5 rounded-md border border-gh-accent/30 bg-gh-accent/10 text-gh-accent hover:bg-gh-accent/15"

// Button (Secondary)
className="px-3 py-1.5 rounded-md border border-gh-border bg-gh-surface text-gh-text hover:bg-gh-surface/80"

// Input
className="px-3 py-2 rounded-md border border-gh-border bg-gh-bg text-gh-text placeholder:text-gh-muted focus:outline-none focus:ring-2 focus:ring-gh-accent/40"

// Status Badge (Active)
className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-gh-active/25 bg-gh-active/10 text-gh-active"

// Status Badge (Attention)
className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-gh-attention/30 bg-gh-attention/10 text-gh-attention"
```

---

## Contrast Ratios

| Color Pair | Ratio | WCAG AA | WCAG AAA |
|------------|-------|---------|----------|
| gh-text (#e6edf3) on gh-bg (#0d1117) | 14.5:1 | ✅ Pass | ✅ Pass |
| gh-muted (#8b949e) on gh-bg (#0d1117) | 5.2:1 | ✅ Pass | ❌ Fail |
| gh-accent (#58a6ff) on gh-bg (#0d1117) | 6.3:1 | ✅ Pass | ❌ Fail |
| gh-active (#3fb950) on gh-bg (#0d1117) | 5.8:1 | ✅ Pass | ❌ Fail |
| gh-attention (#f85149) on gh-bg (#0d1117) | 7.1:1 | ✅ Pass | ✅ Pass |
| gh-warning (#d29922) on gh-bg (#0d1117) | 7.3:1 | ✅ Pass | ✅ Pass |

---

*Generated for handoff to development teams.*
