#!/bin/bash
# Claude Code Project Setup Script
# Usage: ./setup.sh <project-name> <prefix>
# Example: ./setup.sh "My App" myapp
#
# This script:
# 1. Renames _tasks/, _docs/, _config/, _plans/ with your prefix
# 2. Updates all references in CLAUDE.md and slash commands
# 3. Updates CLAUDE.md project name

set -e

PROJECT_NAME="${1:-My Project}"
PREFIX="${2:-project}"

echo "Setting up Claude Code workflow for: $PROJECT_NAME (prefix: $PREFIX)"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Rename meta directories
if [[ -d "$SCRIPT_DIR/_tasks" ]]; then
  mv "$SCRIPT_DIR/_tasks" "$SCRIPT_DIR/${PREFIX}-tasks"
  echo "  _tasks/ → ${PREFIX}-tasks/"
fi

if [[ -d "$SCRIPT_DIR/_docs" ]]; then
  mv "$SCRIPT_DIR/_docs" "$SCRIPT_DIR/${PREFIX}-docs"
  echo "  _docs/ → ${PREFIX}-docs/"
fi

if [[ -d "$SCRIPT_DIR/_config" ]]; then
  mv "$SCRIPT_DIR/_config" "$SCRIPT_DIR/${PREFIX}-config"
  echo "  _config/ → ${PREFIX}-config/"
fi

if [[ -d "$SCRIPT_DIR/_plans" ]]; then
  mv "$SCRIPT_DIR/_plans" "$SCRIPT_DIR/${PREFIX}-plans"
  echo "  _plans/ → ${PREFIX}-plans/"
fi

# Update references in CLAUDE.md
if [[ -f "$SCRIPT_DIR/CLAUDE.md" ]]; then
  sed -i '' "s/\[PROJECT_NAME\]/$PROJECT_NAME/g" "$SCRIPT_DIR/CLAUDE.md"
  sed -i '' "s|_tasks/|${PREFIX}-tasks/|g" "$SCRIPT_DIR/CLAUDE.md"
  sed -i '' "s|_docs/|${PREFIX}-docs/|g" "$SCRIPT_DIR/CLAUDE.md"
  sed -i '' "s|_config/|${PREFIX}-config/|g" "$SCRIPT_DIR/CLAUDE.md"
  sed -i '' "s|_plans/|${PREFIX}-plans/|g" "$SCRIPT_DIR/CLAUDE.md"
  echo "  CLAUDE.md updated"
fi

# Update references in slash commands
for cmd in "$SCRIPT_DIR/.claude/commands/"*.md; do
  if [[ -f "$cmd" ]]; then
    sed -i '' "s|_tasks/|${PREFIX}-tasks/|g" "$cmd"
    sed -i '' "s|_docs/|${PREFIX}-docs/|g" "$cmd"
    sed -i '' "s|_config/|${PREFIX}-config/|g" "$cmd"
    sed -i '' "s|_plans/|${PREFIX}-plans/|g" "$cmd"
  fi
done
echo "  Slash commands updated"

echo ""
echo "Done! Next steps:"
echo "  1. Review and customize CLAUDE.md"
echo "  2. Fill in _config/conventions.md with your project's rules"
echo "  3. Fill in _config/tech-stack.md with your tech choices"
echo "  4. Add project-specific permissions to .claude/settings.local.json"
echo "  5. Plan your phases in ${PREFIX}-tasks/task-index.md"
echo "  6. Start Claude Code and run /cold-start"
echo ""
echo "Optional: Delete setup.sh and BLUEPRINT.md after setup"
