# Sub-agent Threads Recency Sorting

## Context

The desktop Session Detail view previously displayed sub-agent threads split into two sections: "Running" and "Done". This categorization relied on the `isCompleted` flag from the `ActiveSubAgent` type, which was derived from various event types (`subagent.completed`, `subagent.failed`, `tool.execution_complete`).

## Problem

Status detection for sub-agents proved unreliable in several scenarios:

1. **agent_idle notifications** - When an agent reports being "idle (waiting for messages)", it does not mean the agent is completed. The agent can still be read from or written to.
2. **Event compaction** - When sessions are compacted, some events that would indicate completion may be lost.
3. **Async read_agent tools** - These spawn agents without `subagent.started` events, making lifecycle tracking difficult.

This led to false confidence in the Running/Done grouping, with threads potentially appearing in the wrong section or status indicators being misleading.

## Solution

We replaced the status-based grouping with a **single unified list sorted by recency**:

### Design Changes

1. **Single list** - All sub-agents appear in one "Threads" list
2. **Recency sorting** - Sorted by `lastActivityAt` timestamp descending (most recent first)
3. **Stable secondary sort** - `toolCallId` used for stable ordering when timestamps match
4. **Metadata visibility** - Each row shows:
   - `agent_id` - The stable identifier for the agent
   - Task description - What the agent was tasked with (or "No description")
   - Relative time - Human-readable last activity (e.g., "4h ago", "just now")

### Implementation

#### Server-side (`sessionReader.ts`)

Added `lastActivityAt` tracking in `buildActiveSubAgents()`:

- `subagent.started` - Initial activity timestamp
- `subagent.completed` / `subagent.failed` - Completion timestamp
- `tool.execution_start` (read_agent) - When async agent started
- `tool.execution_complete` - When tool finished
- Synthetic agents - Timestamp from idle notification

#### Client-side (`SessionDetail.tsx`)

Modified `ThreadExplorer` component:

- Removed `runningThreads` and `completedThreads` filtering
- Added `sortedThreads` computed via `useMemo` with recency sort
- Updated header to show "Threads" with total count
- Simplified layout by removing separate section blocks

Updated `ThreadListItem` component:

- Shows `agentId` prominently (top-left)
- Shows relative time via `RelativeTime` component (top-right)
- Shows description with "No description" fallback (bottom)
- Removed status indicator dot

## Benefits

1. **Accuracy** - Recency is objectively measurable from event timestamps
2. **Scanability** - Users can quickly see which threads were active most recently
3. **Simplicity** - No complex status inference logic in the UI
4. **Consistency** - Similar pattern to session list sorting by `lastActivityAt`

## Trade-offs

1. **No status grouping** - Users cannot quickly filter to see only "running" agents
2. **Less visual distinction** - Running vs completed agents look similar (only time differs)
3. **Temporary solution** - This is a pragmatic simplification until status detection improves

## Future Considerations

If status detection becomes reliable in the future, we could reintroduce status indicators as visual badges without separate sections:

- Small "Running" or "Done" badge next to the time
- Color coding (green dot for active)
- Filter option to show only active/completed

## Related

- Issue: `260405_desktop-session-detail-subagent-threads-recency-sorted-list.md`
- Affected components: `ThreadExplorer`, `ThreadListItem`
- Related types: `ActiveSubAgent`, `SessionDetail`
