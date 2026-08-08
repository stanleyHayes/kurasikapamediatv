# AGENTS.md — Kurasikapa Media TV

Operating rules for any AI agent or engineer working in this repository.
Mandated by the Neurodyne AI-Native Operations Manual (§ AI Governance).

---

## 1. Read before you write

1. [docs/03-architecture.md](docs/03-architecture.md) — the hexagon and its boundaries.
2. [docs/05-ports.md](docs/05-ports.md) — every port you may depend on.
3. [docs/07-quality-gates.md](docs/07-quality-gates.md) — what will fail your build.

## 2. The dependency rule

Dependencies point **inward**. This is enforced by `pnpm boundaries` in CI.

```
apps/web/app  ──▶ application ──▶ domain
adapter-*     ──▶ application ──▶ domain
domain        ──▶ (nothing)
```

- `packages/domain` imports nothing. No `mongodb`, no `next`, no `zod`, no `date-fns`. Nothing.
- `packages/application` imports `domain` only. Never a driver, framework or SDK.
- Route handlers and Server Actions import **use cases**, never adapters.
- `apps/web/src/composition/` is the only directory allowed to import `adapter-*`.

If you need an adapter inside a route, you have found a missing use case. Write the use case.

## 3. Size limits

| Rule | Limit |
|---|---|
| Lines per file | 250 |
| Lines per function | 50 |
| Cyclomatic complexity | 10 |
| Parameters | 4 |
| Nesting depth | 3 |

One use case per file. One entity per file. One adapter per file. A file at 240 lines is a warning sign, not an achievement.

## 4. Testing

- Domain and application code is written **test-first**.
- Use hand-written fakes from `packages/application/src/testing/`. Do **not** use `vi.mock`.
- Adapter tests run against real MongoDB via Testcontainers, never a mocked driver.
- Coverage floors: domain 95%, application 90%, adapters 80%, web 80%, new code 80%.

## 5. Determinism

No `new Date()`, `Date.now()`, `Math.random()` or `crypto.randomUUID()` below the composition root.
Use `ClockPort` and `IdPort`. A test that cannot control time is not a test.

## 6. Do not

- Do not put business rules in a route handler, Server Action or React component.
- Do not leak `ObjectId`, `Collection`, `Response`, `Stripe.Event` or any vendor type through a port.
- Do not let one `adapter-*` import another.
- Do not add a dependency without checking its peer ranges. See [ADR-0007](docs/decisions/adr-0007-toolchain-pins.md).
- Do not raise the TypeScript or MongoDB pin without re-checking the peer range that caused it.
- Do not commit a secret. Env vars only; document every key in `.env.example` with a fake value.
- Do not modify unrelated code. Scope your change to its Jira issue.
- Do not persist or publish AI output without an editor approving it.

## 7. Jira and Git

Per the Training Manual:

```
Branch   feature/KUR-123-short-name
Commit   KUR-123 implement scheduled publication
PR       KUR-123 Scheduled publication
```

Every story carries: user story · business value · acceptance criteria · technical notes · definition of done · estimate · dependencies.

## 8. Definition of Done

- [ ] Behind a port, in a file under 250 lines
- [ ] Tests at the floor for that layer, passing
- [ ] `pnpm lint typecheck boundaries test dup` green
- [ ] PR approved and merged
- [ ] Jira and dashboard updated
- [ ] Docs updated if architecture, ports or the data model changed

## 9. When unsure

Ask. A wrong assumption about the editorial workflow or the permission model costs more than a question does.
