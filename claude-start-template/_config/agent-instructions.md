# Agent Instructions

## Sub-Agent Types

### Backend Agent
- **Scope**: API modules, services, controllers, DTOs
- **Validation**: `typecheck && lint && test`
- **Commit Prefix**: `feat(api)`, `fix(api)`, `refactor(api)`

### Frontend Agent
- **Scope**: Pages, components, hooks, stores
- **Validation**: `typecheck && lint`
- **Commit Prefix**: `feat(web)`, `fix(web)`, `refactor(web)`

### Database Agent
- **Scope**: ORM schema, migrations, seed data
- **Validation**: `orm generate && orm migrate`
- **Commit Prefix**: `feat(db)`, `fix(db)`

### DevOps Agent
- **Scope**: Docker, CI/CD, deploy scripts, tooling config
- **Commit Prefix**: `chore(docker)`, `chore(ci)`, `chore(config)`

### Docs Agent
- **Scope**: Markdown documentation, CHANGELOG, plans
- **Commit Prefix**: `docs(*)`

## Agent Rules

1. Always read task details before starting work
2. Never modify files outside your scope without approval
3. Run validation commands after every change
4. Update task tracking on completion
5. Follow code conventions strictly
6. Keep commits atomic and well-described

---

## Parallel Agent Orchestration

### 1. Directory Isolation

Each agent only creates/edits files in its assigned directory:

| Agent Task | Allowed Directory | Forbidden |
|------------|-------------------|-----------|
| [Module A] | `src/module-a/` | Other `src/*/` |
| [Module B] | `src/module-b/` | Other `src/*/` |
| [Page X] | `pages/x/`, `components/x/` | Other page dirs |

### 2. Shared Files

Files that may be edited by multiple agents (root module, navigation config, etc.):

| File | Strategy |
|------|----------|
| Root module | **Last-agent-wins**: Read → Edit. On "File modified since read" error, re-read and retry. |
| Navigation config | Same retry pattern |
| Package exports | Same retry pattern |
| package.json / lock files | **Only orchestrator agent installs packages** |

### 3. Ordering Rules

```
Independent tasks → run in parallel (different directories)
Dependent tasks   → run sequentially (start after blocker completes)
Shared file edits → agent handles with retry
Package install   → orchestrator only
```

### 4. Conflict Resolution Protocol

1. Agent tries to `Edit` a file
2. If "File has been modified since read" error:
   - Re-read the file
   - Re-apply the edit with new content
   - Maximum 3 retries
3. After 3 retries → agent stops and reports to orchestrator

### 5. Orchestrator Responsibilities

**Before launching sub-agents:**
1. Install packages
2. Create directory structure (if needed)
3. Check task dependencies — don't start blocked tasks
4. Direct agents to different directories (specify in prompt)

**After sub-agents complete:**
1. Verify shared files (root module correct?)
2. Run monorepo typecheck
3. Update task tracking
4. Report conflicts (how many, how resolved)
