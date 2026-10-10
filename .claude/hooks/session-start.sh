#!/bin/bash
# SessionStart hook: makes tests and lint work right away in cloud sessions.
# Locally (your own machine) it does nothing — you manage node_modules yourself.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Install only if node_modules is missing or package-lock.json is newer.
# The Electron binary is skipped: cloud sessions have no display, and Vitest,
# ESLint and the Vite build don't need it.
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund
fi
