#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este instalador es solo para macOS"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
LABEL="com.forge.daemon"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/$LABEL.plist"

mkdir -p "$PLIST_DIR"

NODE_BIN="${NODE_BIN:-$(command -v node)}"
PNPM_BIN="${PNPM_BIN:-$(command -v pnpm)}"

if [[ -z "$NODE_BIN" || -z "$PNPM_BIN" ]]; then
  echo "No encontré node/pnpm en PATH. Exportá NODE_BIN y PNPM_BIN manualmente."
  exit 1
fi

FORGE_DAEMON_HOST="${FORGE_DAEMON_HOST:-127.0.0.1}"
FORGE_DAEMON_PORT="${FORGE_DAEMON_PORT:-4545}"
FORGE_DAEMON_TOKEN="${FORGE_DAEMON_TOKEN:-}"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>$LABEL</string>

    <key>ProgramArguments</key>
    <array>
      <string>$PNPM_BIN</string>
      <string>--dir</string>
      <string>$ROOT_DIR</string>
      <string>dev:daemon</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>FORGE_DAEMON_HOST</key>
      <string>$FORGE_DAEMON_HOST</string>
      <key>FORGE_DAEMON_PORT</key>
      <string>$FORGE_DAEMON_PORT</string>
      <key>FORGE_DAEMON_TOKEN</key>
      <string>$FORGE_DAEMON_TOKEN</string>
    </dict>

    <key>WorkingDirectory</key>
    <string>$ROOT_DIR</string>

    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$ROOT_DIR/tmp/forge-daemon.launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>$ROOT_DIR/tmp/forge-daemon.launchd.err.log</string>
  </dict>
</plist>
PLIST

mkdir -p "$ROOT_DIR/tmp"

launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST_PATH"
launchctl enable "gui/$UID/$LABEL"
launchctl kickstart -k "gui/$UID/$LABEL"

echo "✅ LaunchAgent instalado: $PLIST_PATH"
echo "   label: $LABEL"
echo "   logs:  $ROOT_DIR/tmp/forge-daemon.launchd.{out,err}.log"
