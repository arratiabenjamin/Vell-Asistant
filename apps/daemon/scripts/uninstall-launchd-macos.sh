#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este script es solo para macOS"
  exit 1
fi

LABEL="com.forge.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl disable "gui/$UID/$LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "✅ LaunchAgent desinstalado: $LABEL"
