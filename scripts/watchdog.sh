#!/usr/bin/env bash
# Production watchdog — run every minute from crontab on the deploy host:
#   * * * * * bash ~/ascend-lms/scripts/watchdog.sh >> ~/watchdog.log 2>&1
#
# Also started on container boot by supervisord (see [program:ascend-pm2] in
# /etc/supervisor/conf.d/supervisord.conf), because the container entrypoint
# doesn't start pm2 — a container restart on 2026-11-19 left the site on 502.
#
# Probes /api/health on the local Next.js server. After 2 consecutive failures it
# restarts (or re-creates) the pm2 process, so a crash, hang or container restart
# heals itself within ~2 minutes instead of serving 502s until someone notices.
# A 503 from /api/health means the app is up but the DB is down — restarting won't
# help, so that is logged but doesn't trigger a restart.

set -u
APP_DIR="$HOME/ascend-lms"
PM2_NAME="npm"
PORT="${PORT:-3000}"
STATE="$HOME/.ascend-watchdog-fails"

# cron has a minimal PATH; pick up nvm's node/pm2 if present.
for d in "$HOME"/.nvm/versions/node/*/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done
export PATH

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "http://127.0.0.1:${PORT}/api/health" || true)
code=${code:-000}

# Anything that is an HTTP answer below 500 means the server is alive (a 404 just
# means /api/health isn't deployed yet). Only no answer (000) or 5xx counts as down.
if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
  rm -f "$STATE"
  exit 0
fi

if [ "$code" = "503" ]; then
  echo "$(ts) health=503 (database unreachable) — not restarting"
  exit 0
fi

fails=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE"
echo "$(ts) health=$code consecutive_failures=$fails"
[ "$fails" -lt 2 ] && exit 0

# Don't fight a deploy that is mid-build (.next is being rewritten).
if pgrep -f "next build" > /dev/null; then
  echo "$(ts) build in progress — skipping restart"
  exit 0
fi

df -h "$APP_DIR" | tail -1 | awk -v t="$(ts)" '{print t" disk "$5" used ("$4" free)"}'
free -m 2>/dev/null | awk -v t="$(ts)" '/Mem:/{print t" mem used="$3"MB free="$4"MB"}'

if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  echo "$(ts) restarting pm2 process '$PM2_NAME'"
  pm2 restart "$PM2_NAME" --update-env
else
  echo "$(ts) pm2 process '$PM2_NAME' missing — resurrecting / starting"
  pm2 resurrect || (cd "$APP_DIR" && pm2 start npm --name "$PM2_NAME" -- start)
  pm2 save
fi
rm -f "$STATE"
