.PHONY: help test package-install setup start db-connect db-restore

help:
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make \033[36m<target>\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

test: ## Run unit tests
	docker-compose run --rm node npm run test

package-install: ## Install packages
	docker-compose run --no-deps --rm node npm install

setup: ## Install packages and initialize DB
	[ -f .env ] || cp .env.dist .env
	docker-compose run --no-deps --rm node sh -c "npm install && npm run db:init"

start: ## Start server and DB
	docker-compose up

db-connect: ## Open psql instance inside Docker DB
	docker-compose exec postgres psql -d "postgres://emerald-city-resource-guide:password@localhost:5432/emerald-city-resource-guide"

db-restore: ## Run pg_restore inside Docker DB
	docker-compose exec -T postgres pg_restore --clean -v -U emerald-city-resource-guide -d emerald-city-resource-guide -F c

