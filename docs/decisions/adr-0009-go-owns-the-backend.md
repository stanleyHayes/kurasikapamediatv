# ADR-0009 — Go owns the backend; Next.js is the frontend

- **Status:** Accepted, 2026-08-09
- **Supersedes:** [ADR-0003](adr-0003-nextjs-go-split.md) in part — the two-hexagon
  split stands, but the boundary moves.

## Context

ADR-0003 split the system at the *slow/scheduled* boundary: Next.js on Vercel
for interactive work, Go on Render for streaming, queues, batch AI and cron.
R1 needed none of the second category, so `services/media-svc` stayed an empty
directory and every line of business logic was written in TypeScript.

The client's stated stack is MongoDB, **Golang**, Next.js, Cloudinary, Resend.
On review they found `apps/web/app/api/` and asked, correctly, why the backend
was not Go. It was not a misunderstanding on their part: nothing in the
repository was Go, and the split ADR-0003 described had never been built.

Sequencing it that way was a mistake of disclosure more than of engineering —
the plan was recorded, but "the Go service does not exist yet" was left in a
status file rather than raised.

## Decision

**All business logic lives in Go.** `services/api` owns the domain, the use
cases, and every outbound adapter — MongoDB, Anthropic, Cloudinary, Resend,
Mux. It exposes an HTTP/JSON API.

**Next.js is the frontend.** It keeps three things and no more:

1. Rendering — every screen, RSC, caching, `'use cache'` and its tags.
2. The browser session — Better Auth owns the cookie, because a session cookie
   must be set by the origin the browser is talking to.
3. A backend-for-frontend seam — Server Components and Server Actions call the
   Go API. They keep their current signatures, so no screen changes.

The hexagon is unchanged in shape; it changes language. Go gets the same four
rings, and the dependency rule is enforced the same way:

```
services/api/internal/domain       zero dependencies
services/api/internal/app          use cases + port interfaces → domain
services/api/internal/adapter/*    mongo, anthropic, cloudinary, resend → app
services/api/cmd/api               composition root → everything
```

### What this costs

`packages/domain` (180 tests) and `packages/application` (178 tests) are
rewritten in Go, together with `adapter-mongo` and `adapter-anthropic`. That is
the real price, and it is paid deliberately.

Two things make it tractable rather than reckless. The ports are already
explicit, so the rewrite is a translation rather than a redesign. And the tests
describe behaviour rather than implementation, so they port as specifications —
`an editor may not publish an article they have not had approved` means the
same thing in either language.

### What is deleted, and when

The TypeScript domain and application packages are **not** deleted while the Go
service is incomplete. Two implementations of the same rules is a liability, so
the migration is per bounded context: a context is cut over only when its Go
use cases pass the ported tests and the web app calls them. `editorial` first,
since it is the whole of R1.

## Consequences

- Authorisation stays in the domain, so it stays wherever the domain is: Go.
  Better Auth still answers *who someone is*; a Go `Actor` decides what they
  may do. Next.js verifies the session and forwards the user id; it never
  decides permissions. That preserves the product rule rather than diluting it.
- The web app's composition root shrinks to an HTTP client and a session read.
  `apps/web/src/composition/` stops constructing Mongo repositories.
- `api/ai/[task]` moves to Go. It only exists in Next because streaming needed
  a route handler; Go streams as well or better.
- `api/auth/[...all]` **stays in Next.js.** Better Auth writes the session
  cookie, and moving it would mean either a second cookie domain or hand-rolled
  session handling. This is the one intentional exception.
- CI gains `go vet`, `golangci-lint` and `go test -race -cover` as first-class
  gates alongside the TypeScript ones.
- One shared MongoDB cluster, two writers during migration. The collections are
  already documented in [04-data-model.md](../04-data-model.md); the Go adapter
  is written against the same documents, not a parallel schema.

## Alternatives rejected

**Keep the ADR-0003 split** (Next owns interactive, Go owns jobs). Least work,
and it is what was already designed — but it leaves the answer to "what is the
backend written in?" as "both", which is not what the client asked for and not
a boundary anyone can hold for long.

**Go owns business logic, Next keeps Server Actions as the write path.** A
reasonable middle, and rejected only because it keeps a second place where
"what may this actor do" could creep back in. One home for the rules is the
point of the hexagon.
