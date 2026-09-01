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

### Observation 7: Navigation refactors need a before-and-after destination inventory

**Status:** OPEN
**Date:** 2026-08-30
**Skill:** frontend-design
**Type:** open-source
**Phase/Area:** Information architecture verification

**Issue:** A navigation redesign improved grouping and presentation but silently omitted a prominent product destination that already existed in the interface vocabulary.

**Suggested improvement:** Before changing navigation arrays, inventory every existing destination and classify each as retained, relocated, intentionally removed, or not yet backed by a route; compare that inventory against the rendered desktop and mobile navigation after implementation.

**Principle:** Better navigation hierarchy must not erase product capabilities by accident.

### Observation 8: Local multi-app reviews need an origin preflight

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** A browser-based local design review initially launched the public app on a framework default port while authentication and Studio handoff were configured for a different port.
**Skill:** browser:control-in-app-browser
**Type:** open-source
**Phase/Area:** Local application setup

**Issue:** Both processes appeared healthy, but the origin mismatch caused auth rejection and made the protected app look broken, wasting visual-review time on states that were not representative.

**Suggested improvement:** Before opening a multi-app system, compare dev commands with configured public URLs, start every app on its declared origin, verify local dependencies, and only then begin screenshots or interaction review.

**Principle:** A visual review is trustworthy only when every local app is running on the same origins its authentication and cross-app links expect.

### Observation 9: Reader metadata must come from approved copy

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** News cards needed excerpts and reading-time estimates while articles could have a newer unapproved revision in progress.
**Skill:** frontend-design
**Type:** open-source
**Phase/Area:** Content-rich card architecture

**Issue:** Calculating card metadata in components would either guess from headlines, issue one query per card, or risk exposing information from an unpublished revision.

**Suggested improvement:** Treat excerpts and reading time as listing-use-case output, batch-load only approved revisions behind the revision port, and pass serialisable metadata through the read model to every card variant.

**Principle:** Reader-facing metadata is editorial content and must follow the same approval boundary as the article body.

### Observation 10: Admin list controls should wrap real workflow rows

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** Multiple server-rendered Studio queues needed consistent search, filtering and pagination without moving use cases or mutations into a generic client table.
**Skill:** frontend-design
**Type:** open-source
**Phase/Area:** Admin collection architecture

**Issue:** Rebuilding each queue as a client-owned data table would duplicate controls and weaken server-component boundaries, while a purely visual toolbar would not operate on the real rows.

**Suggested improvement:** Use a serialisable collection entry contract carrying search/filter metadata and the existing rendered row as content, so one client control surface can paginate heterogeneous server-backed workflows without owning their business actions.

**Principle:** Shared admin controls should coordinate workflow views, not absorb the workflows themselves.

### Observation 11: CMS migrations need a safe public fallback and a real write-path check

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** Hard-coded public information pages were moved to localized Mongo-backed records while production content still needed migration.
**Skill:** frontend-design
**Type:** open-source
**Phase/Area:** CMS migration

**Issue:** Switching reads directly to a new empty collection would blank production pages, while verifying only the Studio form would not prove that saved content reached the public renderer.

**Suggested improvement:** Keep approved repository copy as a temporary read fallback, seed it into the CMS collection, then browser-test the complete editor save to public-page render loop before removing the fallback in a later content migration.

**Principle:** A CMS migration is complete only when approved content survives the cutover and an editor-authored change reaches the public route.

### Observation 12: Brand systems must own compound form controls

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** A polished newsroom interface still exposed operating-system dropdown and date-picker surfaces when controls opened.
**Skill:** frontend-design
**Type:** open-source
**Phase/Area:** Form-control design systems

**Issue:** Styling the closed native select did not style its open menu, and native date-time controls introduced a second visual language at the exact moment an editor made a consequential choice.

**Suggested improvement:** Inventory select, radio, checkbox, date and time controls as a dedicated design-system pass; use accessible hidden form semantics behind branded visible controls and verify both closed and open states in the browser.

**Principle:** A branded form control is not complete until its interaction state belongs to the same visual system as its resting state.

### Observation 13: Related information pages still need distinct jobs

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** A suite of public information pages was visually polished through one shared renderer, but user review still found the whole suite unsatisfying.
**Skill:** redesign-existing-projects
**Type:** open-source
**Phase/Area:** Multi-page redesign systems

**Issue:** Improving a shared template propagated better styling but also propagated the same hierarchy, density and storytelling pattern to every page, making functionally different destinations feel interchangeable.

**Suggested improvement:** During the design audit, assign each related route a specific reader job and a route-specific content module before building shared visual primitives; verify at least one company, support and policy page in rendered form.

