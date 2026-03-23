# Session Data Model Reference

Copilot session state is stored as newline-delimited JSON inside a session-state directory.

## Directory structure

```text
session-state/
└── <session-uuid>/
    ├── events.jsonl        # append-only event log
    └── inuse.<pid>.lock    # present only while the process is running
```

On Linux and WSL this is typically `~/.copilot/session-state/<uuid>/events.jsonl`. On Windows, the dashboard also discovers accessible WSL distributions automatically.

## Key event types

| Event | When emitted |
|-------|-------------|
| `session.start` | Session initialised |
| `session.shutdown` | Session ended cleanly |
| `session.task_complete` | Agent completed a task |
| `session.model_change` | Model switched mid-session |
| `user.message` | User sent a message |
| `assistant.message` | Agent replied and may include `toolRequests[]` |
| `assistant.turn_start` | Agent started processing |
| `assistant.turn_end` | Agent finished processing |
| `tool.execution_start` | Tool call started |
| `tool.execution_complete` | Tool call finished with `result` or `error` |
| `abort` | User cancelled the current operation |

## `ask_user` tool schemas

Two argument formats appear in the session log.

**Old format**

```json
{ "question": "...", "choices": ["A", "B"], "allow_freeform": true }
```

**New format**

```json
{
  "message": "...",
  "requestedSchema": {
    "properties": {
      "fieldName": { "enum": ["A", "B"], "title": "Label", "type": "string" }
    },
    "required": ["fieldName"]
  }
}
```

Result content is prefixed with `User selected: `, `User responded: `, or `User cancelled the request.`.

## Related references

- [Server Architecture Reference](../server/server-architecture.md)
- [Client Architecture Reference](../client/client-architecture.md)

