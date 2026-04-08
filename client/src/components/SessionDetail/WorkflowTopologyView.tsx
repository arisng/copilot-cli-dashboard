import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ParsedMessage, ToolRequest, WorkflowNode, WorkflowEdge, WorkflowGraph } from '../../api/client.ts';
import { buildTurnOptions } from '../../utils/messageFilters.ts';
import { RelativeTime } from '../shared/RelativeTime.tsx';

// Workflow topology diagram view for visualizing a turn as a node-based graph

interface Props {
  messages: ParsedMessage[];
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Build workflow graph from messages for a specific turn
function buildWorkflowGraph(messages: ParsedMessage[]): WorkflowGraph {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  let nodeId = 0;

  const userMessage = messages.find((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const finalMessage = assistantMessages[assistantMessages.length - 1];

  // Add user prompt node
  if (userMessage) {
    const preview = userMessage.content.trim().slice(0, 80);
    nodes.push({
      id: `node-${nodeId++}`,
      type: 'user-prompt',
      label: 'User Prompt',
      description: preview.length > 80 ? `${preview.slice(0, 79)}…` : preview,
      timestamp: userMessage.timestamp,
    });
  }

  // Collect all tool calls and sub-agents
  const toolNodes = new Map<string, string>(); // toolCallId -> nodeId
  const agentNodes = new Map<string, string>(); // agentId -> nodeId

  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolRequests) {
      for (const tool of msg.toolRequests) {
        const isSubAgent = tool.name === 'task' || tool.name === 'read_agent';
        
        if (isSubAgent) {
          const args = tool.arguments as { name?: string; agent_id?: string; description?: string } | undefined;
          const agentId = args?.name || args?.agent_id || tool.toolCallId;
          const description = args?.description || `${tool.name} call`;
          
          if (!agentNodes.has(agentId)) {
            const node: WorkflowNode = {
              id: `node-${nodeId++}`,
              type: 'sub-agent',
              label: agentId,
              description,
              metadata: {
                toolName: tool.name,
                toolCallId: tool.toolCallId,
                agentType: args?.name ? 'named-task' : tool.name === 'read_agent' ? 'read-agent' : 'task',
              },
              status: tool.error ? 'error' : tool.result ? 'completed' : 'running',
              timestamp: msg.timestamp,
            };
            nodes.push(node);
            agentNodes.set(agentId, node.id);
          }
          toolNodes.set(tool.toolCallId, agentNodes.get(agentId)!);
        } else {
          const node: WorkflowNode = {
            id: `node-${nodeId++}`,
            type: 'tool-call',
            label: tool.name,
            description: tool.intentionSummary || tool.toolTitle || `Tool: ${tool.name}`,
            metadata: {
              toolCallId: tool.toolCallId,
              arguments: tool.arguments,
            },
            status: tool.error ? 'error' : tool.result ? 'completed' : 'pending',
            timestamp: msg.timestamp,
          };
          nodes.push(node);
          toolNodes.set(tool.toolCallId, node.id);
        }
      }
    }
  }

  // Create edges between consecutive nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      from: nodes[i].id,
      to: nodes[i + 1].id,
    });
  }

  // Add result node if we have a final assistant message
  if (finalMessage && finalMessage !== assistantMessages[0]) {
    const resultNode: WorkflowNode = {
      id: `node-${nodeId++}`,
      type: 'result',
      label: 'Final Result',
      description: finalMessage.content.trim().slice(0, 100) || 'Response generated',
      timestamp: finalMessage.timestamp,
    };
    nodes.push(resultNode);
    
    // Connect last tool/agent to result
    const lastToolNode = nodes.filter((n) => n.type === 'tool-call' || n.type === 'sub-agent').pop();
    if (lastToolNode) {
      edges.push({
        id: `edge-result`,
        from: lastToolNode.id,
        to: resultNode.id,
      });
    } else if (nodes.length > 1) {
      edges.push({
        id: `edge-result`,
        from: nodes[nodes.length - 2].id,
        to: resultNode.id,
      });
    }
  }

  return { nodes, edges };
}

