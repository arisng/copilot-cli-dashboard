import type {
  RawEvent,
  UserMessageData,
  AssistantMessageData,
  ToolExecutionCompleteData,
  ParsedMessage,
  ActiveSubAgent,
  DispatchInfo,
  AgentIdentity,
  ModelInfo,
  StatusInfo,
} from '../sessionTypes.js';

const ABORTED_ERROR = { message: 'Operation aborted by user', code: 'aborted' } as const;

function buildMessagesFromEvents(events: RawEvent[], parentToolCallId?: string, isOpen = true): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  // Pre-build a map of toolCallId → execution result/error scoped to this thread
  const toolResults = new Map<string, ToolExecutionCompleteData>();
  for (const event of events) {
    if (event.type === 'tool.execution_complete') {
      const d = event.data as unknown as ToolExecutionCompleteData & { parentToolCallId?: string };
      if ((d.parentToolCallId ?? undefined) === parentToolCallId) {
        toolResults.set(d.toolCallId, d);
      }
    }
  }

  for (const event of events) {
    const dataParent = (event.data as Record<string, unknown>).parentToolCallId as string | undefined;
    // Only include events that belong to this thread
    if ((dataParent ?? undefined) !== parentToolCallId) continue;

    if (event.type === 'user.message') {
      const data = event.data as unknown as UserMessageData;
      messages.push({
        id: event.id,
        role: 'user',
        content: data.content,
        timestamp: event.timestamp,
        interactionId: data.interactionId,
      });
    } else if (event.type === 'assistant.message') {
      const data = event.data as unknown as AssistantMessageData;
      const toolRequests = data.toolRequests?.map((tr) => {
        const exec = toolResults.get(tr.toolCallId);
        if (exec) return { ...tr, result: exec.result, error: exec.error };
        // Session closed with no completion event → tool was aborted
        if (!isOpen) return { ...tr, error: ABORTED_ERROR };
        return tr;
      });
      messages.push({
        id: event.id,
        role: 'assistant',
        content: data.content,
        reasoning: data.reasoningText,
        toolRequests,
        timestamp: event.timestamp,
        interactionId: data.interactionId,
      });
    } else if (event.type === 'session.task_complete') {
      // Only include task_complete in the root thread
      if (parentToolCallId === undefined) {
        const data = event.data as unknown as { summary: string };
        messages.push({
          id: event.id,
          role: 'task_complete',
          content: data.summary,
          timestamp: event.timestamp,
        });
      }
    }
  }

  return messages;
}

export function buildMessages(events: RawEvent[], isOpen: boolean): ParsedMessage[] {
  return buildMessagesFromEvents(events, undefined, isOpen);
}

export function buildSubAgentMessages(events: RawEvent[], agents: ActiveSubAgent[], isOpen: boolean): Record<string, ParsedMessage[]> {
  const result: Record<string, ParsedMessage[]> = {};

  // Build a lookup of read_agent completions for synthesizing messages
  const readAgentResults = new Map<string, { content: string; id: string; timestamp: string }>();
  for (const event of events) {
    if (event.type === 'tool.execution_complete') {
      const d = event.data as Record<string, unknown>;
      if (!d.parentToolCallId && d.toolCallId) {
        const res = d.result as { content?: string } | undefined;
        readAgentResults.set(d.toolCallId as string, {
          content: res?.content ?? '',
          id: event.id,
          timestamp: event.timestamp,
        });
      }
    }
  }

  for (const agent of agents) {
    if (agent.agentName === 'read_agent') {
      // read_agent sub-agents have no parentToolCallId events — synthesize from tool result
      const res = readAgentResults.get(agent.toolCallId);
      result[agent.toolCallId] = res
        ? [{ id: res.id, role: 'assistant', content: res.content, timestamp: res.timestamp }]
        : [];
    } else {
      // task-based sub-agents: filter events by parentToolCallId
      result[agent.toolCallId] = buildMessagesFromEvents(events, agent.toolCallId, isOpen);
    }
  }
  return result;
}

// ============================================================================
// Normalized Sub-Agent Taxonomy Helpers (AMTP Plan - Animal Phase)
// ============================================================================

function classifyToolFamily(toolName: string): DispatchInfo['family'] {
  if (toolName === 'task' || toolName === 'read_agent') return 'agent-management';
  if (toolName === 'task_complete') return 'orchestration';
  return 'tool';
}

function classifyAgentTarget(agentName: string): { targetName: string; targetKind: AgentIdentity['targetKind'] } {
  const builtIns = ['explore', 'general-purpose', 'code-review', 'coder', 'writer'];
  if (builtIns.includes(agentName)) return { targetName: agentName, targetKind: 'built-in' };
  if (agentName) return { targetName: agentName, targetKind: 'custom' };
  return { targetName: 'unknown', targetKind: 'unknown' };
}

function inferModelSource(model: string | undefined, args: Record<string, unknown>): ModelInfo {
  if (!model) return { name: null, source: null };
  if (args?.model) return { name: model, source: 'dispatch-override' };
  return { name: model, source: 'inferred' };
}

