# Mobile-Desktop Session Surface Discrepancy Audit

**Document Type:** Reference (Diátaxis Framework)  
**Scope:** UI/UX parity analysis between mobile (`/m/*`) and desktop (`/*`) session surfaces  
**Version:** 1.0  
**Last Updated:** 2026-04-05

---

## Executive Summary

The Copilot Sessions Dashboard maintains two distinct interface implementations:

- **Desktop Surface** (`client/src/components/SessionList/`, `client/src/components/SessionDetail/`): Full-featured interface with comprehensive session management capabilities
- **Mobile Surface** (`client/src/components/mobile/`): Touch-first optimized interface with simplified workflows

**Key Finding:** The mobile surface intentionally omits several desktop features in favor of streamlined workflows, but some gaps represent opportunities for enhancement rather than intentional simplification.

### High-Level Statistics

| Metric | Desktop | Mobile | Gap |
|--------|---------|--------|-----|
| Session List Views | 2 (list + grid) | 1 (card) | -1 |
| Session Detail Tabs | 8 | 4 | -4 |
| Bulk Actions | Yes | No | 1 |
| Tool Rendering | 8+ specialized blocks | 1 generic pill | 7 |
| Selection Model | Multi-select | None | 1 |

---

## 1. Session List Comparison

### 1.1 Component Mapping

| Desktop Component | Mobile Equivalent | Parity | Notes |
|-------------------|-------------------|--------|-------|
| `SessionList.tsx` | `MobileSessionList.tsx` | ⚠️ Partial | Mobile has no view toggle |
| `SessionCard.tsx` | `SessionPreviewCard` (inline) | ⚠️ Partial | Mobile card is simplified |
| `SessionRow.tsx` | N/A | ❌ Missing | No list view on mobile |
| `SessionStatusBadge.tsx` | `getMobileSessionState()` | ✅ Equivalent | Different visual treatment |
| `AttentionBadge.tsx` | Session signal chips | ✅ Equivalent | Mobile uses signal pattern |

### 1.2 Feature Discrepancy Matrix

| Feature | Desktop | Mobile | Priority | Rationale |
|---------|---------|--------|----------|-----------|
| **View Modes** | List + Grid | Card only | Low | Mobile single-column is appropriate |
| **Selection Checkboxes** | ✅ | ❌ | Medium | Bulk actions not prioritized for mobile |
| **Bulk Actions (Watch)** | ✅ | ❌ | Low | Mobile targets individual session focus |
| **Sub-Agent Expansion** | ✅ (in list row) | ❌ | Medium | Mobile shows count only |
| **Tool Chips** | ✅ (colored, typed) | ❌ | Medium | Mobile shows count only in preview |
| **Branch Copy Button** | ✅ | ❌ | High | Useful on mobile for git operations |
| **Model Display** | ✅ | ✅ | - | Parity achieved |
| **Active Agent List** | ✅ (expandable) | ✅ (count only) | Medium | Mobile could show top 2 agents |
| **Session Grouping** | Flat list | Priority/Working/Quiet | N/A | Mobile innovation - consider for desktop |
| **Signal Chips** | Status badges | Plan review, Active agents, etc. | N/A | Mobile innovation - clearer hierarchy |

### 1.3 Information Architecture Differences

#### Desktop SessionCard Displays:
```
┌─────────────────────────────────────┐
│ [Status]                    [Time]  │
│ Session Title                       │
│ ┌──────────────┐ ┌──────────────┐  │
│ │ Project      │ │ Activity     │  │
│ │ Name         │ │ Duration     │  │
│ │ Branch       │ │ Msg/Agent    │  │
│ └──────────────┘ └──────────────┘  │
│ [Mode] [Model]                      │
├─────────────────────────────────────┤
│ 👤 User message preview            │
│ 🤖 [bash] [edit] [read] ...        │  ← Tool chips
├─────────────────────────────────────┤
│ Active sub-agents: agent1 agent2   │  ← Expandable
└─────────────────────────────────────┘
```

