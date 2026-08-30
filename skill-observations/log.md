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

### Observation 4: Base-path deployments need bare-host smoke checks

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** A separately deployed Next.js Studio was healthy at its configured base path while its bare Vercel project URL showed a platform 404.
**Skill:** New skill candidate: production deployment readiness
**Type:** open-source
**Phase/Area:** Post-deployment smoke testing

**Issue:** Verifying only the canonical nested route proved that the deployment was healthy, but missed the entry URL a user naturally opens from the provider dashboard.

**Suggested improvement:** For every base-path deployment, test the bare project host, the base path without a locale, and the canonical localized route; require intentional redirects for the first two.

**Principle:** A deployment is reachable only when its natural entrypoints lead users to the working application.

2026-08-30 completion checkpoint: no new reusable skill observation; the auth-field request was a bounded application of existing accessible form guidance.

### Observation 5: Navigation audits must validate destination content, not status alone

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** A production news navbar returned HTTP 200 for hard-coded section links while rendering the application's soft-404 page because the production taxonomy was empty.
**Skill:** New skill candidate: production navigation audit
**Type:** open-source
**Phase/Area:** Route verification

**Issue:** Status-only link checks classified soft 404s as healthy and missed locale-specific slugs that resolved in one language but not another.

**Suggested improvement:** For every navigation link, verify the final URL, expected landmark or heading, active-state semantics and localized slug in each supported locale; treat soft-404 content as a broken destination even when transport status is 200.

**Principle:** A navigation endpoint is valid only when it renders the intended destination in every supported locale.

### Observation 6: Dropdowns need open-state content-fit verification

**Status:** OPEN
**Date:** 2026-08-30
**Skill:** frontend-design
**Type:** open-source
**Phase/Area:** Component verification

**Issue:** A compact multi-column dropdown passed structural checks while its longest labels collided; its text-glyph caret and label-only items also lacked a useful information hierarchy.

**Suggested improvement:** Require rendered open-state inspection at target widths, use the longest localized label during review, define a safe minimum item width, and verify icon, title, and description hierarchy when a menu acts as a directory.

**Principle:** A dropdown is a layout state of its own and must be verified while open with its longest real content.
