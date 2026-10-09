#!/bin/bash
# SessionStart-Hook: sorgt in Cloud-Sessions dafür, dass Tests und Lint sofort
# laufen. Lokal (eigener Rechner) passiert nichts — dort verwaltet man
# node_modules selbst.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Nur installieren, wenn node_modules fehlt oder package-lock.json neuer ist.
# Das Electron-Binary wird übersprungen: in der Cloud gibt es kein Display, und
# für Vitest/ESLint/Vite-Build wird es nicht gebraucht.
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund
fi