function buildStatusInfo(
  isCompleted: boolean,
  isIdle: boolean,
  hasError: boolean,
  sourceEvent: string,
  family: DispatchInfo['family']
): StatusInfo {
  const scope = family === 'orchestration' ? 'session' : family === 'agent-management' ? 'worker' : 'dispatch';

  let kind: StatusInfo['kind'];
  if (hasError) {
    kind = 'error';
  } else if (isCompleted) {
    kind = 'completed';
  } else if (isIdle) {
    kind = 'idle';
  } else {
    kind = 'running';
  }

  return { scope, kind, sourceEvent };
}

export function buildActiveSubAgents(events: RawEvent[]): ActiveSubAgent[] {
  const started = new Map<string, {
    agentName: string;
    agentDisplayName: string;
    sessionId?: string;
    lastActivityAt: string;
    dispatchArgs?: Record<string, unknown>;
    toolName: string;
  }>();
  const completed = new Set<string>();
  const errors = new Set<string>();
  const idle = new Set<string>();
  const descriptions = new Map<string, string>();
  const models = new Map<string, string>();

  const readAgentIds = new Set<string>();
  const taskToolIds = new Set<string>();
  const agentIdToToolCallId = new Map<string, string>();
  const subagentsByType = new Map<string, string[]>();
  const pendingIdleNotifications: Array<{ agentId?: string; agentType: string; description?: string; timestamp: string }> = [];

  // First pass: collect all subagent.started events
  for (const event of events) {
    if (event.type === 'subagent.started') {
      const d = event.data as {
        toolCallId: string;
        agentName: string;
        agentDisplayName: string;
        agentDescription?: string;
        sessionId?: string;
        model?: string;
      };
      const agentType = d.agentName;
      if (!subagentsByType.has(agentType)) {
        subagentsByType.set(agentType, []);
      }
      subagentsByType.get(agentType)!.push(d.toolCallId);

      let agentDisplayName = d.agentDisplayName;
      let dispatchArgs: Record<string, unknown> | undefined;
      let toolName = 'task';

      for (const [agentId, mappedToolCallId] of agentIdToToolCallId.entries()) {
        if (mappedToolCallId === d.toolCallId) {
          agentDisplayName = agentId;
          const existing = started.get(d.toolCallId);
          if (existing) {
            dispatchArgs = existing.dispatchArgs;
            toolName = existing.toolName;
          }
          break;
        }
      }

      started.set(d.toolCallId, {
        agentName: d.agentName,
        agentDisplayName,
        sessionId: d.sessionId,
        lastActivityAt: event.timestamp,
        dispatchArgs,
        toolName,
      });

      if (d.model) {
        models.set(d.toolCallId, d.model);
      }
      if (d.agentDescription && !descriptions.has(d.toolCallId)) {
        descriptions.set(d.toolCallId, d.agentDescription);
      }
    }
  }

  for (const event of events) {
    const isSubEvent = !!(event.data as Record<string, unknown>).parentToolCallId;
    if (isSubEvent) continue;

    if (event.type === 'assistant.message') {
      const data = event.data as unknown as AssistantMessageData;
      for (const tr of data.toolRequests ?? []) {
        const family = classifyToolFamily(tr.name);

        if (family === 'orchestration') {
          continue;
        }

        if (family === 'agent-management') {
          const args = tr.arguments as { name?: string; description?: string; model?: string };
          if (args.description) descriptions.set(tr.toolCallId, args.description);

          if (args.name) {
            taskToolIds.add(tr.toolCallId);
            agentIdToToolCallId.set(args.name, tr.toolCallId);

            if (!started.has(tr.toolCallId)) {
              started.set(tr.toolCallId, {
                agentName: tr.name,
                agentDisplayName: args.name,
                lastActivityAt: event.timestamp,
                dispatchArgs: tr.arguments,
                toolName: tr.name,
              });
              if (args.model) {
                models.set(tr.toolCallId, args.model);
              }
            }
          }
        }
      }
    } else if (event.type === 'subagent.completed') {
      const d = event.data as { toolCallId: string };
      completed.add(d.toolCallId);
      const agent = started.get(d.toolCallId);
      if (agent) {
        agent.lastActivityAt = event.timestamp;
      }
    } else if (event.type === 'subagent.failed') {
      const d = event.data as { toolCallId: string };
      completed.add(d.toolCallId);
      errors.add(d.toolCallId);
      const agent = started.get(d.toolCallId);
      if (agent) {
        agent.lastActivityAt = event.timestamp;
      }
    } else if (event.type === 'system.notification') {
      const d = event.data as {
        content?: string;
        kind?: { type?: string; agentId?: string; agentType?: string; description?: string };
        timestamp?: string;
      };
      if (d.kind?.type === 'agent_idle') {
        let toolCallId: string | undefined;

        if (d.kind.agentId) {
          toolCallId = agentIdToToolCallId.get(d.kind.agentId);
        }

        if (!toolCallId && d.kind.description) {
          for (const [tcId, desc] of descriptions.entries()) {
            if (desc === d.kind.description) {
              toolCallId = tcId;
              break;
            }
          }
        }

        if (!toolCallId && d.content) {
          const match = d.content.match(/Agent "([^"]+)"/);
          if (match) {
            const extractedAgentId = match[1];
            toolCallId = agentIdToToolCallId.get(extractedAgentId);
          }
        }

        if (toolCallId) {
          idle.add(toolCallId);
          const agent = started.get(toolCallId);
          if (agent) {
            agent.lastActivityAt = event.timestamp;
          }
        } else if (d.kind.agentType) {
          pendingIdleNotifications.push({
            agentId: d.kind.agentId,
            agentType: d.kind.agentType,
            description: d.kind.description,
            timestamp: (event as RawEvent).timestamp,
          });
        }
      }
    } else if (event.type === 'tool.execution_start') {
      const d = event.data as {
        toolCallId: string;
        toolName: string;
        arguments: Record<string, unknown>;
        model?: string;
      };
      if (d.toolName === 'read_agent') {
        const agentId = d.arguments?.agent_id as string | undefined;
        readAgentIds.add(d.toolCallId);
        started.set(d.toolCallId, {
          agentName: 'read_agent',
          agentDisplayName: agentId ?? 'Read Agent',
          lastActivityAt: event.timestamp,
          dispatchArgs: d.arguments,
          toolName: d.toolName,
        });
        if (agentId) descriptions.set(d.toolCallId, agentId);
        if (d.model) {
          models.set(d.toolCallId, d.model);
        }
      }
    } else if (event.type === 'tool.execution_complete') {
      const d = event.data as { toolCallId: string };
      if (readAgentIds.has(d.toolCallId) || taskToolIds.has(d.toolCallId)) {
        completed.add(d.toolCallId);
        const agent = started.get(d.toolCallId);
        if (agent) {
          agent.lastActivityAt = event.timestamp;
        }
      }
    }
  }

  // Pragmatic fallback for agent_idle notifications
  for (const idleNotification of pendingIdleNotifications) {
    const candidates = subagentsByType.get(idleNotification.agentType) ?? [];
    const hasRunningCandidate = candidates.some(tcId => started.has(tcId) && !completed.has(tcId));

    if (!hasRunningCandidate && idleNotification.agentType) {
      const rawName = idleNotification.agentId ?? idleNotification.description ?? `${idleNotification.agentType} agent`;
      const agentDisplayName = rawName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const syntheticToolCallId = `synthetic-${rawName}-${idleNotification.timestamp}`;
      started.set(syntheticToolCallId, {
        agentName: idleNotification.agentType,
        agentDisplayName,
        lastActivityAt: idleNotification.timestamp,
        toolName: 'task',
      });
      if (idleNotification.description) {
        descriptions.set(syntheticToolCallId, idleNotification.description);
      }
      idle.add(syntheticToolCallId);
    }
  }

  const toolCallIdToAgentId = new Map<string, string>();
  for (const [agentId, tcId] of agentIdToToolCallId.entries()) {
    toolCallIdToAgentId.set(tcId, agentId);
  }
  for (const tcId of readAgentIds) {
    const agentId = descriptions.get(tcId);
    if (agentId) {
      toolCallIdToAgentId.set(tcId, agentId);
    }
  }

  const agents: ActiveSubAgent[] = [...started.entries()].map(([toolCallId, {
    agentName,
    agentDisplayName,
    sessionId,
    lastActivityAt,
    dispatchArgs,
    toolName,
  }]) => {
    const agentId = toolCallIdToAgentId.get(toolCallId) ?? agentDisplayName;
    const isCompleted = completed.has(toolCallId);
    const hasError = errors.has(toolCallId);
    const isIdleState = idle.has(toolCallId);
    const model = models.get(toolCallId);

    const family = classifyToolFamily(toolName);
    const { targetName, targetKind } = classifyAgentTarget(agentName === 'read_agent' ? 'read_agent' : agentName);
    const modelInfo = inferModelSource(model, dispatchArgs ?? {});

    let sourceEvent = 'subagent.started';
    if (hasError) sourceEvent = 'subagent.failed';
    else if (isCompleted) sourceEvent = completed.has(toolCallId) ? 'tool.execution_complete' : 'subagent.completed';
    else if (isIdleState) sourceEvent = 'system.notification';

    const status = buildStatusInfo(isCompleted, isIdleState, hasError, sourceEvent, family);

    return {
      toolCallId,
      agentId,
      agentName,
      agentDisplayName,
      description: descriptions.get(toolCallId),
      isCompleted,
      sessionId,
      lastActivityAt,
      model,
      dispatch: {
        toolName,
        family,
        toolCallId,
      },
      agent: {
        targetName,
        targetKind,
        instanceId: agentId,
      },
      modelInfo,
      status,
    };
  });

  const agentMap = new Map<string, ActiveSubAgent>();
  for (const agent of agents) {
    const existing = agentMap.get(agent.agentId);
    if (!existing) {
      agentMap.set(agent.agentId, agent);
    } else {
      if (!agent.isCompleted && existing.isCompleted) {
        agentMap.set(agent.agentId, agent);
      }
    }
  }

  return [...agentMap.values()];
}
