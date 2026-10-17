#!/bin/bash
set -euo pipefail

# Dump the fly.io database to <dir>/YYYY-MM-DDTHHMMSS.pgdump and check that pg_restore can read it.
# Usage: ./db/fly_db_dump.sh [dir]   (default dir: ~/ecrg-backups)
# Keep dumps out of this repository: it is public.

# Dumps through fly proxy because of https://github.com/superfly/flyctl/issues/1442
umask 077

OUT_DIR="${1:-$HOME/ecrg-backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/$(date +%Y-%m-%dT%H%M%S).pgdump"
if [ -e "$FILE" ]; then
  echo "Refusing to overwrite $FILE" >&2
  exit 1
fi

VERIFIED=no
PROXY_PID=
cleanup() {
  if [ -n "$PROXY_PID" ]; then kill "$PROXY_PID" 2>/dev/null || true; fi
  if [ "$VERIFIED" != yes ] && [ -e "$FILE" ]; then
    echo "Removing unverified dump $FILE" >&2
    rm -f "$FILE"
  fi
}
trap cleanup EXIT

# Not 5432, so a local Postgres on that port can't answer in production's place.
PROXY_PORT="${ECRG_PROXY_PORT:-15432}"
fly proxy "$PROXY_PORT:5432" -a emerald-city-resource-guide-db &
PROXY_PID=$!
sleep 5
if ! kill -0 "$PROXY_PID" 2>/dev/null; then
  echo "fly proxy on port $PROXY_PORT did not start" >&2
  exit 1
fi
PG_DBNAME=$(fly ssh console -q -C 'printenv DATABASE_URL' -a emerald-city-resource-guide \
  | tr -d '\r' \
  | sed -E "s/@emerald-city-resource-guide-db\.(internal|flycast)(:5432)?/@localhost:$PROXY_PORT/")
if [[ "$PG_DBNAME" != *"@localhost:$PROXY_PORT"* ]]; then
  echo "DATABASE_URL does not point at emerald-city-resource-guide-db; refusing to dump" >&2
  exit 1
fi

set -o noclobber
docker run --net host --rm postgres:14.2 pg_dump -F c -d "$PG_DBNAME" > "$FILE"

LIST=$(docker run -i --rm postgres:14.2 pg_restore --list < "$FILE")
if ! grep -q "TABLE DATA public organization " <<< "$LIST"; then
  echo "Dump $FILE has no organization table data. Its table of contents:" >&2
  grep -E "^;.*(dbname|Format|Dumped from)|TABLE DATA" <<< "$LIST" >&2 || echo "  (no TABLE DATA entries)" >&2
  exit 1
fi

VERIFIED=yes
echo "Wrote $FILE ($(grep -c "TABLE DATA" <<< "$LIST") tables with data)"