**Principle:** A coherent page family should share visual grammar, not an identical content composition.

### Observation 14: Story redesigns must cover the whole reading journey

**Status:** OPEN
**Date:** 2026-08-30
**Session context:** A news detail page needed a complete redesign alongside loading and missing-story states.
**Skill:** redesign-existing-projects
**Type:** open-source
**Phase/Area:** Editorial reading experience

**Issue:** Redesigning only the headline and hero leaves the reader with generic prose, utility controls, related stories and error states that feel disconnected from the publication.

**Suggested improvement:** Treat the article as a sequence from arrival through orientation, reading, action, onward discovery and recovery; design the masthead, prose typography, reader tools, takeaways, related content, loading state and 404 as one editorial system.

**Principle:** A complete news-detail redesign owns every state from first signal to the reader's next destination.

### Observation 15: Cloud provisioning needs a durable compensation failure path

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** A live broadcast workflow provisioned a billable provider resource before persisting its local record.
**Skill:** do
**Type:** open-source
**Phase/Area:** Production integration verification

**Issue:** The happy path and ordinary rollback were tested, but a simultaneous persistence failure and provider-cleanup failure could silently orphan a billable resource with no local reconciliation handle.

**Suggested improvement:** For every create-remote-then-save-local workflow, test the dual-failure branch explicitly and surface a non-secret provider handle through a typed incident, secure logging and an operator reconciliation path.

**Principle:** Compensation is not complete until failure of the compensation itself remains visible and actionable.

### Observation 16: Deployment fixes are incomplete until published and observed

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** A production build failure was diagnosed and locally verified, but the provider remained failed because the deployment configuration change was left uncommitted.
**Skill:** New skill candidate: production deployment readiness
**Type:** open-source
**Phase/Area:** Publish and provider verification

**Issue:** A passing local production build was reported as resolved even though the change that should trigger the provider had not been committed or pushed, so the provider had no new revision to deploy.

**Suggested improvement:** Treat publish, provider build observation and final Ready status as mandatory completion gates whenever the user reports an active deployment failure and publishing is in scope.

**Principle:** A provider failure is resolved only when the provider has built the published fix successfully.

### Observation 17: Route loading boundaries define whether an app feels client-side

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** A Next.js Studio used framework links correctly, but every sidebar transition appeared to reload because the nearest loading boundary replaced the entire authenticated shell with a full-page splash.
**Skill:** redesign-existing-projects
**Type:** open-source
**Phase/Area:** Application-shell navigation

**Issue:** Auditing only the link component misdiagnoses perceived full-page reloads when a high-level `loading.tsx` temporarily removes persistent navigation and chrome.

**Suggested improvement:** Place route-shaped loading boundaries inside persistent shells, prefetch primary navigation, and reserve branded full-page splashes for initial application entry.

**Principle:** Navigation continuity is controlled as much by suspense-boundary placement as by the link primitive.

### Observation 18: Source ingestion can obscure the primary editorial workflow

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** A newsroom had a complete draft-review-publish pipeline, but its only prominent creation entry was RSS ingestion, making the product appear to republish other sites rather than support original reporting.
**Skill:** task-observer
**Type:** open-source
**Phase/Area:** Information architecture and workflow discovery

**Issue:** Capability audits that inspect use cases without tracing visible entry points can call a workflow complete even when users cannot discover its first action.

**Suggested improvement:** For each core workflow, trace the primary action from navigation and dashboard through completion; label secondary ingestion tools by their editorial role and never let them visually replace original authoring.

**Principle:** A workflow does not exist for users until its first action is visible and correctly prioritised.
### Observation 19: CMS entry routes must share the canonical authoring primitive

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** Remediating an editorial CMS after the full editor had rich Markdown while the create-story entry path still used a native select and plain textarea.
**Skill:** redesign-existing-projects
**Type:** open-source
**Phase/Area:** Scan and component consistency audit

**Issue:** Auditing only the named full editor missed a separate creation route that collected the same content with lower-quality native controls. The inconsistency was visible before editors ever reached the canonical workspace.

**Suggested improvement:** Add a workflow-entry inventory to the redesign scan: trace every route that creates or edits the same entity, identify the canonical input primitives, search for native controls and simplified duplicates, and verify that loading boundaries use the same visual system.

**Principle:** A premium workflow is only as coherent as its earliest entry point; shared data must use shared authoring primitives from creation through final editing.

