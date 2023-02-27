#!/bin/sh
set -eu

# Restore Docker DB with given dump file
docker-compose exec -T postgres pg_restore --clean -v -U emerald-city-resource-guide -d emerald-city-resource-guide -F c < $1