# Phase 0: Project Setup

## TASK-001: Monorepo + Tooling Init

**Agent**: devops
**Complexity**: S
**Status**: PENDING
**Dependencies**: -

### Description
Initialize the monorepo structure with the chosen package manager and build tool.

### Acceptance Criteria
- [ ] Package manager initialized (pnpm/npm/bun)
- [ ] Workspace configuration set up
- [ ] Build tool configured (Turborepo/Nx/none)
- [ ] Root package.json with workspace scripts

---

## TASK-002: Meta Directories

**Agent**: docs
**Complexity**: S
**Status**: PENDING
**Dependencies**: -

### Description
Create the project management directories for tasks, docs, config, and plans.

### Acceptance Criteria
- [ ] `_tasks/` with task-index.md, phases/, active/
- [ ] `_docs/` with MEMORY.md, CHANGELOG.md
- [ ] `_config/` with workflow.md, conventions.md, tech-stack.md, agent-instructions.md
- [ ] `_plans/` directory created

---

## TASK-003: Claude Code Setup

**Agent**: devops
**Complexity**: M
**Status**: PENDING
**Dependencies**: TASK-001

### Description
Set up .claude/ directory with hooks, commands, and settings.

### Acceptance Criteria
- [ ] protect-files.sh hook working
- [ ] 4 slash commands created (cold-start, git-full, turn-off, local-testing)
- [ ] settings.local.json configured with permissions and hooks

---

## TASK-004: CLAUDE.md Configuration

**Agent**: docs
**Complexity**: M
**Status**: PENDING
**Dependencies**: TASK-002

### Description
Write the master CLAUDE.md with project info, conventions, and references.

### Acceptance Criteria
- [ ] Project description and workspace layout
- [ ] Slash commands documented
- [ ] Code conventions summarized
- [ ] Reference directories table
- [ ] Hooks documented

---

## TASK-005: Docker Dev Environment

**Agent**: devops
**Complexity**: M
**Status**: PENDING
**Dependencies**: TASK-001

### Description
Create Docker Compose configuration for development services.

### Acceptance Criteria
- [ ] docker-compose.yml with required services (DB, cache, etc.)
- [ ] Health checks configured
- [ ] Ports documented
- [ ] Volume mounts for data persistence

---

## TASK-006: Lint, Format, TypeScript Config

**Agent**: devops
**Complexity**: S
**Status**: PENDING
**Dependencies**: TASK-001

### Description
Configure ESLint, Prettier (or Biome), and TypeScript base configuration.

### Acceptance Criteria
- [ ] Linter configured with project rules
- [ ] Formatter configured
- [ ] TypeScript strict mode enabled
- [ ] Shared tsconfig base for monorepo

---

## TASK-007: Git Repo Init + First Commit

**Agent**: devops
**Complexity**: S
**Status**: PENDING
**Dependencies**: TASK-001..006

### Description
Initialize git repository, create .gitignore, and make the first commit.

### Acceptance Criteria
- [ ] .gitignore with common patterns (node_modules, .env, dist, etc.)
- [ ] All Phase 0 files committed
- [ ] Remote repository connected (if applicable)
- [ ] First push successful
