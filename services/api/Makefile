# Go gates for services/api.
#
# Mirrors the TypeScript side: format, vet, lint, then test with a coverage
# floor. `make verify` is what CI runs and what `pnpm verify` calls, so there
# is one definition of "green" rather than two that drift.

GO ?= go
COVER_PROFILE := coverage.out
APP_PROFILE := coverage-app.out

# Floors from AGENTS.md. Each ring is measured on its own, so a thin adapter
# with trivial coverage cannot drag the average up while a rule goes untested.
DOMAIN_FLOOR := 95.0
APP_FLOOR := 90.0

.PHONY: verify verify-all fmt vet lint test cover cover-app integration clean

## verify is the fast gate: no database required.
verify: fmt vet lint cover cover-app

## verify-all adds the integration suite. This is what CI runs.
verify-all: verify integration

## fmt fails rather than rewrites, so CI cannot silently "fix" a diff.
fmt:
	@unformatted=$$(gofmt -l .); \
	if [ -n "$$unformatted" ]; then \
		echo "gofmt: these files need formatting:"; echo "$$unformatted"; exit 1; \
	fi

vet:
	$(GO) vet ./...

lint:
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not installed — skipping (CI installs it)"; \
	fi

test:
	$(GO) test -race ./...

## cover enforces the floor on the domain ring specifically.
##
## The domain is where the rules live; an untested rule is the expensive kind
## of gap. Adapters and transport are held to a lower bar elsewhere because
## their failures surface loudly, in integration tests and in production logs.
cover:
	$(GO) test -race -coverprofile=$(COVER_PROFILE) ./internal/domain/...
	@total=$$($(GO) tool cover -func=$(COVER_PROFILE) | awk '/^total:/ {gsub(/%/,"",$$3); print $$3}'); \
	echo "domain coverage: $$total% (floor $(DOMAIN_FLOOR)%)"; \
	awk -v t="$$total" -v f="$(DOMAIN_FLOOR)" 'BEGIN { exit !(t+0 >= f+0) }' || \
		{ echo "FAIL: domain coverage $$total% is below the $(DOMAIN_FLOOR)% floor"; exit 1; }

## cover-app holds the application and transport rings to their floor.
##
## internal/http is included: it is where authorisation is enforced at the
## edge, and an untested transport layer is where a guard quietly stops being
## applied. internal/app/testing is excluded — it is the fakes, exercised
## entirely by the tests that use them, and a test double's own coverage
## measures nothing.
cover-app:
	$(GO) test -race -coverprofile=$(APP_PROFILE) \
		$$($(GO) list ./internal/app/... ./internal/http/... | grep -v '/app/testing')
	@total=$$($(GO) tool cover -func=$(APP_PROFILE) | awk '/^total:/ {gsub(/%/,"",$$3); print $$3}'); \
	echo "app coverage: $$total% (floor $(APP_FLOOR)%)"; \
	awk -v t="$$total" -v f="$(APP_FLOOR)" 'BEGIN { exit !(t+0 >= f+0) }' || \
		{ echo "FAIL: app coverage $$total% is below the $(APP_FLOOR)% floor"; exit 1; }

## integration runs the adapter suite against a real MongoDB.
##
## KURA_REQUIRE_MONGO is exported so the harness FAILS rather than skips when
## the URI is missing. Without it a misconfigured CI job reports green having
## run nothing, which is the failure mode this project keeps rediscovering.
integration:
	@if [ -z "$$KURA_TEST_MONGO_URI" ]; then \
		echo "KURA_TEST_MONGO_URI is not set."; \
		echo "Start one with: docker run -d -p 37017:27017 mongo:8 --replSet rs0"; \
		echo "Then: export KURA_TEST_MONGO_URI='mongodb://127.0.0.1:37017/?directConnection=true'"; \
		exit 1; \
	fi
	KURA_REQUIRE_MONGO=1 $(GO) test -race ./internal/adapter/...

clean:
	rm -f $(COVER_PROFILE) $(APP_PROFILE)
