# Copilot Sessions Dashboard — Documentation

> Technical documentation for the Copilot Sessions Dashboard project.

---

## Documentation Structure

This documentation follows the [Diátaxis](https://diataxis.fr/) framework, organizing content into four categories:

| Category | Purpose | Content |
|----------|---------|---------|
| **Tutorials** | Learning-oriented lessons | Step-by-step guides for first-time users |
| **How-To Guides** | Task-oriented guides | Solutions to specific problems |
| **Reference** | Technical descriptions | API docs, specs, color palettes |
| **Explanation** | Conceptual discussions | Architecture decisions, lessons learned |

---

## Quick Navigation

### For Developers Implementing the Theme

| Document | Purpose |
|----------|---------|
| [How To: Implement the Theme](how-to/implement-copiloting-agents-theme.md) | Step-by-step theme adoption guide |
| [Color Palette Reference](reference/copiloting-agents/color-palette.md) | Visual color reference with hex codes |
| [Component Library](reference/copiloting-agents/component-library.md) | Catalog of UI patterns and components |

### For Technical Understanding

| Document | Purpose |
|----------|---------|
| [Technical Specification](reference/copiloting-agents/technical-specification.md) | Complete architecture and implementation details |

---

## Document Index

### Reference

- **[copiloting-agents/technical-specification.md](reference/copiloting-agents/technical-specification.md)**
  - Complete technical spec covering:
    - Architecture overview
    - Color system & dark theme (with exact hex values)
    - Global styles & CSS
    - Component architecture
    - Syntax highlighting
    - Layout patterns
    - State management
    - Build configuration
    - Migration guide for other teams

- **[copiloting-agents/color-palette.md](reference/copiloting-agents/color-palette.md)**
  - Visual color swatches
  - Usage patterns
  - Opacity variants
  - Contrast ratios
  - Tailwind quick reference

- **[copiloting-agents/component-library.md](reference/copiloting-agents/component-library.md)**
  - Layout components
  - Display components
  - Form components
  - Badge components
  - Navigation components
  - Common class combinations

### How-To

- **[implement-copiloting-agents-theme.md](how-to/implement-copiloting-agents-theme.md)**
  - 5-step implementation guide
  - Component code examples
  - Usage patterns
  - Full color reference

---

## Key Information

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Server | Express 4.x |
| Client | React 18.x |
| Build | Vite 5.x |
| Language | TypeScript 5.x (strict mode) |
| Styling | Tailwind CSS 3.x |
| Routing | React Router 6.x |

### Core Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `gh-bg` | `#0d1117` | Page background |
| `gh-surface` | `#161b22` | Card backgrounds |
| `gh-border` | `#30363d` | Borders, dividers |
| `gh-text` | `#e6edf3` | Primary text |
| `gh-muted` | `#8b949e` | Secondary text |
| `gh-accent` | `#58a6ff` | Links, primary actions |
| `gh-active` | `#3fb950` | Success, active states |
| `gh-attention` | `#f85149` | Errors, alerts |
| `gh-warning` | `#d29922` | Warnings |

### Project Structure

```
copiloting-agents/
├── client/              # React SPA
│   ├── src/
│   │   ├── api/        # API client
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom hooks
│   │   ├── styles/     # Global CSS
│   │   └── utils/      # Utilities
│   └── tailwind.config.ts
├── server/              # Express API
└── package.json
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Start development (server + client)
npm run dev

# Build for production
npm run build

# Serve production build
npm start
```

---

*Documentation generated for handoff to development teams.*
