#!/bin/bash
set -eu

# Generate DB dump of fly.io and write to a file in the format "YYYY-MM-DD.pgdump"

# Workaround for https://github.com/superfly/flyctl/issues/1442
#DATABASE_URL=$(fly ssh console -q -C 'printenv DATABASE_URL' -a emerald-city-resource-guide)
#fly ssh console -q -C "echo $DATABASE_URL" -a emerald-city-resource-guide > $(date +%F).pgdump

fly proxy 5432 -a emerald-city-resource-guide-db &
sleep 5
PG_DBNAME=$(fly ssh console -q -C 'printenv DATABASE_URL' -a emerald-city-resource-guide | sed 's/emerald-city-resource-guide-db.internal/localhost/')
docker run --net host --rm postgres:14.2 pg_dump -F c -d "$PG_DBNAME" > $(date +%F).pgdump

kill %1