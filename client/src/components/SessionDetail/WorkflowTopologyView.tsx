import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ParsedMessage, ToolRequest, WorkflowNode, WorkflowEdge, WorkflowGraph, WorkflowNodeDispatchMetadata, ActiveSubAgent } from '../../api/client.ts';
import { buildTurnOptions } from '../../utils/messageFilters.ts';
import { RelativeTime } from '../shared/RelativeTime.tsx';
import { MultiSelectDropdown } from '../shared/MessageFilterBar.tsx';

// Workflow topology diagram view for visualizing turn execution as multi-turn orchestration

interface Props {
  messages: ParsedMessage[];
  activeSubAgents?: ActiveSubAgent[]; // Add this
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

interface WorkflowRound {
  id: string;
  index: number;
  mainAgentNode: WorkflowNode;
  responseNodes: WorkflowNode[];
}

type NodeTypeFilter = 'all' | 'agents-only' | 'tools-only';

// New filter types for AMTP v2 refined taxonomy
interface FilterState {
  nodeType: NodeTypeFilter;
  agentTypes: string[];  // Filter by agentType (background sub-agents only)
  tools: string[];       // Filter by tool name (replaces dispatchFamilies)
}

// Helper to determine dispatch family from tool name and arguments
function determineDispatchFamily(toolName: string, args: Record<string, unknown> | undefined): WorkflowNodeDispatchMetadata['family'] {
  // Agent management tools
  if (toolName === 'task') {
    return 'agent-management';
  }
  if (toolName === 'read_agent') {
    return 'agent-management';
  }
  
  // Orchestration tools
  if (toolName === 'task_complete') {
    return 'orchestration';
  }
  if (toolName === 'exit_plan_mode') {
    return 'orchestration';
  }
  if (toolName === 'plan_mode') {
    return 'orchestration';
  }
  
  // Shell/Execution tools
  if (toolName === 'shell' || toolName === 'execute') {
    return 'execution';
  }
  
  // Default to tool family
  return 'tool';
}

// Extract agent type from various sources using normalized taxonomy (AMTP v2)
function extractAgentType(node: WorkflowNode): string | undefined {
  if (node.type === 'user-prompt') return undefined;
  if (node.type === 'result') return undefined;
  
  // For tool-call nodes with agent-management family, extract from metadata
  if (node.type === 'tool-call' && node.metadata?.dispatch?.family === 'agent-management') {
    const targetName = node.metadata?.agent?.targetName;
    if (targetName) {
      const lowerTarget = targetName.toLowerCase();
      if (lowerTarget.includes('coder') || lowerTarget.includes('code') || lowerTarget.includes('dev')) return 'coder';
      if (lowerTarget.includes('explore') || lowerTarget.includes('research') || lowerTarget.includes('find')) return 'explorer';
      if (lowerTarget.includes('plan') || lowerTarget.includes('design') || lowerTarget.includes('architect')) return 'planner';
      if (lowerTarget.includes('review') || lowerTarget.includes('audit') || lowerTarget.includes('check')) return 'reviewer';
      if (lowerTarget.includes('test') || lowerTarget.includes('verify') || lowerTarget.includes('validate')) return 'tester';
      if (lowerTarget.includes('doc') || lowerTarget.includes('write') || lowerTarget.includes('author')) return 'writer';
      return targetName;
    }
  }
  
  // Use metadata.agent.targetName when available (authoritative)
  const metadata = node.metadata;
  if (metadata?.agent?.targetName) {
    const targetName = metadata.agent.targetName.toLowerCase();
    // Map common target names to agent types
    if (targetName.includes('coder') || targetName.includes('code') || targetName.includes('dev')) return 'coder';
    if (targetName.includes('explore') || targetName.includes('research') || targetName.includes('find')) return 'explorer';
    if (targetName.includes('plan') || targetName.includes('design') || targetName.includes('architect')) return 'planner';
    if (targetName.includes('review') || targetName.includes('audit') || targetName.includes('check')) return 'reviewer';
    if (targetName.includes('test') || targetName.includes('verify') || targetName.includes('validate')) return 'tester';
    if (targetName.includes('doc') || targetName.includes('write') || targetName.includes('author')) return 'writer';
    if (targetName.includes('orchestrat') || targetName.includes('main') || targetName.includes('primary')) return 'orchestrator';
    return metadata.agent.targetName; // Return as-is if no match
  }
  
  // Fall back to node.agentType if already set
  if (node.agentType) {
    return node.agentType;
  }
  
  if (node.type === 'main-agent') {
    return 'orchestrator';
  }
  
  if (node.type === 'sub-agent') {
    // True background sub-agents - show as background task
    if (node.metadata?.backgroundInfo?.detached) {
      return 'background';
    }
    // Fall back to heuristic label parsing only when needed
    const label = (node.label || '').toLowerCase();
    if (label.includes('coder') || label.includes('code') || label.includes('dev')) return 'coder';
    if (label.includes('explore') || label.includes('research') || label.includes('find')) return 'explorer';
    if (label.includes('plan') || label.includes('design') || label.includes('architect')) return 'planner';
    if (label.includes('review') || label.includes('audit') || label.includes('check')) return 'reviewer';
    if (label.includes('test') || label.includes('verify') || label.includes('validate')) return 'tester';
    if (label.includes('doc') || label.includes('write') || label.includes('author')) return 'writer';
    // Return undefined instead of generic 'agent' for unknowns
    return undefined;
  }
  
  if (node.type === 'tool-call') {
    // For agent-management tools, show the agent type
    if (node.metadata?.dispatch?.family === 'agent-management') {
      return extractAgentType(node); // Recursive call to get agent type from metadata
    }
    // Categorize other tools
    const name = (node.label || '').toLowerCase();
    if (name.includes('git')) return 'git';
    if (name.includes('file') || name.includes('read') || name.includes('write')) return 'file';
    if (name.includes('shell') || name.includes('exec') || name.includes('run')) return 'shell';
    if (name.includes('search') || name.includes('grep') || name.includes('find')) return 'search';
    return 'tool';
  }
  
  if (node.type === 'detached-shell') {
    return 'shell';
  }
  
  return undefined;
}

// Extract model from agent ID (e.g., "audit-claude-sonnet-4-6" -> "claude-sonnet-4")
// Returns undefined if no model can be inferred
function extractModelFromAgentId(agentId: string): string | undefined {
  const lower = agentId.toLowerCase();
  
  // Check for common model patterns
  if (lower.includes('claude-opus')) return 'claude-opus-4';
  if (lower.includes('claude-sonnet')) return 'claude-sonnet-4';
  if (lower.includes('claude') && lower.includes('4')) return 'claude-4';
  if (lower.includes('gpt-5')) return 'gpt-5';
  if (lower.includes('gpt-4')) return 'gpt-4';
  if (lower.includes('o3') || lower.includes('o1')) return 'o3-mini';
  
  return undefined;
}

// Build multi-turn workflow graph with refined AMTP v2 taxonomy
function buildMultiTurnGraph(messages: ParsedMessage[]): {
  rounds: WorkflowRound[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const rounds: WorkflowRound[] = [];
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  let nodeId = 0;
  
  // Find user prompt and final result
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
  
  // Parse messages to build rounds
  // Each assistant.message with toolRequests starts a new round
  const toolNodes = new Map<string, string>(); // toolCallId -> nodeId
  
  for (let i = 0; i < assistantMessages.length; i++) {
    const msg = assistantMessages[i];
    const isLast = i === assistantMessages.length - 1;
    
    // Check if this is a "final result" message (no tool requests, last message)
    if (isLast && (!msg.toolRequests || msg.toolRequests.length === 0)) {
      // This is the final result
      const resultNode: WorkflowNode = {
        id: `node-${nodeId++}`,
        type: 'result',
        label: 'Final Result',
        description: msg.content.trim().slice(0, 100) || 'Response generated',
        timestamp: msg.timestamp,
      };
      nodes.push(resultNode);
      
      // Connect from last round's main agent or responses
      if (rounds.length > 0) {
        const lastRound = rounds[rounds.length - 1];
        edges.push({
          id: `edge-result`,
          from: lastRound.mainAgentNode.id,
          to: resultNode.id,
        });
      }
      break;
    }
    
    // This is a main agent turn (orchestrator)
    const roundIndex = rounds.length;
    const mainAgentDescription = msg.content.trim().slice(0, 60) || 'Processing...';
    
    // Skip orchestrator nodes with only "Processing..." content
    const isProcessingOnly = !msg.content.trim() || msg.content.trim() === 'Processing...';
    
    // Extract model info from message metadata if available
    const messageMetadata = (msg as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    const messageModel = messageMetadata?.model as { name?: string; source?: string } | undefined;
    
    const mainAgentNode: WorkflowNode = {
      id: `node-${nodeId++}`,
      type: 'main-agent',
      label: `Main Agent${roundIndex > 0 ? ` (${roundIndex + 1})` : ''}`,
      agentType: 'orchestrator',
      description: mainAgentDescription,
      metadata: {
        toolName: 'orchestrator',
        model: messageModel ? {
          name: messageModel.name || null,
          source: messageModel.source || null,
        } : undefined,
      },
      timestamp: msg.timestamp,
      roundIndex,
      isMainAgent: true,
    };
    
    // Skip adding this main agent node if it's just "Processing..."
    if (!isProcessingOnly) {
      nodes.push(mainAgentNode);
    } else {
      // Use the previous round's main agent as the connection point, or skip if first round
      if (roundIndex === 0) {
        // First round with no content - skip this entire round
        continue;
      }
      // Otherwise, connect tools to previous round's main agent
    }
    
    // Connect from previous round's responses or user prompt (only if main agent wasn't skipped)
    if (!isProcessingOnly) {
      if (roundIndex === 0) {
        if (userMessage && nodes.length > 1) {
          edges.push({
            id: `edge-user-to-round${roundIndex}`,
            from: nodes[0].id,
            to: mainAgentNode.id,
          });
        }
      } else {
        // Connect from previous round's main agent
        const prevRound = rounds[roundIndex - 1];
        if (prevRound) {
          edges.push({
            id: `edge-round${roundIndex - 1}-to-${roundIndex}`,
            from: prevRound.mainAgentNode.id,
            to: mainAgentNode.id,
          });
        }
      }
    }
    
    // Collect response nodes (sub-agents and tools)
    const responseNodes: WorkflowNode[] = [];
    
    if (msg.toolRequests) {
      for (const tool of msg.toolRequests) {
        const family = determineDispatchFamily(tool.name, tool.arguments);
        const isAgentManagementTool = tool.name === 'task' || tool.name === 'read_agent';
        
        // AMTP v2: Agent-management tools create tool-call nodes (NOT sub-agent)
        if (isAgentManagementTool) {
          const args = tool.arguments as { 
            name?: string; 
            agent_id?: string; 
            description?: string;
            model?: string;
            mode?: string;
          } | undefined;
          
          // agentId is the custom name from args.name or args.agent_id
          const agentId = args?.name || args?.agent_id || tool.toolCallId;
          const description = args?.description || `${tool.name} call`;
          
          // agentName is the custom agent name (e.g., "Coder", "rubber-duck")
          const agentName = args?.name || args?.agent_id;
          
          // Use metadata.model when available (authoritative), otherwise fall back to args.model
          let model: string | undefined;
          let modelSource: string | undefined;
          
          if (args?.model) {
            model = args.model;
            modelSource = 'args';
          } else {
            // Fall back to inference from agentId
            const inferred = extractModelFromAgentId(agentId);
            if (inferred) {
              model = inferred;
              modelSource = 'inferred';
            }
          }
          
          // Determine agent type from targetName if available
          const targetName = args?.name || args?.agent_id;
          let agentType: string | undefined;
          if (targetName) {
            const lowerTarget = targetName.toLowerCase();
            if (lowerTarget.includes('coder') || lowerTarget.includes('code') || lowerTarget.includes('dev')) agentType = 'coder';
            else if (lowerTarget.includes('explore') || lowerTarget.includes('research') || lowerTarget.includes('find')) agentType = 'explorer';
            else if (lowerTarget.includes('plan') || lowerTarget.includes('design') || lowerTarget.includes('architect')) agentType = 'planner';
            else if (lowerTarget.includes('review') || lowerTarget.includes('audit') || lowerTarget.includes('check')) agentType = 'reviewer';
            else if (lowerTarget.includes('test') || lowerTarget.includes('verify') || lowerTarget.includes('validate')) agentType = 'tester';
            else if (lowerTarget.includes('doc') || lowerTarget.includes('write') || lowerTarget.includes('author')) agentType = 'writer';
          }
          
          // AMTP v2: Agent-management tools are dispatch tool-calls
          // They get upgraded to sub-agent by the enrichment step when server has worker data
          const toolCallNode: WorkflowNode = {
            id: `node-${nodeId++}`,
            type: 'tool-call',
            label: agentId,
            agentType,
            agentName,
            model,
            description,
            metadata: {
              toolCallId: tool.toolCallId,
              toolName: tool.name,
              dispatch: {
                toolName: tool.name,
                family: 'agent-management',
                toolCallId: tool.toolCallId,
              },
              agent: targetName ? {
                targetName,
                targetKind: tool.name === 'task' ? 'task-agent' : 'read-agent',
                instanceId: tool.toolCallId,
              } : undefined,
              model: model ? {
                name: model,
                source: modelSource || 'unknown',
              } : undefined,
              backgroundMode: args?.mode === 'background',
            },
            status: tool.error ? 'error' : tool.result ? 'completed' : 'running',
            timestamp: msg.timestamp,
            roundIndex,
            isMainAgent: false,
          };
          nodes.push(toolCallNode);
          responseNodes.push(toolCallNode);
          toolNodes.set(tool.toolCallId, toolCallNode.id);
          
          // Edge from main agent to tool-call (use previous round if current is skipped)
          const sourceNodeId = isProcessingOnly && roundIndex > 0 
            ? rounds[roundIndex - 1]?.mainAgentNode.id 
            : mainAgentNode.id;
          if (sourceNodeId) {
            edges.push({
              id: `edge-dispatch-${tool.toolCallId}`,
              from: sourceNodeId,
              to: toolCallNode.id,
            });
          }
        } else if (tool.name === 'shell' && tool.arguments?.detached === true) {
          // AMTP v2: Detached shell execution creates detached-shell node
          const args = tool.arguments as { 
            command?: string;
            description?: string;
            detached?: boolean;
            processId?: string;
          } | undefined;
          
          const description = args?.description || args?.command || 'Detached shell execution';
          
          const detachedShellNode: WorkflowNode = {
            id: `node-${nodeId++}`,
            type: 'detached-shell',
            label: 'Detached Shell',
            description,
            metadata: {
              toolCallId: tool.toolCallId,
              toolName: tool.name,
              dispatch: {
                toolName: tool.name,
                family: 'execution',
                toolCallId: tool.toolCallId,
              },
              backgroundInfo: {
                detached: true,
                processId: args?.processId,
              },
            },
            status: tool.error ? 'error' : tool.result ? 'completed' : 'running',
            timestamp: msg.timestamp,
            roundIndex,
            isMainAgent: false,
          };
          nodes.push(detachedShellNode);
          responseNodes.push(detachedShellNode);
          toolNodes.set(tool.toolCallId, detachedShellNode.id);
          
          // Edge from main agent to detached-shell
          const sourceNodeId = isProcessingOnly && roundIndex > 0 
            ? rounds[roundIndex - 1]?.mainAgentNode.id 
            : mainAgentNode.id;
          if (sourceNodeId) {
            edges.push({
              id: `edge-dispatch-${tool.toolCallId}`,
              from: sourceNodeId,
              to: detachedShellNode.id,
            });
          }
        } else {
          // tool_complete is handled as orchestration, not a sub-agent node
          const isOrchestration = family === 'orchestration';
          
          const toolNode: WorkflowNode = {
            id: `node-${nodeId++}`,
            type: isOrchestration ? 'main-agent' : 'tool-call',
            label: tool.name,
            agentType: isOrchestration ? 'orchestrator' : extractAgentType({ type: 'tool-call', label: tool.name } as WorkflowNode),
            description: tool.intentionSummary || tool.toolTitle || `Tool: ${tool.name}`,
            metadata: {
              toolCallId: tool.toolCallId,
              toolName: tool.name,
              dispatch: {
                toolName: tool.name,
                family,
                toolCallId: tool.toolCallId,
              },
            },
            status: tool.error ? 'error' : tool.result ? 'completed' : 'pending',
            timestamp: msg.timestamp,
            roundIndex,
            isMainAgent: isOrchestration,
          };
          nodes.push(toolNode);
          responseNodes.push(toolNode);
          toolNodes.set(tool.toolCallId, toolNode.id);
          
          // Edge from main agent to tool (use previous round if current is skipped)
          const sourceNodeId = isProcessingOnly && roundIndex > 0 
            ? rounds[roundIndex - 1]?.mainAgentNode.id 
            : mainAgentNode.id;
          if (sourceNodeId) {
            edges.push({
              id: `edge-dispatch-${tool.toolCallId}`,
              from: sourceNodeId,
              to: toolNode.id,
            });
          }
        }
      }
    }
    
    // Only add round if main agent node was not skipped (Processing... only)
    if (!isProcessingOnly) {
      rounds.push({
        id: `round-${roundIndex}`,
        index: roundIndex,
        mainAgentNode,
        responseNodes,
      });
    } else if (responseNodes.length > 0 && roundIndex > 0) {
      // If main agent was skipped but we have responses, add them to previous round
      const prevRound = rounds[roundIndex - 1];
      if (prevRound) {
        prevRound.responseNodes.push(...responseNodes);
      }
    }
  }
  
  // If no final result node was created, create one from the last message
  if (finalMessage && !nodes.some(n => n.type === 'result') && rounds.length > 0) {
    const resultNode: WorkflowNode = {
      id: `node-${nodeId++}`,
      type: 'result',
      label: 'Final Result',
      description: finalMessage.content.trim().slice(0, 100) || 'Response generated',
      timestamp: finalMessage.timestamp,
    };
    nodes.push(resultNode);
    
    const lastRound = rounds[rounds.length - 1];
    edges.push({
      id: `edge-result`,
      from: lastRound.mainAgentNode.id,
      to: resultNode.id,
    });
  }
  
  return { rounds, nodes, edges };
}

// Apply node type filter to the graph
// AMTP v2: Core nodes (user-prompt, main-agent, result) are always shown
// Filters only apply to other node types (tool-call, sub-agent, detached-shell)
function applyNodeFilter(
  rounds: WorkflowRound[],
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  filter: FilterState,
): { rounds: WorkflowRound[]; nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  // user-prompt and result are unconditionally preserved
  const ALWAYS_KEEP = new Set(['user-prompt', 'result']);
  // Core types that survive node-type filter by default; main-agent may be pruned below
  const CORE_NODE_TYPES = new Set(['user-prompt', 'main-agent', 'result']);

  let filteredNodes = nodes;

  // Apply node type filter
  if (filter.nodeType === 'agents-only') {
    // Show: user-prompt, main-agent, sub-agent, detached-shell, result — hide: tool-call
    const allowedTypes = new Set(['user-prompt', 'main-agent', 'sub-agent', 'detached-shell', 'result']);
    filteredNodes = filteredNodes.filter(n => allowedTypes.has(n.type));
  }

  if (filter.nodeType === 'tools-only') {
    // Show: user-prompt, main-agent, tool-call, result — hide: sub-agent, detached-shell
    const allowedTypes = new Set(['user-prompt', 'main-agent', 'tool-call', 'result']);
    filteredNodes = filteredNodes.filter(n => allowedTypes.has(n.type));
  }

  // Apply agent type filter (only to non-core nodes)
  if (filter.agentTypes.length > 0) {
    filteredNodes = filteredNodes.filter(n => {
      if (CORE_NODE_TYPES.has(n.type)) return true;
      const agentType = n.agentType || extractAgentType(n);
      return agentType && filter.agentTypes.includes(agentType);
    });
  }

  // Apply tool filter (only to tool-call nodes; core nodes always pass)
  if (filter.tools.length > 0) {
    filteredNodes = filteredNodes.filter(n => {
      if (CORE_NODE_TYPES.has(n.type)) return true;
      if (n.type !== 'tool-call') return true; // only filter tool-call nodes
      const toolName = n.metadata?.toolName || n.label;
      return toolName && filter.tools.includes(toolName);
    });
  }

  // Path-pruning: when agent-type or family filters are active, remove main-agent
  // (Orchestrator) nodes whose rounds have no surviving response nodes.
  // This keeps only the orchestrators that actually participate in filtered paths.
  const hasSpecificFilter = filter.agentTypes.length > 0 || filter.tools.length > 0;
  if (hasSpecificFilter) {
    const survivingResponseIds = new Set(
      filteredNodes.filter(n => !CORE_NODE_TYPES.has(n.type)).map(n => n.id)
    );
    const mainAgentIdsWithSurvivors = new Set<string>();
    for (const round of rounds) {
      if (round.responseNodes.some(n => survivingResponseIds.has(n.id))) {
        mainAgentIdsWithSurvivors.add(round.mainAgentNode.id);
      }
    }
    filteredNodes = filteredNodes.filter(n => {
      if (n.type === 'main-agent' && !ALWAYS_KEEP.has(n.type)) {
        return mainAgentIdsWithSurvivors.has(n.id);
      }
      return true;
    });
  }

  // Build a set of kept node IDs
  const keptNodeIds = new Set(filteredNodes.map(n => n.id));

  // Filter edges to only include connections between kept nodes
  const filteredEdges = edges.filter(e => keptNodeIds.has(e.from) && keptNodeIds.has(e.to));

  // Rebuild rounds with filtered nodes
  const filteredRounds = rounds
    .map(round => ({
      ...round,
      responseNodes: round.responseNodes.filter(n => keptNodeIds.has(n.id)),
    }))
    .filter(round => keptNodeIds.has(round.mainAgentNode.id));

  return { rounds: filteredRounds, nodes: filteredNodes, edges: filteredEdges };
}

// Calculate node positions for multi-turn vertical layout
function calculateMultiTurnPositions(
  rounds: WorkflowRound[],
  nodes: WorkflowNode[],
  nodeWidth: number = 260,
  nodeHeight: number = 110,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const horizontalGap = 100;
  const verticalGap = 30;
  const mainAgentOffset = 80; // Distance from center to main agent
  const responseStartOffset = 40; // Distance from center to first response
  const startX = 50;
  const centerY = 300;

  // Position user prompt at Column 0, centered
  const userNode = nodes.find(n => n.type === 'user-prompt');
  if (userNode) {
    positions.set(userNode.id, {
      x: startX,
      y: centerY - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    });
  }

  // Position each round
  rounds.forEach((round, roundIndex) => {
    const columnX = startX + (roundIndex + 1) * (nodeWidth + horizontalGap);
    
    // Main Agent: Top position
    const mainAgentY = centerY - mainAgentOffset - nodeHeight / 2;
    positions.set(round.mainAgentNode.id, {
      x: columnX,
      y: mainAgentY,
      width: nodeWidth,
      height: nodeHeight,
    });
    
    // Response nodes: Bottom positions, stacked vertically
    round.responseNodes.forEach((node, i) => {
      const y = centerY + responseStartOffset + i * (nodeHeight + verticalGap);
      positions.set(node.id, {
        x: columnX,
        y,
        width: nodeWidth,
        height: nodeHeight,
      });
    });
  });

  // Position result at last column, centered
  const resultNode = nodes.find(n => n.type === 'result');
  if (resultNode && rounds.length > 0) {
    const lastColumnX = startX + (rounds.length + 1) * (nodeWidth + horizontalGap);
    positions.set(resultNode.id, {
      x: lastColumnX,
      y: centerY - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    });
  }

  return positions;
}

// Generate a curved bezier path for edges
function generateEdgePath(
  fromPos: NodePosition,
  toPos: NodePosition,
  arrowSize: number = 10
): { path: string; arrowPoints: string } | null {
  // Determine connection points based on relative positions
  const fromCx = fromPos.x + fromPos.width / 2;
  const fromCy = fromPos.y + fromPos.height / 2;
  const toCx = toPos.x + toPos.width / 2;
  const toCy = toPos.y + toPos.height / 2;
  
  // Calculate direction
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  
  let x1: number, y1: number, x2: number, y2: number;
  
  // If target is to the right
  if (dx > 0) {
    x1 = fromPos.x + fromPos.width; // Right edge of source
    y1 = fromCy;
    x2 = toPos.x; // Left edge of target
    y2 = toCy;
  } else if (dx < 0) {
    // Target is to the left (shouldn't happen much)
    x1 = fromPos.x;
    y1 = fromCy;
    x2 = toPos.x + toPos.width;
    y2 = toCy;
  } else {
    // Same column - vertical connection
    if (dy > 0) {
      // Target is below
      x1 = fromCx;
      y1 = fromPos.y + fromPos.height;
      x2 = toCx;
      y2 = toPos.y;
    } else {
      // Target is above
      x1 = fromCx;
      y1 = fromPos.y;
      x2 = toCx;
      y2 = toPos.y + toPos.height;
    }
  }

  // Calculate control points for bezier
  const controlOffset = Math.abs(dx) * 0.4;
  const cp1x = x1 + Math.sign(dx) * Math.max(controlOffset, 50);
  const cp1y = y1;
  const cp2x = x2 - Math.sign(dx) * Math.max(controlOffset, 50);
  const cp2y = y2;

  // Build the path
  const path = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

  // Calculate angle for arrowhead
  const angle = Math.atan2(dy, dx);
  const arrowAngle = Math.PI / 6;
  const ax1 = x2 - arrowSize * Math.cos(angle - arrowAngle);
  const ay1 = y2 - arrowSize * Math.sin(angle - arrowAngle);
  const ax2 = x2 - arrowSize * Math.cos(angle + arrowAngle);
  const ay2 = y2 - arrowSize * Math.sin(angle + arrowAngle);

  const arrowPoints = `${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`;

  return { path, arrowPoints };
}

// Node component for rendering a single node with agent type
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
  const getNodeColors = () => {
    switch (node.type) {
      case 'user-prompt':
        return {
          border: 'border-gh-accent/60',
          bg: 'bg-gh-accent/10',
          badge: 'bg-gh-accent/30 text-gh-accent',
        };
      case 'main-agent':
        return {
          border: 'border-purple-500/60',
          bg: 'bg-purple-500/10',
          badge: 'bg-purple-500/30 text-purple-400',
        };
      case 'sub-agent':
        // AMTP v2: True background sub-agents use distinct styling
        if (node.metadata?.backgroundInfo?.detached) {
          return {
            border: 'border-sky-500/60',
            bg: 'bg-sky-500/15',
            badge: 'bg-sky-500/40 text-sky-300',
          };
        }
        return {
          border: 'border-sky-400/60',
          bg: 'bg-sky-400/10',
          badge: 'bg-sky-400/30 text-sky-400',
        };
      case 'tool-call':
        // AMTP v2: Agent-management tool-calls show agent badge styling
        if (node.metadata?.dispatch?.family === 'agent-management') {
          return {
            border: 'border-indigo-400/60',
            bg: 'bg-indigo-400/10',
            badge: 'bg-indigo-400/30 text-indigo-400',
          };
        }
        return {
          border: 'border-gh-muted/50',
          bg: 'bg-gh-surface/50',
          badge: 'bg-gh-muted/30 text-gh-muted',
        };
      case 'detached-shell':
        // AMTP v2: New node type for detached shell execution
        return {
          border: 'border-amber-500/60',
          bg: 'bg-amber-500/10',
          badge: 'bg-amber-500/30 text-amber-400',
        };
      case 'result':
        return {
          border: 'border-gh-active/60',
          bg: 'bg-gh-active/10',
          badge: 'bg-gh-active/30 text-gh-active',
        };
      default:
        return {
          border: 'border-gh-border',
          bg: 'bg-gh-surface/30',
          badge: 'bg-gh-muted/30 text-gh-muted',
        };
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
    return <span className={`w-1.5 h-1.5 rounded-full ${colors[node.status]}`} />;
  };

  const colors = getNodeColors();
  const displayAgentType = node.agentType || extractAgentType(node);
  
  // Determine if this is a main agent (orchestrator) vs sub-agent
  const isOrchestrator = node.type === 'main-agent' || node.isMainAgent;
  
  // Model badge display - show if inferred
  const modelSource = node.metadata?.model?.source;
  const displayModel = node.model;
  
  // AMTP v2: Determine display label based on node type
  const getDisplayLabel = () => {
    if (node.type === 'tool-call' && node.metadata?.dispatch?.family === 'agent-management') {
      // For agent-management tool-calls, show the agent name prominently
      return node.agentName || node.label;
    }
    if (node.type === 'detached-shell') {
      return 'Detached Shell';
    }
    if (node.type === 'sub-agent' && node.metadata?.backgroundInfo?.detached) {
      return node.label || 'Background Task';
    }
    return node.label;
  };
  
  // AMTP v2: Get badge text based on node type
  const getBadgeText = () => {
    // Tool-call nodes (including agent-management) show 'tool call' badge
    if (node.type === 'tool-call') {
      return 'tool call';
    }
    if (node.type === 'detached-shell') {
      return 'detached shell';
    }
    if (node.type === 'sub-agent' && node.metadata?.backgroundInfo?.detached) {
      return 'background task';
    }
    return node.type === 'main-agent' ? 'orchestrator' : node.type.replace('-', ' ');
  };

  return (
    <div
      onClick={onClick}
      className={`absolute cursor-pointer rounded-xl border-2 p-3 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
        isSelected ? 'ring-2 ring-gh-accent shadow-lg' : ''
      } ${colors.border} ${colors.bg}`}
      style={{
        left: position.x,
        top: position.y,
        width: position.width,
        height: position.height,
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header with type badge and status */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className={`text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${colors.badge}`}>
            {getBadgeText()}
          </span>
          {getStatusDot()}
        </div>
        
        {/* Title */}
        <p className="text-xs font-semibold text-gh-text truncate" title={getDisplayLabel()}>
          {getDisplayLabel()}
        </p>
        
        {/* Agent Type - displayed prominently below the label (only for true agents) */}
        {displayAgentType && node.type !== 'tool-call' && (
          <span className={`inline-flex items-center text-[9px] mt-1 ${isOrchestrator ? 'text-purple-400 font-medium' : 'text-sky-400'}`}>
            {isOrchestrator ? '● ' : '○ '}
            {displayAgentType}
          </span>
        )}
        
        {/* Model badge when available */}
        {displayModel && (
          <span className={`inline-flex items-center text-[8px] mt-0.5 ${modelSource === 'inferred' ? 'text-gh-muted/60 italic' : 'text-gh-muted'}`}>
            {modelSource === 'inferred' && '~ '}
            {displayModel}
          </span>
        )}
        
        {/* Description - shown for all node types */}
        {node.description && (
          <p className="text-[9px] text-gh-muted/70 line-clamp-2 mt-1 leading-tight">
            {node.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Canvas container for the diagram
function WorkflowCanvas({
  rounds,
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
}: {
  rounds: WorkflowRound[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const positions = useMemo(() => calculateMultiTurnPositions(rounds, nodes), [rounds, nodes]);

  // Calculate canvas bounds
  const canvasBounds = useMemo(() => {
    if (positions.size === 0) return { width: 800, height: 600 };
    let maxX = 0;
    let maxY = 0;
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    }
    return { width: Math.max(maxX + 100, 800), height: Math.max(maxY + 100, 600) };
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

  // Calculate edges with curved bezier paths
  const edgeElements = useMemo(() => {
    return edges.map((edge) => {
      const fromPos = positions.get(edge.from);
      const toPos = positions.get(edge.to);
      if (!fromPos || !toPos) return null;

      const result = generateEdgePath(fromPos, toPos);
      if (!result) return null;

      return {
        id: edge.id,
        path: result.path,
        arrowPoints: result.arrowPoints,
      };
    }).filter(Boolean);
  }, [edges, positions]);

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
          {edgeElements.map((edge) => edge && (
            <g key={edge.id}>
              <path
                d={edge.path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gh-border"
              />
              <polygon
                points={edge.arrowPoints}
                fill="currentColor"
                className="text-gh-border"
              />
            </g>
          ))}
        </svg>

        {/* Nodes layer */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          return (
            <WorkflowNodeCard
              key={node.id}
              node={node}
              position={pos}
              isSelected={selectedNodeId === node.id}
              onClick={() => onNodeSelect(selectedNodeId === node.id ? null : node.id)}
            />
          );
        })}
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

      {/* Legend - AMTP v2: Updated with refined taxonomy */}
      <div className="absolute top-4 left-4 rounded-lg border border-gh-border bg-gh-surface/90 px-3 py-2 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide text-gh-muted mb-2">Legend</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-gh-accent/60 bg-gh-accent/10" />
          <span className="text-xs text-gh-muted">User Prompt</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-purple-500/60 bg-purple-500/10" />
          <span className="text-xs text-gh-muted">Main Agent (orchestrator)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-indigo-400/60 bg-indigo-400/10" />
          <span className="text-xs text-gh-muted">Sub-agent (dispatch)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-sky-400/60 bg-sky-400/10" />
          <span className="text-xs text-gh-muted">Background Task</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-amber-500/60 bg-amber-500/10" />
          <span className="text-xs text-gh-muted">Detached Shell</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-gh-muted/50 bg-gh-surface/50" />
          <span className="text-xs text-gh-muted">Tool Call</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-gh-active/60 bg-gh-active/10" />
          <span className="text-xs text-gh-muted">Result</span>
        </div>
      </div>
    </div>
  );
}

// Node details panel
function NodeDetailsPanel({ node, onClose }: { 
  node: WorkflowNode; 
  onClose: () => void;
}) {
  const displayAgentType = node.agentType || extractAgentType(node);
  const modelSource = node.metadata?.model?.source;
  
  // Show AGENT ID for agent-management tools and true agents
  const shouldShowAgentId = node.type === 'sub-agent' || 
    node.type === 'main-agent' ||
    (node.type === 'tool-call' && 
     (node.metadata?.dispatch?.toolName === 'read_agent' || 
      node.metadata?.dispatch?.toolName === 'task'));
  
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
        
        {/* Label - shown for all node types */}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Label</p>
          <p className="text-sm text-gh-text">{node.label}</p>
        </div>
        
        {/* Show AGENT ID for agent-management tools and true agents */}
        {shouldShowAgentId && displayAgentType && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Agent ID</p>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
              node.type === 'main-agent' 
                ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                : 'border-sky-400/30 bg-sky-400/10 text-sky-400'
            }`}>
              {displayAgentType}
            </span>
          </div>
        )}
        
        {node.model && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Model</p>
            <span className={`inline-flex items-center rounded-full border border-gh-border bg-gh-surface/50 px-2 py-0.5 text-xs ${modelSource === 'inferred' ? 'text-gh-muted/60 italic' : 'text-gh-muted'}`}>
              {modelSource === 'inferred' && 'Inferred: '}
              {node.model}
            </span>
          </div>
        )}
        
        {node.metadata?.dispatch && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Dispatch</p>
            <div className="text-xs text-gh-muted space-y-0.5">
              <p><span className="text-gh-muted/70">Tool:</span> {node.metadata.dispatch.toolName}</p>
              <p><span className="text-gh-muted/70">Family:</span> {node.metadata.dispatch.family}</p>
            </div>
          </div>
        )}
        
        {node.metadata?.backgroundInfo && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gh-muted/70">Background Info</p>
            <div className="text-xs text-gh-muted space-y-0.5">
              <p><span className="text-gh-muted/70">Detached:</span> {node.metadata.backgroundInfo.detached ? 'Yes' : 'No'}</p>
              {node.metadata.backgroundInfo.processId && (
                <p><span className="text-gh-muted/70">Process ID:</span> {node.metadata.backgroundInfo.processId}</p>
              )}
            </div>
          </div>
        )}
        
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

// Canonical ordering for agent types
const AGENT_TYPE_ORDER = ['coder', 'explorer', 'planner', 'reviewer', 'tester', 'writer', 'orchestrator'];

// Filter control component — receives dynamically derived option lists from the graph data
function FilterControl({
  filter,
  onChange,
  nodeCounts,
  availableAgentTypes,
  availableTools,
}: {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  nodeCounts: { all: number; agentsOnly: number; toolsOnly: number };
  availableAgentTypes: string[];
  availableTools: string[];
}) {
  const toggleAgentType = (agentType: string) => {
    const newTypes = filter.agentTypes.includes(agentType)
      ? filter.agentTypes.filter(t => t !== agentType)
      : [...filter.agentTypes, agentType];
    onChange({ ...filter, agentTypes: newTypes });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Node type filter */}
      <div className="flex items-center gap-1 rounded-lg border border-gh-border bg-gh-bg p-0.5">
        <button
          onClick={() => onChange({ ...filter, nodeType: 'all' })}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            filter.nodeType === 'all'
              ? 'bg-gh-accent text-white'
              : 'text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'
          }`}
          title="All nodes"
        >
          All ({nodeCounts.all})
        </button>
        <button
          onClick={() => onChange({ ...filter, nodeType: 'agents-only' })}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            filter.nodeType === 'agents-only'
              ? 'bg-gh-accent text-white'
              : 'text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'
          }`}
          title="Shows agents-only (hides tool-call)"
        >
          Agents ({nodeCounts.agentsOnly})
        </button>
        <button
          onClick={() => onChange({ ...filter, nodeType: 'tools-only' })}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            filter.nodeType === 'tools-only'
              ? 'bg-gh-accent text-white'
              : 'text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'
          }`}
          title="Shows tools-only (hides sub-agent, detached-shell)"
        >
          Tools ({nodeCounts.toolsOnly})
        </button>
      </div>

      {/* Agent type filter — chips derived dynamically from graph data */}
      {availableAgentTypes.length > 0 && (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gh-muted mr-1">Agent Type:</span>
        {availableAgentTypes.map(agentType => (
          <button
            key={agentType}
            onClick={() => toggleAgentType(agentType)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors border ${
              filter.agentTypes.includes(agentType)
                ? 'bg-sky-400/20 border-sky-400/50 text-sky-400'
                : 'bg-gh-bg border-gh-border text-gh-muted hover:text-gh-text'
            }`}
            title={`Filter by ${agentType}`}
          >
            {agentType}
          </button>
        ))}
        {filter.agentTypes.length > 0 && (
          <button
            onClick={() => onChange({ ...filter, agentTypes: [] })}
            className="text-[10px] text-gh-muted hover:text-gh-attention ml-1"
            title="Clear agent type filter"
          >
            Clear
          </button>
        )}
      </div>
      )}

      {/* Tool filter — dropdown showing tool names for the current turn */}
      {availableTools.length > 0 && (
        <MultiSelectDropdown
          label="Tool"
          options={availableTools}
          selected={filter.tools}
          onChange={(tools) => onChange({ ...filter, tools })}
          placeholder="All tools"
        />
      )}
    </div>
  );
}

// Main workflow topology view
export function WorkflowTopologyView({ 
  messages, 
  activeSubAgents = [], // Destructure this
  isFullScreen = false, 
  onToggleFullScreen 
}: Props) {
  const turnOptions = useMemo(() => buildTurnOptions(messages), [messages]);
  const [selectedTurnId, setSelectedTurnId] = useState<string>(() => 
    turnOptions[turnOptions.length - 1]?.turnId ?? ''
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    nodeType: 'all',
    agentTypes: [],
    tools: [],
  });

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

  // Build the raw graph from messages
  const { rounds: rawRounds, nodes: rawNodes, edges: rawEdges } = useMemo(
    () => currentTurn ? buildMultiTurnGraph(currentTurn.messages) : { rounds: [], nodes: [], edges: [] },
    [currentTurn]
  );

  // Enrich dispatch tool-call nodes with server-side worker data from activeSubAgents.
  // Dispatch nodes (task/read_agent) start as type 'tool-call'. When matching server
  // data exists (model, lifecycle, status), the node is upgraded to type 'sub-agent'.
  // This implements the RFC's dispatch-vs-worker separation while keeping one node per agent.
  const { rounds: enrichedRounds, nodes: enrichedNodes, edges: enrichedEdges } = useMemo(() => {
    // Index activeSubAgents by toolCallId for O(1) lookup
    const agentByToolCallId = new Map(activeSubAgents.map(a => [a.toolCallId, a]));
    
    // Upgrade matching dispatch nodes in-place
    const updatedNodes = rawNodes.map(node => {
      if (!node.metadata?.toolCallId) return node;
      const agent = agentByToolCallId.get(node.metadata.toolCallId);
      if (!agent) return node;
      
      // Upgrade tool-call → sub-agent with server-side worker data
      return {
        ...node,
        type: 'sub-agent' as const,
        label: agent.agentDisplayName || agent.agentName || node.label,
        agentType: agent.agent?.targetName || node.agentType,
        agentName: agent.agentName || node.agentName,
        model: agent.modelInfo?.name || agent.model || node.model,
        description: agent.description || node.description,
        metadata: {
          ...node.metadata,
          dispatch: agent.dispatch || node.metadata.dispatch,
          agent: agent.agent || node.metadata.agent,
          model: agent.modelInfo || node.metadata.model,
          backgroundInfo: {
            detached: !!node.metadata?.backgroundMode,
          },
        },
        status: agent.isCompleted ? 'completed' : (node.status || 'running'),
      } satisfies WorkflowNode;
    });
    
    // Rebuild rounds with upgraded nodes so calculateMultiTurnPositions picks them up
    const nodeById = new Map(updatedNodes.map(n => [n.id, n]));
    const updatedRounds = rawRounds.map(round => ({
      ...round,
      mainAgentNode: nodeById.get(round.mainAgentNode.id) || round.mainAgentNode,
      responseNodes: round.responseNodes.map(n => nodeById.get(n.id) || n),
    }));
    
    return {
      rounds: updatedRounds,
      nodes: updatedNodes,
      edges: [...rawEdges],
    };
  }, [rawNodes, rawEdges, rawRounds, activeSubAgents]);

  // Apply node type filter only
  const { rounds, nodes, edges } = useMemo(
    () => applyNodeFilter(enrichedRounds, enrichedNodes, enrichedEdges, filter),
    [enrichedRounds, enrichedNodes, enrichedEdges, filter]
  );

  // Calculate node counts for filter display
  const nodeCounts = useMemo(() => {
    const allCount = enrichedNodes.length;
    // AMTP v2: agentsOnly includes true background sub-agents and detached-shell (hides tool-call)
    const agentsOnlyCount = enrichedNodes.filter(
      n => n.type === 'user-prompt' || n.type === 'main-agent' || n.type === 'sub-agent' || n.type === 'detached-shell' || n.type === 'result'
    ).length;
    // toolsOnly hides sub-agent and detached-shell
    const toolsOnlyCount = enrichedNodes.filter(
      n => n.type === 'user-prompt' || n.type === 'main-agent' || n.type === 'tool-call' || n.type === 'result'
    ).length;
    return { all: allCount, agentsOnly: agentsOnlyCount, toolsOnly: toolsOnlyCount };
  }, [enrichedNodes]);

  // Derive available agent types from sub-agent nodes only (background tasks; exclude orchestrator and tools)
  const availableAgentTypes = useMemo(() => {
    const types = new Set<string>();
    enrichedNodes.forEach(n => {
      if (n.type !== 'sub-agent') return; // Only background sub-agents
      const t = n.agentType || extractAgentType(n);
      if (t && t !== 'orchestrator') types.add(t);
    });
    // Preserve canonical ordering; append unknown types alphabetically at the end
    return [
      ...AGENT_TYPE_ORDER.filter(t => types.has(t)),
      ...[...types].filter(t => !AGENT_TYPE_ORDER.includes(t)).sort(),
    ];
  }, [enrichedNodes]);

  // Derive available tool names from tool-call nodes in the current turn (per-turn scope)
  const availableTools = useMemo(() => {
    const tools = new Set<string>();
    enrichedNodes.forEach(n => {
      if (n.type !== 'tool-call') return;
      const toolName = n.metadata?.toolName || n.label;
      if (toolName) tools.add(toolName);
    });
    return [...tools].sort();
  }, [enrichedNodes]);

  // Clear stale filter selections when turn changes and new data lacks those values
  useEffect(() => {
    setFilter(prev => {
      const newAgentTypes = prev.agentTypes.filter(t => availableAgentTypes.includes(t));
      const newTools = prev.tools.filter(t => availableTools.includes(t));
      if (newAgentTypes.length === prev.agentTypes.length && newTools.length === prev.tools.length) {
        return prev;
      }
      return { ...prev, agentTypes: newAgentTypes, tools: newTools };
    });
  }, [availableAgentTypes, availableTools]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
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
              Multi-turn orchestration: User → Main Agent → Sub-Agents → Result
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterControl
              filter={filter}
              onChange={setFilter}
              nodeCounts={nodeCounts}
              availableAgentTypes={availableAgentTypes}
              availableTools={availableTools}
            />
            <div className="w-px h-5 bg-gh-border mx-1" />
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
            {nodes.length} nodes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gh-border" />
            {edges.length} edges
          </span>
          {rounds.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500/60" />
              {rounds.length} round{rounds.length !== 1 ? 's' : ''}
            </span>
          )}
          {(filter.agentTypes.length > 0 || filter.tools.length > 0) && (
            <span className="flex items-center gap-1 text-gh-accent">
              <span className="w-2 h-2 rounded-full bg-gh-accent animate-pulse" />
              Filtered
            </span>
          )}
          {currentTurn && (
            <span className="text-gh-muted/70">
              <RelativeTime timestamp={currentTurn.messages[0]?.timestamp} />
            </span>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <WorkflowCanvas
        rounds={rounds}
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        onNodeSelect={setSelectedNodeId}
      />

      {/* Node details panel */}
      {selectedNode && (
        <NodeDetailsPanel 
          node={selectedNode} 
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
