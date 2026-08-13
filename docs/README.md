# Kurasikapa Media TV — Documentation Index

AI-native publishing platform for a France-registered TV, radio and online media house.

| # | Document | Owner | Gate |
|---|----------|-------|------|
| 01 | [Business Requirements](01-brd.md) | PM | Client approval |
| 02 | [Product Requirements](02-prd.md) | PM | Client approval |
| 03 | [Architecture](03-architecture.md) | Engineering Lead | Eng Lead approval |
| 04 | [Data Model](04-data-model.md) | Engineering Lead | Eng Lead approval |
| 05 | [Port Contracts](05-ports.md) | Engineering Lead | Eng Lead approval |
| 06 | [Release Roadmap](06-roadmap.md) | PM | Client approval |
| 07 | [Quality Gates](07-quality-gates.md) | Engineering Lead | CI enforced |
| 08 | [Decision Records](decisions/) | Engineering Lead | — |

## Operations

- [Deploy the Go API](operations/deploy-api.md) — Render blueprint, `API_URL`
  cut-over, smoke-checks ([scripts/smoke-api.sh](../scripts/smoke-api.sh)),
  and the TS editorial deletion checklist.

## Source inputs

These documents are derived from, and must stay consistent with:

- `Website Discovery & Requirements Questionnaire Kurasikapa Media .docx` — signed 2026-08-06
- `AI_Native_Software_Engineering_Operations_Manual.docx` — the 12-phase SDLC
- `AI_Development_Workflow_Training_Manual.docx` — Jira/GitHub/Dashboard standards
- `stitch_kurasikapa_ai_media_platform.zip` — ~70 designed screens, 4 design systems

## Reading order for a new engineer

1. `AGENTS.md` and `CLAUDE.md` at the repo root — how we work.
2. [03-architecture.md](03-architecture.md) — the hexagon and its boundaries.
3. [05-ports.md](05-ports.md) — every port you are allowed to depend on.
4. [07-quality-gates.md](07-quality-gates.md) — what will fail your build.
