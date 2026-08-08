# Design

## The chosen system: Regal Precision

[systems/regal_precision_1.md](systems/regal_precision_1.md) is the source of truth for tokens.

| | |
|---|---|
| Headlines | Playfair Display — 600/700, tight tracking at display sizes |
| Body & UI | Outfit — 400/500/600 |
| Primary | `#131b2e` midnight navy |
| Accent | `#775a19` champagne gold |
| Error | `#ba1a1a` |
| Spacing base | 8px · xs 4 · sm 12 · md 24 · lg 48 · xl 80 |
| Container | 1280px, 24px gutter |
| Radii | 0.25rem controls · 0.5rem cards · 0px structural dividers |
| Elevation | tonal layering + 1px borders. Shadows only on modals and dropdowns |

Philosophy: editorial minimalism and high-contrast precision. Depth comes from tone, not shadow. Motion is weighted — 8–12px Y-offset entrances, fast hovers, slow page fades.

The four alternates in [systems/](systems/) are recorded for reference. They were not selected.

## The full screen package is not in git

`stitch_kurasikapa_ai_media_platform.zip` is ~49MB, mostly PNG renders. Committing it would bloat the repository permanently, and git history cannot be trimmed cheaply later.

It contains ~70 screens as `code.html` + `screen.png`, across desktop/tablet/mobile and light/dark:

- Public — homepage, category listing, article, live TV, podcast library, events, membership, user profile, about, team
- Admin — editorial CMS, AI content editor, media library, analytics hub, SEO center, monetization, social publishing, roles & permissions

**Decision needed:** either enable Git LFS and track the zip, or host it on shared storage and link it here. Until then it lives in the project root, untracked.

## Rule

Implement against these designs. Do not invent new visual direction — the client signed off on this look, and the screens already exist for nearly every page in the R1 scope.