#### Mobile SessionPreviewCard Displays:
```
┌─────────────────────────────────────────┐
│ [Status] [Mode]                 →       │
│ Session Title                           │
│ Project · Branch                        │
│ ┌─────────┬─────────┬─────────┐        │
│ │ Duration│ Messages│ Agents  │        │
│ └─────────┴─────────┴─────────┘        │
│ [Plan review] [3 active agents]        │  ← Signal chips
│ ┌─────────────────────────────────┐    │
│ │ Latest assistant                │    │
│ │ 3 tools · message snippet...    │    │  ← No tool breakdown
│ └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 1.4 Missing Mobile Features (Recommendations)

| Feature | Recommendation | Effort |
|---------|----------------|--------|
| Branch Copy | Add copy button next to branch name | Low |
| Top 2 Active Agents | Show running agents below signals | Medium |
| Tool Type Indicators | Add colored dots or icons for common tools | Low |
| Selection for Watch | Add simple "Watch this session" action | Medium |

---

## 2. Session Detail Comparison

### 2.1 Tab/Navigation Structure

| Desktop Tab | Mobile Section | Parity | Access Path |
|-------------|----------------|--------|-------------|
| Main | Activity | ⚠️ Partial | Direct + Stream switcher |
| Plan | Work (subsection) | ✅ Equivalent | Collapsible section |
| Todos | Work (subsection) | ✅ Equivalent | Grouped by status |
| Sub-agent threads | Agents + Activity | ⚠️ Partial | Split across two sections |
| Checkpoints | ❌ Missing | ❌ | Not accessible on mobile |
| Research | ❌ Missing | ❌ | Not accessible on mobile |
| Files | ❌ Missing | ❌ | Not accessible on mobile |
| Session DB | ❌ Missing | ❌ | Not accessible on mobile |

### 2.2 Desktop Tab Detail

```typescript
type SessionDetailView = 
  | 'main'           // Primary conversation
  | 'plan'           // Plan.md content
  | 'todos'          // Todo list with status
  | 'threads'        // Sub-agent explorer
  | 'checkpoints'    // Checkpoint files
  | 'research'       // Research artifacts
  | 'files'          // Additional files
  | 'session-db';    // Database inspector
```

### 2.3 Mobile Section Detail

```typescript
type DetailSectionId = 
  | 'overview'   // Session status, metadata, quick actions
  | 'activity'   // Messages + stream switcher
  | 'work'       // Plan + Todos combined
  | 'agents';    // Sub-agent cards with preview
```

### 2.4 Critical Missing Mobile Tabs

| Tab | Mobile Impact | User Workaround | Recommendation |
|-----|---------------|-----------------|----------------|
| **Checkpoints** | Cannot view session summaries | Switch to desktop | Add to Work section |
| **Research** | Cannot access research notes | Switch to desktop | Add dedicated section |
| **Files** | Cannot browse session files | Switch to desktop | Add to Work section |
| **Session DB** | Cannot inspect todo dependencies | Switch to desktop | Add simplified graph view |

### 2.5 Feature Comparison by Section

#### Main Session / Activity View

| Feature | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Message Filter Bar | ✅ Full | ✅ Full | Parity achieved |
| Turn-based Filtering | ✅ | ✅ | Parity achieved |
| Tool Filtering | ✅ | ❌ | Mobile could add |
| Stream Switcher | N/A (tabs) | ✅ Horizontal | Mobile innovation |
| Message Limit | Unlimited | 10 + expand | Mobile optimization |
| Auto-scroll | ✅ | ❌ | Mobile could add |

#### Plan View

| Feature | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Collapsible Sections | ✅ | ✅ | Parity achieved |
| Section Outline | ✅ Sidebar | ✅ Pills | Mobile adaptation |
| Pending Approval Banner | ✅ | ✅ | Parity achieved |
| Markdown Rendering | `variant="desktop"` | `variant="mobile"` | Different styling |

#### Todos View

| Feature | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Status Grouping | ✅ | ✅ | Parity achieved |
| Expandable Details | ✅ | ✅ | Parity achieved |
| Dependency Display | ✅ Pills | ✅ Pills | Parity achieved |
| Todo Count Badges | ✅ | ✅ | Parity achieved |

#### Sub-Agents / Agents View

| Feature | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Thread Search | ✅ | ❌ | Mobile could add |
| Thread List | ✅ Sidebar | ✅ Cards | Different presentation |
| Message Preview | ✅ Full | ✅ Last 2 | Mobile optimization |
| Direct Thread Open | ✅ | ✅ | Parity achieved |

---

## 3. Component Parity Matrix

### 3.1 Message Rendering

| Component | Desktop | Mobile | Parity |
|-----------|---------|--------|--------|
| **MessageBubble.tsx** | Full-featured | N/A | - |
| **MobileMessageCard** | N/A | Simplified | - |
| User message | ✅ | ✅ | Parity |
| Assistant message | ✅ | ✅ | Parity |
| Task complete | ✅ | ✅ | Parity |
| Tool display | Full blocks | Pills + expand | ⚠️ Partial |
| Reasoning display | ✅ Collapsible | ❌ Missing | Gap |
| Timestamp | ✅ Relative | ✅ Relative | Parity |

### 3.2 Tool Block Rendering

Desktop `MessageBubble.tsx` renders **specialized blocks**:

| Tool | Desktop Component | Mobile Equivalent | Parity |
|------|-------------------|-------------------|--------|
| `ask_user` | `AskUserBlock` | Generic pill | ❌ |
| `task`/`read_agent` | `TaskBlock` | Generic pill | ❌ |
| `edit` | `EditBlock` (diff) | Generic pill | ❌ |
| `bash` | `BashBlock` | Generic pill | ❌ |
| `mcp-atlassian-*` | `AtlassianBlock` | Generic pill | ❌ |
| `figma-*` | `FigmaBlock` | Generic pill | ❌ |
| Other tools | `ToolCallBlock` | Generic pill | ⚠️ |

Mobile `MobileMessageCard` renders **generic tool pills** with expand-to-details pattern.

### 3.3 Markdown Rendering Variants

| Variant | Use Case | Key Differences |
|---------|----------|-----------------|
| `desktop` | Plan, Checkpoints, Research | Custom bullets (`›`), compact lists, syntax highlighting |
| `mobile` | Plan (mobile), Work sections | Standard bullets, wider spacing, touch-friendly |
| `message` | MessageBubble content | Minimal margins, inline styles |

**Styling Differences:**

```typescript
// Desktop lists - custom styling
ul: "space-y-1 mb-3 pl-0 list-none"
li: "before:content-['›'] before:text-gh-accent"  

