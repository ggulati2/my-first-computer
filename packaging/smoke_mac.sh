#!/bin/bash
# Starts a built Keybo.app without opening a browser window and checks that it really serves the app.
# Usage: packaging/smoke_mac.sh dist/Keybo.app/Contents/MacOS/Keybo
set -euo pipefail
BINARY="$1"
PORT=8791
HOME_DIR="$(mktemp -d)/app-smoke"
mkdir -p "$HOME_DIR"

export APP_HOME="$HOME_DIR" APP_PORT="$PORT" APP_NO_BROWSER=1 LLM_MODE=off
"$BINARY" &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

ok=""
for _ in $(seq 1 40); do
  if page=$(curl -sf "http://127.0.0.1:$PORT/"); then ok=1; break; fi
  sleep 0.75
done
[ -n "$ok" ] || { echo "Keybo did not answer within 30 seconds."; exit 1; }
echo "$page" | grep -q 'id="screen"' || { echo "The start page does not look like Keybo."; exit 1; }
curl -sfI "http://127.0.0.1:$PORT/" | grep -qi "content-security-policy" || { echo "The protective headers are missing."; exit 1; }
curl -sf "http://127.0.0.1:$PORT/api/settings" | grep -q '"language"' || { echo "/api/settings gave an unexpected answer."; exit 1; }
for file in js/app.js js/i18n-es.js css/style.css; do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/$file" || { echo "$file is missing from the app."; exit 1; }
done
curl -sf "http://127.0.0.1:$PORT/api/content/words?count=5&max_len=4" | grep -q '"items"' || { echo "The built-in content is missing."; exit 1; }
[ -d "$HOME_DIR/data" ] || { echo "The data folder was not created in APP_HOME."; exit 1; }
echo "Smoke test passed for $BINARY"
