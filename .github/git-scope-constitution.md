# Commit Scope Constitution

Last Updated: 2026-03-23

## Purpose

This constitution defines the repository-specific scopes for `copiloting-agents`. It is the authoritative guide for choosing **one** stable scope that describes the primary surface changed by a commit.

> Historical note: the current git history is mostly unscoped. This document establishes the first stable scope set for future commits.

## Repository Surfaces Used to Derive Scopes

- `client/src/api`, `client/src/hooks`, `client/src/components/{mobile,SessionList,SessionDetail,shared}`, `client/src/styles`
- `server/src/{index,router,sessionReader,sessionTypes,utils}`
- `docs/{client,server,session-model}.md` and `README.md`
- `bin/{cli,tunnel-prod}.js`
- `AGENTS.md` and `.github/skills/frontend-skill.md`
- root and workspace config/manifests (`package.json`, `client/package.json`, `server/package.json`, `tsconfig*.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`)

## Scope Naming Conventions

### Format Rules

- **Kebab-case**: use hyphens to separate words (`session-detail`, not `sessionDetail` or `session_detail`)
- **Lowercase only**: all scope names must be lowercase
- **Single scope only**: every commit message must use exactly one scope
- **Stable surfaces, not files**: prefer reusable module/domain names over file names or line references
- **Concise**: aim for 1-3 words per scope
- **Descriptive**: the scope should tell the reader which repository surface changed

### Boundary Rules

- Use the **narrowest stable scope** that matches the change.
- If a commit touches multiple surfaces, choose the one with the **primary behavioral impact**.
- Mention secondary surfaces in the subject line if needed, not as extra scopes.
- Avoid generic labels such as `app`, `code`, `misc`, `other`, or `stuff`.

## Scope Glossary

### Client app scopes

- `client` — cross-cutting React/Vite app changes, route wiring, or layout work that spans multiple client surfaces
- `session-list` — session list/grid/table behavior in `client/src/components/SessionList/`
- `session-detail` — session detail view, message thread, and metadata rendering in `client/src/components/SessionDetail/`
- `mobile` — the `/m` route family and mobile-first session experience in `client/src/components/mobile/`
- `shared` — reusable client components shared across routes, such as layout, relative time, loading, and browse controls
- `api` — client API wrappers and request/response shaping in `client/src/api/`
- `hooks` — polling, selection, and notification hooks in `client/src/hooks/`
- `styles` — global styles, theme tokens, and visual utility work in `client/src/styles/` and related styling config

### Server and session scopes

- `server` — Express entry points, routing, health handling, and server-side request flow
- `session` — session parsing, session-state semantics, event interpretation, and cross-layer session model changes
- `bin` — executable entrypoints and helper scripts in `bin/`

### Documentation and governance scopes

- `docs` — documentation work that does not fit a more specific doc scope
- `readme` — root README and onboarding/usage prose
- `architecture` — system, client, or server architecture documentation
- `session-model` — session-state model, event schema, and lifecycle documentation
- `constitution` — this scope constitution and related governance docs

### Maintenance scopes

- `config` — repository and workspace configuration files such as `tsconfig`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, and `.gitignore`
- `build` — build, start, and publish wiring, including package scripts and build pipeline changes
- `deps` — dependency manifest and lockfile updates (`package.json`, `package-lock.json`, workspace dependency bumps)

### Agent-maintenance scopes

- `instruction` — workspace instruction files such as `AGENTS.md`
- `skill` — `.github/skills/*` guidance files

## Approved Scopes by Commit Type

| Commit type | Approved scopes | Guidance |
| --- | --- | --- |
| `feat`, `fix`, `refactor`, `perf`, `test`, `style` | `client`, `session-list`, `session-detail`, `mobile`, `shared`, `api`, `hooks`, `styles`, `server`, `session`, `bin` | Use the smallest stable surface that best matches the code change. |
| `chore`, `build` | `config`, `build`, `deps` | Use for maintenance, packaging, build wiring, and dependency work. |
| `docs` | `docs`, `readme`, `architecture`, `session-model`, `constitution` | Prefer a topic-specific doc scope when possible. |
| `agent` | `instruction`, `skill` | Use for `AGENTS.md` and `.github/skills/*`. |
| `revert` | same as the reverted change | Keep the original scope from the reverted commit. |

> Legacy local types observed in history: `release` and `update`. They are not the primary approved types in this constitution; prefer the conventional types above and scope them to the affected surface.

## Scope Selection Guidance

1. **Pick exactly one scope.** If the change crosses surfaces, keep one scope and explain the secondary surface in the subject.
2. **Start from the structure.** Match the surface that actually changed: `session-detail` over `client`, `session` over `server` when the work is really about session semantics, and `mobile` for the `/m` experience.
3. **Use `client` only for cross-cutting client work.** Route shells, shared app composition, and broad client changes belong there.
4. **Use `server` only for server concerns.** HTTP handlers, startup, health checks, and server-side parsing belong there.
5. **Use maintenance scopes precisely.**
   - `deps` for manifests and lockfiles
   - `config` for tool and workspace configuration
   - `build` for scripts and build/publish plumbing
6. **Use doc scopes by topic.** Prefer `readme`, `architecture`, `session-model`, or `constitution` before the catch-all `docs`.
7. **Use `instruction` and `skill` only for agent assets.** These are reserved for `AGENTS.md` and `.github/skills/*`.
8. **Propose an amendment when a real surface is missing.** If the repository gains a stable new module or domain, add a scope instead of inventing a one-off file path.

### Quick examples

- `feat(session-detail): render tool call badges in the message thread`
- `fix(server): keep open-session detection aligned with the lock file`
- `chore(deps): bump better-sqlite3 for the server workspace`
- `docs(session-model): clarify the ask_user event schema`
- `agent(skill): tighten the frontend skill guidance`

## Amendment History

### 2026-03-23 - Amendment #1

**Changes:**
- Created the initial constitution.
- Approved repository-specific scopes for client, server, session, mobile, shared, api, hooks, styles, bin, docs, readme, architecture, session-model, constitution, config, build, deps, instruction, and skill.
- Recorded the current history state: mostly unscoped conventional commits, plus legacy `release` and `update` types.

**Rationale:**
The repository has a clear set of stable surfaces in the client app, server API, docs, helper scripts, and agent guidance files. The approved scopes map to those surfaces so future commits stay readable without becoming file-specific.

**Migration Notes:**
- Historical unscoped commits remain unchanged.
- New commits should use the nearest approved scope and avoid file paths or one-off instance names.
