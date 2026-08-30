# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill
updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue —
resolved statuses always carry their resolution date

---

2026-08-13 checkpoint: no reusable skill observations after the first three completed implementation phases.

## 2026-08-14

### Observation 1: Visual redesigns require rendered-route acceptance

**Status:** OPEN
**Date:** 2026-08-14
**Session context:** A repository-wide interface redesign passed static quality gates but shipped visibly broken mobile form sizing and an unacceptable footer.
**Skill:** redesign-existing-projects
**Type:** open-source
**Phase/Area:** Verification and completion criteria

**Issue:** Structural code review, compilation, and token-level styling were treated as sufficient evidence for a visual redesign even though the rendered result had not been inspected across representative routes and viewport sizes.

**Suggested improvement:** Make rendered desktop and mobile screenshots of every major layout family a mandatory completion gate, with explicit checks for form controls, navigation, footer composition, overflow, empty states, and typography.

**Principle:** Visual work is not verified until representative rendered surfaces have been inspected at their real viewport sizes.

2026-08-14 completion checkpoint: Observation 1 captured the reusable workflow correction from this redesign pass.

2026-08-14 completion checkpoint: no new observation; Observation 1 already covers the user correction that every card and detail family must be rendered before a product-wide redesign is accepted.

### Observation 2: Reference products should transfer interaction structure

**Status:** OPEN
**Date:** 2026-08-14
**Session context:** A dashboard redesign improved after the user pointed to two other repositories as examples of stronger admin and empty-state patterns.
**Skill:** redesign-existing-projects
**Type:** open-source
**Phase/Area:** Reference audit and pattern transfer

**Issue:** A bespoke redesign can remain visually coherent but operationally thin when it does not study proven product patterns for navigation grouping, action density, panel-specific states, and actionable empty screens.

**Suggested improvement:** When a user names reference products, inspect their actual shared primitives and shells, extract reusable interaction patterns, and translate those patterns into the target brand instead of copying surface styling.

**Principle:** Learn structure from references, preserve identity in the implementation.

## 2026-08-30

### Observation 3: Validate provider plan limits before provisioning scheduled workloads

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** A multi-service production deployment reached provider validation before discovering that the active hosting plan rejected sub-daily cron schedules.
**Skill:** New skill candidate: production deployment readiness
**Type:** open-source
**Phase/Area:** Preflight and provider capability validation

**Issue:** Repository configuration and local builds can be valid while the selected hosting account rejects a required runtime capability, leaving infrastructure partially provisioned and forcing a late cost-versus-degradation decision.

**Suggested improvement:** Add a preflight that inventories scheduled jobs, required frequencies, runtime versions, monorepo roots, custom domains, and current account plans, then checks each requirement against live provider limits before creating resources.

**Principle:** Deployment readiness includes the capabilities of the active provider plan, not only valid application configuration.