// Mobile lists - standard styling
ul: "mb-3 space-y-1.5 pl-4 list-disc marker:text-gh-muted"
li: "leading-relaxed pl-1"
```

---

## 4. Information Hierarchy Analysis

### 4.1 What Desktop Shows That Mobile Doesn't

| Information | Desktop Location | Mobile Gap |
|-------------|------------------|------------|
| Full checkpoint file tree | Checkpoints tab | No access |
| Research artifacts | Research tab | No access |
| Session file browser | Files tab | No access |
| Todo dependency graph | Session DB tab | No access |
| Database table preview | Session DB tab | No access |
| Sub-agent message search | Threads tab | No search |
| Tool execution details | Inline blocks | Collapsed by default |
| Session sidebar | Right column | Not applicable |

### 4.2 What Mobile Does Better for Small Screens

| Feature | Mobile Implementation | Desktop Opportunity |
|---------|----------------------|---------------------|
| **Priority Grouping** | Sessions grouped by urgency (Priority/Working/Quiet) | Could add filter presets |
| **Signal Chips** | Contextual status signals (Plan review, X active agents) | Could replace status badges |
| **Stream Switcher** | Horizontal scrollable stream selector | Could use for thread tabs |
| **Sticky Summary Bar** | Persistent context with quick navigation | Could add compact header |
| **Collapsible Sections** | All sections collapsible by default | Could add for long plans |
| **Hero Overview** | Session stats summary card | Could add to list view |

### 4.3 Recommended Adaptations

#### For Mobile (Add from Desktop)

| Feature | Adaptation | Priority |
|---------|------------|----------|
| Checkpoints | Add "Checkpoints" subsection to Work | High |
| Research | Add "Research" section or merge with Work | Medium |
| Files | Add "Files" subsection to Work | Medium |
| Tool Details | Expand tool pills to show basic args | Medium |
| Branch Copy | Add copy button to Overview metadata | High |

#### For Desktop (Add from Mobile)

| Feature | Adaptation | Priority |
|---------|------------|----------|
| Priority Grouping | Add grouped view option to list | Medium |
| Signal Chips | Replace status badges with contextual signals | Low |
| Stream Switcher | Use horizontal tabs when many threads | Medium |
| Hero Stats | Add session overview card to detail | Low |

---

## 5. Recommendations for Mobile Refinement

### 5.1 High Priority

1. **Add Branch Copy to Overview**
   - Location: `OverviewPanel` metadata section
   - Implementation: Reuse `CopyBranch` component from desktop
   - Effort: Low

2. **Add Checkpoints to Work Section**
   - Location: `WorkPanel` as collapsible subsection
   - Implementation: Fetch and display checkpoint index
   - Effort: Medium

3. **Improve Tool Visibility**
   - Location: `MobileMessageCard`
   - Implementation: Add color-coded tool type indicators
   - Effort: Low

### 5.2 Medium Priority

4. **Add Research/Files Access**
   - Location: New "Artifacts" section or Work subsection
   - Implementation: Simplified file list with download
   - Effort: Medium

5. **Add Session DB Graph (Simplified)**
   - Location: Work section or new "Dependencies" subsection
   - Implementation: Read-only todo graph without full inspector
   - Effort: High

6. **Add Message Search/Filter**
   - Location: `ActivityPanel`
   - Implementation: Simple text search across messages
   - Effort: Medium

### 5.3 Low Priority / Nice to Have

7. **Add Reasoning Display**
   - Location: `MobileMessageCard` expandable section
   - Implementation: Collapsible reasoning block
   - Effort: Low

8. **Session Sidebar (Simplified)**
   - Location: Slide-out panel
   - Implementation: Same-project session list
   - Effort: High

9. **Bulk Selection for Watch**
   - Location: `MobileSessionList`
   - Implementation: Long-press to select, watch action
   - Effort: Medium

---

## 6. Shared Component Gaps

### 6.1 Missing Shared Components

| Component | Desktop | Mobile | Recommendation |
|-----------|---------|--------|----------------|
| `SessionStatusBadge` | ✅ | ❌ (different impl) | Could unify with responsive variants |
| `CopyBranch` | ✅ | ❌ | Should be shared |
| `ToolChip` | ✅ | ❌ | Should be shared (sized variants) |
| `InfoBlock` | ✅ | ❌ | Mobile has `MobileInfoCard` |
| `RelativeTime` | ✅ | ✅ | Already shared |
| `ModeBadge` | ✅ | ✅ | Already shared |

### 6.2 Responsive Component Opportunities

Components that could have responsive variants instead of separate implementations:

1. **SessionCard/SessionPreviewCard** → `SessionCard` with `size="compact"` prop
2. **InfoBlock/MobileInfoCard** → `InfoCard` with responsive padding
3. **MessageBubble/MobileMessageCard** → `MessageCard` with `detail="summary|full"` prop

---

## 7. Appendix: File Locations

### Desktop Components
```
client/src/components/SessionList/
├── SessionList.tsx          # Main list container
├── SessionCard.tsx          # Grid card view
├── SessionRow.tsx           # List row view
├── SessionStatusBadge.tsx   # Status badge component
└── AttentionBadge.tsx       # Attention indicator

