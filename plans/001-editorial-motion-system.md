# 001 — Build the editorial motion system

- **Status**: DONE
- **Commit**: 36d9877
- **Severity**: HIGH
- **Category**: Cohesion, accessibility, missed opportunities
- **Estimated scope**: shared theme plus public and studio shell components

## Problem

Motion is currently limited to isolated pulses, generic hover lifts, and color
transitions. The public homepage, navigation, footer, standing pages, and studio
shell do not share a coherent entrance or interaction language. Several visual
surfaces also use gradients and generic rounded-card composition.

## Target

Use solid brand fields, editorial rules, offset layouts, and a shared motion
scale. Entrances use `cubic-bezier(0.23, 1, 0.32, 1)`, on-screen movement uses
`cubic-bezier(0.77, 0, 0.175, 1)`, and press feedback stays within 160ms.
Animate transform and opacity only. Fine-pointer hover effects are gated with
`@media (hover: hover) and (pointer: fine)`. Reduced motion keeps color and
opacity feedback while removing spatial movement.

## Repo conventions to follow

- Shared tokens and utilities live in `packages/web-kit/src/styles/theme.css`.
- Components use Tailwind utilities backed by the shared theme.
- Do not add a motion dependency; CSS is sufficient for predetermined motion.

## Steps

1. Replace gradients and the background grid with solid fields and an SVG dot pattern.
2. Add shared entrance, stagger, link, card, image-band, and press motion utilities.
3. Recompose the homepage hero and briefing rail around asymmetric editorial structure.
4. Simplify the header and footer into stronger solid-brand navigation surfaces.
5. Apply the same interaction language to standing pages and the studio shell.
6. Verify lint, typecheck, builds, gradient search, and reduced-motion behavior.

## Boundaries

- Do not change data loading, routes, authentication, permissions, or use cases.
- Do not add dependencies.
- Do not animate layout properties.

## Verification

- **Mechanical**: `pnpm lint`, `pnpm typecheck`, and filtered web/studio builds pass.
- **Feel check**: page sections enter in a brief stagger; cards use restrained image
  movement; navigation feedback is immediate; reduced motion removes translation.
- **Done when**: no production UI source contains gradients and both apps build.
