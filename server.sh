#!/usr/bin/env bash
# Paljenje / gašenje lokalnog pregleda aplikacije.
#
#   ./server.sh start     → podigne server u pozadini (http://127.0.0.1:8088)
#   ./server.sh stop      → ugasi ga
#   ./server.sh restart   → ugasi pa podigne
#   ./server.sh status    → da li radi i koliko su stari podaci
#   ./server.sh log       → zadnjih 20 linija dnevnika
#
# Server je običan proces: ne pali se sam. Umire kada se zatvori OpenCode Mobile
# aplikacija / Ubuntu, ili kada Android-u ponestane memorije i ubije ga.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$DIR/.server.pid"
LOGFILE="$DIR/.server.log"
PORT=8088
URL="http://127.0.0.1:$PORT"

running() {
  [ -f "$PIDFILE" ] || return 1
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null
}

# ubije i proces koji je možda ostao bez pid fajla
kill_strays() {
  pkill -f "node .*dev-server\.mjs" 2>/dev/null || true
}

case "${1:-start}" in
  start)
    if running; then
      echo "Već radi (PID $(cat "$PIDFILE")) → $URL"
      exit 0
    fi
    kill_strays
    cd "$DIR"
    nohup node dev-server.mjs >>"$LOGFILE" 2>&1 &
    echo $! >"$PIDFILE"
    sleep 1.2
    if running; then
      echo "Podignut (PID $(cat "$PIDFILE")) → $URL"
      echo "Otvori taj link u browseru na telefonu."
    else
      echo "Nije uspeo da se podigne. Zadnjih 20 linija dnevnika:"
      tail -20 "$LOGFILE" 2>/dev/null
      rm -f "$PIDFILE"
      exit 1
    fi
    ;;
  stop)
    if running; then
      kill "$(cat "$PIDFILE")" 2>/dev/null
      sleep 0.5
      echo "Ugašen."
    else
      echo "Nije bio pokrenut."
    fi
    kill_strays
    rm -f "$PIDFILE"
    ;;
  restart)
    "$0" stop >/dev/null 2>&1
    exec "$0" start
    ;;
  status)
    if running; then
      echo "RADI — PID $(cat "$PIDFILE") → $URL"
      curl -s -m 4 "$URL/api/health" || echo "(server ne odgovara na /api/health)"
      echo
    else
      echo "NE RADI. Podigni sa: $DIR/server.sh start"
    fi
    ;;
  log)
    tail -20 "$LOGFILE" 2>/dev/null || echo "(nema dnevnika)"
    ;;
  *)
    echo "Upotreba: $0 {start|stop|restart|status|log}"
    exit 1
    ;;
esac