client/src/components/SessionDetail/
├── SessionDetail.tsx        # Main detail container (~2000 lines)
├── SessionTabNav.tsx        # Vertical tab navigation
├── MessageBubble.tsx        # Full message rendering (~720 lines)
├── SessionMeta.tsx          # Session metadata panel
├── FileTree.tsx             # Artifact file browser
└── ImagePreview.tsx         # Image rendering
```

### Mobile Components
```
client/src/components/mobile/
├── MobileLayout.tsx         # Mobile layout wrapper
├── MobileSessionList.tsx    # Mobile list (~673 lines)
├── MobileSessionPane.tsx    # Mobile detail (~1356 lines)
├── MobileSessionDetail.tsx  # Detail route wrapper
├── MobileInfoCard.tsx       # Metric/info display
├── mobileSessionState.ts    # State helpers
└── mobileSessionViewModels.ts # Data transformers
```

### Shared Components
```
client/src/components/shared/
├── MarkdownRenderer/        # Markdown with variants
│   ├── MarkdownRenderer.tsx
│   └── CollapsibleMarkdown.tsx
├── Layout.tsx               # Desktop layout
├── RelativeTime.tsx         # Time formatting
├── modeBadge.tsx            # Mode badge
└── SessionBrowseControls.tsx # Filter controls
```

---

## 8. Summary

### Parity Score

| Category | Score | Notes |
|----------|-------|-------|
| Session List | 75% | Missing bulk actions, tool chips, sub-agent expansion |
| Session Detail | 60% | Missing 4 of 8 tabs, simplified tool rendering |
| Message Rendering | 50% | Generic pills vs specialized blocks |
| Navigation | 80% | Mobile sections well-organized |
| **Overall** | **66%** | Good for focused use, gaps for power users |

### Key Takeaways

1. **Mobile is intentionally simplified** for touch-first, on-the-go session monitoring
2. **Missing artifact access** (checkpoints, research, files) is the biggest functional gap
3. **Tool rendering** on mobile is functional but loses semantic richness
4. **Mobile innovations** (priority grouping, signal chips) could benefit desktop
5. **Branch copy** is the highest-value quick win for mobile