// Calculate node positions using a simple layered layout
function calculateNodePositions(nodes: WorkflowNode[]): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const nodeWidth = 200;
  const nodeHeight = 80;
  const horizontalGap = 60;
  const verticalGap = 40;

  // Group nodes by type for layering
  const userNode = nodes.find((n) => n.type === 'user-prompt');
  const toolNodes = nodes.filter((n) => n.type === 'tool-call' || n.type === 'sub-agent');
  const resultNode = nodes.find((n) => n.type === 'result');

  let currentX = 50;
  const centerY = 250;

  // Position user node
  if (userNode) {
    positions.set(userNode.id, {
      x: currentX,
      y: centerY - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    });
    currentX += nodeWidth + horizontalGap;
  }

  // Position tool/agent nodes in a vertical stack
  for (let i = 0; i < toolNodes.length; i++) {
    const node = toolNodes[i];
    const stackOffset = toolNodes.length > 1 
      ? (i - (toolNodes.length - 1) / 2) * (nodeHeight + verticalGap)
      : 0;
    
    positions.set(node.id, {
      x: currentX,
      y: centerY - nodeHeight / 2 + stackOffset,
      width: nodeWidth,
      height: nodeHeight,
    });
  }

  if (toolNodes.length > 0) {
    currentX += nodeWidth + horizontalGap;
  }

  // Position result node
  if (resultNode) {
    positions.set(resultNode.id, {
      x: currentX,
      y: centerY - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    });
  }

  return positions;
}

