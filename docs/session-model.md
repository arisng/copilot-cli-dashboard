# Session Data Model

Sessions are stored as newline-delimited JSON in `~/.copilot/session-state/<uuid>/events.jsonl`.

## Directory Structure

```
~/.copilot/session-state/
└── <session-uuid>/
    ├── events.jsonl        # append-only event log
    └── inuse.<pid>.lock    # present only while the process is running
```

## Key Event Types

| Event | When emitted |
|-------|-------------|
| `session.start` | Session initialised |
| `session.shutdown` | Session ended cleanly |
| `session.task_complete` | Agent completed a task |
| `session.model_change` | Model switched mid-session |
| `user.message` | User sent a message |
| `assistant.message` | Agent replied (may include `toolRequests[]`) |
| `assistant.turn_start` | Agent started processing |
| `assistant.turn_end` | Agent finished processing |
| `tool.execution_start` | Tool call started |
| `tool.execution_complete` | Tool call finished (has `result` or `error`) |
| `abort` | User cancelled the current operation |

## `ask_user` Tool Schemas

Two argument formats exist in the wild:

**Old format:**
```json
{ "question": "...", "choices": ["A", "B"], "allow_freeform": true }
```

**New format:**
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

Result content is prefixed: `"User selected: <choice>"` or `"User responded: <answer>"` or `"User cancelled the request."`.