### Observation 20: Release loops must budget platform deployment quotas

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** Publishing repeated production fixes in a multi-deployment monorepo until a hosting provider rejected the final corrected build at its daily deployment cap.
**Skill:** New skill candidate: release-budgeting
**Type:** open-source
**Phase/Area:** Production release planning

**Issue:** Several small commits each triggered deployment work, consuming a shared hosting quota before the final entry-route correction could be published. Green code and CI were insufficient because the release transport itself had been exhausted.

**Suggested improvement:** Before a long production-remediation loop, inspect provider deployment caps, batch tightly related fixes behind local and CI gates, and reserve at least one deployment for the final smoke-tested candidate. Record quota exhaustion as an external release blocker rather than representing code-complete work as live.

**Principle:** Deployment capacity is a finite release dependency and should be budgeted like CI minutes, credentials, and maintenance windows.

### Observation 21: Framework production builds belong in the local release gate

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** A full lint, typecheck, boundaries, test, duplication and backend verification command passed, but the hosted Next.js build rejected a route-level configuration that those gates never compiled.
**Skill:** New skill candidate: release-verification
**Type:** open-source
**Phase/Area:** Pre-deployment verification

**Issue:** Static typechecking proved the route was valid TypeScript but did not exercise framework build-time invariants. The first production deployment consumed scarce release capacity only to reveal a configuration incompatibility.

**Suggested improvement:** For framework applications, make the release candidate gate run the same production build command and environment shape as hosting after tests pass. Treat a verification script that omits the deployable build as necessary but incomplete evidence.

**Principle:** A green code-quality gate does not prove deployability unless it executes the framework's production compiler.

### Observation 22: Coverage floors need pinned-runtime headroom

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** A clean local Go verification narrowly cleared an aggregate coverage floor while the CI-pinned Go runtime reported the same suite below that floor.
**Skill:** New skill candidate: release-verification
**Type:** open-source
**Phase/Area:** CI parity and coverage verification

**Issue:** A newer local toolchain and the pinned CI toolchain produced materially different aggregate coverage percentages near a hard threshold, causing repeated release failures despite locally green evidence.

**Suggested improvement:** Reproduce the pinned CI toolchain before release when practical, keep deliberate coverage margin above the configured floor, and add meaningful failure-path tests instead of lowering the threshold or relying on cached results.

**Principle:** Coverage at the exact floor is unstable release evidence; pinned-toolchain parity and tested headroom make the gate trustworthy.
### Observation 23: Production env handoffs should omit unavailable variables

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** Auditing a multi-deployment production environment and its provider handoff.
**Skill:** New skill candidate: production-environment-handoff
**Type:** open-source
**Phase/Area:** Environment validation

**Issue:** An environment checklist used active empty assignments for unavailable providers. Several runtimes distinguish an absent variable from an empty value, and dashboard bulk imports can preserve those empty entries in surprising ways.

**Suggested improvement:** Derive the handoff from runtime reads, keep generated or supplied values active, and leave unavailable optional provider keys commented with format-safe examples. Validate that no active assignment is empty before delivery.

**Principle:** Production environment handoffs should encode absence explicitly and be validated against runtime consumption rather than copied mechanically from an example file.

### Observation 24: Production builds must identify the highest-precedence environment source

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** Verifying two Next.js applications in a monorepo where ignored app-level production placeholders overrode the authoritative root production environment.
**Skill:** New skill candidate: release-verification
**Type:** open-source
**Phase/Area:** Production build environment parity

**Issue:** A production build loaded a nearer app-level environment file containing fake provider values before the valid root file, producing an apparent application failure even though the intended production configuration was correct.

**Suggested improvement:** Before compiling a release candidate, enumerate the framework's environment-file precedence, identify ignored local overrides, validate the effective non-secret key sources, and run the build with the same authoritative environment shape used by hosting.

**Principle:** Production build evidence is trustworthy only when the highest-precedence environment source is known and intentional.

### Observation 25: Environment audits must inspect names without emitting values

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Auditing a gitignored production environment that contained live-looking credentials.
**Skill:** New skill candidate: production-environment-handoff
**Type:** open-source
**Phase/Area:** Secret-safe environment validation

**Issue:** Reading a production dotenv file verbatim during an audit can expose the very credentials the audit is meant to protect.

**Suggested improvement:** Start with variable names, value-presence flags and redacted fingerprints; read individual non-secret values only when necessary. If a credential is emitted outside its password manager, stop, sanitize the handoff and require rotation before deployment.

**Principle:** Secret audits should prove configuration without reproducing secrets.

- 2026-09-01 checkpoint: no new observation; Observation 24 already covers the app-local environment precedence encountered during production-build verification.