// Node component for rendering a single node
function WorkflowNodeCard({
  node,
  position,
  isSelected,
  onClick,
}: {
  node: WorkflowNode;
  position: NodePosition;
  isSelected: boolean;
  onClick: () => void;
}) {
  const getNodeColor = () => {
    switch (node.type) {
      case 'user-prompt':
        return 'border-gh-accent/50 bg-gh-accent/10';
      case 'sub-agent':
        return 'border-sky-400/50 bg-sky-400/10';
      case 'tool-call':
        return 'border-gh-muted/50 bg-gh-surface/50';
      case 'result':
        return 'border-gh-active/50 bg-gh-active/10';
      default:
        return 'border-gh-border bg-gh-surface/30';
    }
  };

  const getStatusDot = () => {
    if (!node.status) return null;
    const colors = {
      pending: 'bg-gh-muted animate-pulse',
      running: 'bg-gh-accent animate-pulse',
      completed: 'bg-gh-active',
      error: 'bg-gh-attention',
    };
    return <span className={`w-2 h-2 rounded-full ${colors[node.status]}`} />;
  };

  return (
    <div
      onClick={onClick}
      className={`absolute cursor-pointer rounded-xl border p-3 transition-all duration-200 hover:shadow-lg ${
        isSelected ? 'ring-2 ring-gh-accent shadow-lg' : ''
      } ${getNodeColor()}`}
      style={{
        left: position.x,
        top: position.y,
        width: position.width,
        height: position.height,
      }}
    >
      <div className="flex items-start gap-2 h-full overflow-hidden">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {getStatusDot()}
            <span className="text-[10px] uppercase tracking-wide text-gh-muted/70">
              {node.type.replace('-', ' ')}
            </span>
          </div>
          <p className="text-xs font-medium text-gh-text truncate">{node.label}</p>
          {node.description && (
            <p className="text-[10px] text-gh-muted/80 line-clamp-2 mt-0.5">{node.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Canvas container for the diagram
function WorkflowCanvas({
  graph,
  selectedNodeId,
  onNodeSelect,
}: {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const positions = useMemo(() => calculateNodePositions(graph.nodes), [graph.nodes]);

  // Calculate canvas bounds
  const canvasBounds = useMemo(() => {
    if (positions.size === 0) return { width: 800, height: 500 };
    let maxX = 0;
    let maxY = 0;
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    }
    return { width: maxX + 100, height: Math.max(maxY + 100, 500) };
  }, [positions]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport((prev) => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(2, prev.zoom * delta)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.canvas) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    }
  }, [viewport.x, viewport.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setViewport((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  // Center the view initially
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const offsetX = Math.max(0, (containerWidth - canvasBounds.width) / 2);
      setViewport((prev) => ({ ...prev, x: offsetX }));
    }
  }, [canvasBounds.width]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-gh-bg/50 cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Canvas content */}
      <div
        data-canvas="true"
        className="absolute"
        style={{
          left: viewport.x,
          top: viewport.y,
          transform: `scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: canvasBounds.width,
          height: canvasBounds.height,
        }}
      >
        {/* Edges SVG layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasBounds.width}
          height={canvasBounds.height}
        >
          {graph.edges.map((edge) => {
            const fromPos = positions.get(edge.from);
            const toPos = positions.get(edge.to);
            if (!fromPos || !toPos) return null;
            
            const x1 = fromPos.x + fromPos.width;
            const y1 = fromPos.y + fromPos.height / 2;
            const x2 = toPos.x;
            const y2 = toPos.y + toPos.height / 2;
            
            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gh-border"
                />
                <polygon
                  points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`}
                  fill="currentColor"
                  className="text-gh-border"
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes layer */}
        {graph.nodes.map((node) => (
          <WorkflowNodeCard
            key={node.id}
            node={node}
            position={positions.get(node.id)!}
            isSelected={selectedNodeId === node.id}
            onClick={() => onNodeSelect(selectedNodeId === node.id ? null : node.id)}
          />
        ))}
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        <div className="rounded-lg border border-gh-border bg-gh-surface/90 px-3 py-2 text-xs text-gh-muted">
          Zoom: {Math.round(viewport.zoom * 100)}%
        </div>
        <button
          type="button"
          onClick={handleResetView}
          className="rounded-lg border border-gh-border bg-gh-surface/90 px-3 py-2 text-xs text-gh-text hover:bg-gh-surface transition-colors"
        >
          Reset view
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 rounded-lg border border-gh-border bg-gh-surface/90 px-3 py-2 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide text-gh-muted mb-2">Legend</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-gh-accent/50 bg-gh-accent/10" />
          <span className="text-xs text-gh-muted">User Prompt</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-sky-400/50 bg-sky-400/10" />
          <span className="text-xs text-gh-muted">Sub-Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-gh-muted/50 bg-gh-surface/50" />
          <span className="text-xs text-gh-muted">Tool Call</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-gh-active/50 bg-gh-active/10" />
          <span className="text-xs text-gh-muted">Result</span>
        </div>
      </div>
    </div>
  );
}

// Node details panel
function NodeDetailsPanel({ node, onClose }: { node: WorkflowNode; onClose: () => void }) {
  return (
    <div className="absolute top-4 right-4 w-72 rounded-xl border border-gh-border bg-gh-surface/95 shadow-lg">
      <div className="flex items-center justify-between border-b border-gh-border px-4 py-3">
        <h3 className="text-sm font-semibold text-gh-text">Node Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gh-muted hover:text-gh-text"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Type</p>
          <p className="text-sm text-gh-text capitalize">{node.type.replace('-', ' ')}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Label</p>
          <p className="text-sm text-gh-text">{node.label}</p>
        </div>
        {node.description && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Description</p>
            <p className="text-sm text-gh-text">{node.description}</p>
          </div>
        )}
        {node.status && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Status</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
              node.status === 'completed' ? 'border-gh-active/30 bg-gh-active/10 text-gh-active' :
              node.status === 'running' ? 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent' :
              node.status === 'error' ? 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention' :
              'border-gh-border bg-gh-bg/70 text-gh-muted'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                node.status === 'completed' ? 'bg-gh-active' :
                node.status === 'running' ? 'bg-gh-accent animate-pulse' :
                node.status === 'error' ? 'bg-gh-attention' :
                'bg-gh-muted'
              }`} />
              {node.status}
            </span>
          </div>
        )}
        {node.timestamp && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Timestamp</p>
            <p className="text-xs text-gh-muted">
              <RelativeTime timestamp={node.timestamp} />
            </p>
          </div>
        )}
        {node.metadata && Object.keys(node.metadata).length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70 mb-1">Metadata</p>
            <pre className="text-[10px] text-gh-muted bg-gh-bg/50 rounded p-2 overflow-auto max-h-32">
              {JSON.stringify(node.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Main workflow topology view
export function WorkflowTopologyView({ messages, isFullScreen = false, onToggleFullScreen }: Props) {
  const turnOptions = useMemo(() => buildTurnOptions(messages), [messages]);
  const [selectedTurnId, setSelectedTurnId] = useState<string>(() => 
    turnOptions[turnOptions.length - 1]?.turnId ?? ''
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Update selected turn when turns change
  useEffect(() => {
    if (turnOptions.length > 0 && !turnOptions.find((t) => t.turnId === selectedTurnId)) {
      setSelectedTurnId(turnOptions[turnOptions.length - 1].turnId);
    }
  }, [turnOptions, selectedTurnId]);

  const currentTurn = useMemo(
    () => turnOptions.find((t) => t.turnId === selectedTurnId),
    [turnOptions, selectedTurnId]
  );

  const graph = useMemo(
    () => currentTurn ? buildWorkflowGraph(currentTurn.messages) : { nodes: [], edges: [] },
    [currentTurn]
  );

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );

  if (turnOptions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gh-muted text-sm">No conversation turns available.</p>
          <p className="text-gh-muted/70 text-xs mt-1">
            Workflow topology requires at least one user message.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Turn selector header */}
      <div className="shrink-0 border-b border-gh-border bg-gh-surface/30 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gh-text">Workflow Topology</p>
            <p className="text-xs text-gh-muted mt-0.5">
              Visualize how this turn was resolved from prompt to result
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gh-muted">Turn:</label>
            <select
              value={selectedTurnId}
              onChange={(e) => {
                setSelectedTurnId(e.target.value);
                setSelectedNodeId(null);
              }}
              className="min-w-[12rem] rounded-md border border-gh-border bg-gh-bg px-2 py-1.5 text-xs text-gh-text focus:border-gh-accent focus:outline-none"
            >
              {turnOptions.map((turn, index) => (
                <option key={turn.turnId} value={turn.turnId}>
                  Turn {index + 1}: {turn.label}
                </option>
              ))}
            </select>
            {onToggleFullScreen && (
              <button
                type="button"
                onClick={onToggleFullScreen}
                title={isFullScreen ? 'Exit full screen' : 'Full screen'}
                className="inline-flex items-center justify-center rounded-md border border-gh-border bg-gh-bg p-1.5 text-gh-muted transition-colors hover:border-gh-accent hover:text-gh-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70"
              >
                {isFullScreen ? (
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                    <path d="M5.5 1.5A1.5 1.5 0 0 0 4 3v2.5h1V3a.5.5 0 0 1 .5-.5h2.5V1.5H5.5Zm5 0V1H8v1.5h2.5V6h1V3a.5.5 0 0 0-.5-.5h-2.5Zm-5 13A1.5 1.5 0 0 1 4 13v-2.5h1V13a.5.5 0 0 0 .5.5h2.5V15H5.5Zm5 0V15H8v-1.5h2.5V10h1v3a.5.5 0 0 1-.5.5h-2.5Z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                    <path d="M1.5 1h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V2H1.5a.5.5 0 0 1 0-1Zm11 0h-2a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0V2h1.5a.5.5 0 0 0 0-1Zm-11 14h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-1 0v1.5H1.5a.5.5 0 0 0 0 1Zm11 0h-2a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 1 0v1.5h1.5a.5.5 0 0 1 0 1Z"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Graph stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gh-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gh-muted" />
            {graph.nodes.length} nodes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gh-border" />
            {graph.edges.length} edges
          </span>
          {currentTurn && (
            <span className="text-gh-muted/70">
              <RelativeTime timestamp={currentTurn.messages[0]?.timestamp} />
            </span>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <WorkflowCanvas
        graph={graph}
        selectedNodeId={selectedNodeId}
        onNodeSelect={setSelectedNodeId}
      />

      {/* Node details panel */}
      {selectedNode && (
        <NodeDetailsPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
      )}
    </div>
  );
}
