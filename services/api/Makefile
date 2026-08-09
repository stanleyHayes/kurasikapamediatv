# Go gates for services/api.
#
# Mirrors the TypeScript side: format, vet, lint, then test with a coverage
# floor. `make verify` is what CI runs and what `pnpm verify` calls, so there
# is one definition of "green" rather than two that drift.

GO ?= go
COVER_PROFILE := coverage.out

# The domain floor from AGENTS.md. Applied to the whole module rather than
# per-package: a package-by-package floor lets a thin adapter drag the average
# up while a rule goes untested.
DOMAIN_FLOOR := 95.0

.PHONY: verify fmt vet lint test cover clean

verify: fmt vet lint cover

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

clean:
	rm -f $(COVER_PROFILE)
