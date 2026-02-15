# Workflow Rules

## Task Workflow

### Pre-Task
1. Read `task-index.md` for project status
2. Read phase file for task details
3. Check all dependencies are COMPLETED
4. Read task-specific context files
5. Update task status to IN_PROGRESS

### During Task
- Follow acceptance criteria strictly
- Run typecheck + lint after changes
- Keep changes focused on the task scope

### Post-Task
1. Verify all acceptance criteria
2. Run validation commands
3. Update `task-index.md` (status + dashboard)
4. Update `CHANGELOG.md`
5. Git commit: `feat(TASK-XXX): title`
6. Check blocked tasks, unblock if ready

## Commit Conventions

```
feat(TASK-XXX): description     # New feature
fix(TASK-XXX): description      # Bug fix
refactor(TASK-XXX): description # Refactoring
docs(TASK-XXX): description     # Documentation
chore(TASK-XXX): description    # Tooling/config
test(TASK-XXX): description     # Tests
```

## Branch Strategy

- `main` - production-ready code
- `develop` - integration branch (optional)
- `feat/TASK-XXX-description` - feature branches

## Validation Commands

```bash
# CUSTOMIZE: Replace with your project's commands
pnpm typecheck          # TypeScript check
pnpm lint               # Linter
pnpm format:check       # Formatter check
pnpm test               # All tests
pnpm build              # Full build
```
