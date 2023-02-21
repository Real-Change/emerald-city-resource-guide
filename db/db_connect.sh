#!/bin/sh
set -eu

# Open psql instance to Docker PostgreSQL
docker-compose exec postgres psql -d "postgres://emerald-city-resource-guide:password@localhost:5432/emerald-city-resource-guide"

