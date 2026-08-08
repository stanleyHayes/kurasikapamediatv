# 07 — Quality Gates

Every rule here **fails the build**. None of them are warnings. A rule that only warns is a rule that is already broken somewhere.

---

## 1. File and function size

| Rule | Limit | Enforced by |
|---|---|---|
| Lines per file | 250 | `eslint max-lines` |
| Lines per function | 50 | `eslint max-lines-per-function` |
| Cyclomatic complexity | 10 | `eslint complexity` |
| Function parameters | 4 | `eslint max-params` |
| Nesting depth | 3 | `eslint max-depth` |
| Duplicated blocks | 3% | `jscpd` (Sonar-compatible threshold) |

Test files are exempt from `max-lines-per-function` only — a table-driven test is one long function by nature. They are **not** exempt from `max-lines`.

If a file is fighting the 250-line limit, it is doing two jobs. Split it by responsibility, not by line count.

---

## 2. Hexagon boundaries

`dependency-cruiser` encodes the table in [03-architecture.md](03-architecture.md#the-dependency-rule-as-code) as forbidden rules:

- `domain-is-pure` — `packages/domain` may not import anything outside itself.
- `application-knows-no-tech` — `packages/application` may not import `mongodb`, `next`, `@ai-sdk/*`, `stripe`, `@mux/*`, or any `adapter-*`.
- `routes-use-cases-only` — `apps/web/app/**` may not import `adapter-*`.
- `adapters-are-siblings` — no `adapter-*` may import another `adapter-*`.
- `no-circular` — no cycles anywhere.

The one legal exception is `apps/web/src/composition/**`. That is the composition root and it is allowed to know everything.

---

## 3. Testing

### The pyramid, and what belongs where

| Layer | Tool | What it proves | Coverage floor |
|---|---|---|---|
| **Domain** | Vitest | Business rules. No DB, no HTTP, no mocks — entities are pure | **95%** |
| **Application** | Vitest + hand-written fakes | Use-case orchestration and error paths | 90% |
| **Adapters** | Vitest + Testcontainers (real MongoDB) | Mapping, queries, indexes, transactions | 80% |
| **Web** | Vitest + Testing Library | Server Actions, route handlers, components | 80% |
| **E2E** | Playwright | The eight critical journeys below | must pass |
| **Go service** | `go test` table-driven + Testcontainers | Same split, same discipline | 85% |

Overall floor on **new code: 80%**. The domain floor is higher because domain tests are cheap, fast and the only place where a bug is genuinely expensive.

### On mocks

We use hand-written fakes from `packages/application/src/testing/`, not `vi.mock`. Auto-mocking couples a test to the shape of the code instead of its behaviour, and it is the reason large suites stop catching regressions.

Adapter tests run against a **real MongoDB** via Testcontainers. An adapter test against a mocked driver proves nothing — the bugs live in the query, the index and the transaction.

### The eight E2E journeys

1. Reader finds an article via search and reads it (EN then FR).
2. Journalist drafts with AI assist, submits for review.
3. Editor rejects with a note; journalist revises; editor approves; article publishes.
4. Scheduled article goes live at its time, with the homepage cache invalidated.
5. Reader registers with Google, bookmarks, returns and sees the bookmark.
6. Published article fans out to Facebook and Instagram with an AI caption.
7. Reader subscribes to a paid tier and unlocks a premium article.
8. Live stream starts, plays, ends, and the recording appears in the VOD library.

Journeys 6–8 land in R2–R4; their specs are written in R1 and skipped until then, so the gap is visible in CI rather than forgotten.

---

## 4. TDD

Domain and application code is written test-first. Not as ceremony — because a use case whose test you cannot write without a database has the wrong dependencies, and you find that out in ten minutes instead of ten weeks.

Adapters and UI are written test-after. That is fine and deliberate.

---

## 5. Static analysis and CI

```
pnpm lint          eslint + typescript-eslint (type-aware)
pnpm typecheck     tsc --noEmit, strict + noUncheckedIndexedAccess
pnpm boundaries    dependency-cruiser
pnpm test          vitest --coverage
pnpm test:e2e      playwright
pnpm dup           jscpd
pnpm audit         pnpm audit --audit-level=high
go vet ./... && golangci-lint run && go test -race -cover ./...
```

All of it runs on every PR. A PR cannot merge red.

### SonarQube

`sonar-project.properties` is committed and correct, with quality-gate thresholds matching the numbers above. It stays dormant until `SONAR_TOKEN` exists in repo secrets; the CI step is conditional on that secret, so the pipeline is green today and Sonar switches on the day an instance is available.

Local gates are not a placeholder for Sonar — they are the same rules, enforced earlier.

---

## 6. Security gates

- Secret scanning on every commit (Raven pre-commit hook + `gitleaks` in CI).
- `pnpm audit` and `govulncheck` fail on **high** or above.
- No secret in source, ever. Env vars only; `.env.example` documents every key with a fake value.
- Auth.js session cookies: `httpOnly`, `secure`, `sameSite=lax`.
- CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` set in Next.js middleware.
- Every mutating Server Action re-checks authorisation through `AuthorizeAction` in the domain. UI-level role checks are cosmetic and are never the control.
- Rate limiting on auth, comments, search and all AI endpoints.

---

## 7. Definition of Done

Straight from the Training Manual, plus this document:

- [ ] Code implemented behind a port, in a file under 250 lines
- [ ] Tests written and passing at the floor for that layer
- [ ] `pnpm lint typecheck boundaries test dup` all green
- [ ] Hexagon boundaries unviolated
- [ ] PR approved and merged
- [ ] Jira updated, dashboard updated
- [ ] Docs updated if the change touched architecture, ports or the data model
