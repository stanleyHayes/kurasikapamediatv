---
name: Aura Editorial
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#ffb3b6'
  on-secondary: '#68001a'
  secondary-container: '#cc003c'
  on-secondary-container: '#ffdcdc'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#251400'
  on-tertiary-container: '#b47300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffdada'
  secondary-fixed-dim: '#ffb3b6'
  on-secondary-fixed: '#40000c'
  on-secondary-fixed-variant: '#920028'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style

The design system is engineered for a premium media landscape where journalistic authority meets high-tech precision. It bridges the gap between traditional broadcast excellence and digital-first agility, targeting a discerning global audience that values clarity and depth.

The aesthetic is **Sophisticated Modernism**. It leverages the structured clarity of Swiss design (Minimalism) while incorporating the depth and tactility of modern software (Glassmorphism). The UI is characterized by expansive whitespace, rigorous grid alignment, and subtle environmental effects that suggest a high-end, physical viewing experience. The goal is to evoke a sense of "digital prestige"—where every pixel feels intentional and every transition feels cinematic.

## Colors

The palette is anchored in **Deep Slate Navy**, providing a more contemporary and softer foundation than pure black, suitable for long-form reading and high-definition video backgrounds.

- **Primary:** Deep Slate Navy (#0F172A). Represents authority and depth. Used for background surfaces and primary branding.
- **Secondary (Accent):** Kurasikapa Crimson (#E11D48). A vibrant, modern red used for breaking news, live indicators, and primary calls to action.
- **Tertiary:** Excellence Gold (#F59E0B). Used sparingly for premium features, awards, or "Exclusive" badges to signify prestige.
- **Neutral:** A scale of cool grays. Light mode uses off-whites (#F8FAFC) for surfaces to reduce eye strain, while dark mode uses tiered slate tones to create hierarchical depth.

**Color Application:**
- Use Crimson for "Live" status and critical interaction points.
- Use semi-transparent variants of the Primary color for glassmorphic overlays.

## Typography

This design system utilizes a high-contrast typographic pairing to signal both heritage and technology.

- **Headlines:** *Playfair Display* is used for all major editorial titles. Its high-contrast serifs provide a classic "masthead" feel. For digital screens, keep tracking tight on larger sizes.
- **Body:** *Inter* is the workhorse for all long-form content. Its neutral, systematic nature ensures maximum legibility across varied screen densities.
- **Metadata/Technical:** *JetBrains Mono* is used for timestamps, category tags, and data visualizations. This monospaced touch adds a "high-tech" veneer, suggesting real-time data feeds and precision.

**Hierarchy Rules:**
- Editorial pieces should lead with a `display-lg` headline.
- Technical data or "Live" counters must use `label-caps` for clear distinction from narrative text.

## Layout & Spacing

The layout follows a **Strict Editorial Grid** (12 columns for desktop, 4 for mobile). The philosophy is "Information Density with Breathable Margins."

- **Desktop:** A fixed-width container centered in the viewport, utilizing wide 64px margins to frame the content like a high-end magazine.
- **Rhythm:** All vertical spacing must be a multiple of 8px. Use 48px or 64px gaps between major editorial sections to maintain a premium, uncluttered feel.
- **Negative Space:** Don't crowd the content. Allow video players and lead images to bleed to the edge of the grid to create a cinematic impact.

## Elevation & Depth

Visual hierarchy is achieved through **Environmental Layering**. 

1.  **Base Layer:** The canvas (Primary Navy in dark mode).
2.  **Surface Layer:** Cards and sections use a slightly lighter tint (Slate 800/900) with a 1px "inner-glow" stroke to define edges without heavy shadows.
3.  **Glass Layer:** Navigation bars and media overlays use a 20px backdrop blur with 60% opacity. This keeps the user grounded in the content while providing a modern, technical interface.
4.  **Floating Elements:** Modals and "Breaking News" alerts use a large, soft ambient shadow (0px 20px 50px rgba(0,0,0, 0.3)) to pop significantly from the background.

## Shapes

The shape language is **Refined Geometry**. Elements use a "Rounded" (0.5rem) base to soften the authoritative nature of the typography and colors, making the tech feel more approachable.

- **Standard Cards:** 0.5rem (8px) corner radius.
- **Feature/Lead Cards:** 1rem (16px) corner radius for a more prominent, "contained" look.
- **Interactive Elements:** Buttons and Input fields should mirror the card radius (8px) for consistency. 
- **Media:** Video thumbnails and live streams should always carry a radius; sharp corners are reserved strictly for hairline dividers.

## Components

- **Buttons:** Primary buttons use the Kurasikapa Crimson background with white text. Hover states should involve a subtle scale-up (1.02x) rather than a simple color change to feel "responsive."
- **Editorial Cards:** Use a vertical stack with the image on top. The image should have a subtle zoom-on-hover effect. Metadata (category/time) uses `label-caps`.
- **Live Indicator:** A small Crimson dot with a soft "pulse" animation, paired with `label-caps` text.
- **Input Fields:** Minimalist style. Dark slate background, 1px border that glows (Crimson or Gold) when focused. 
- **Glass Headers:** Persistent navigation with a heavy blur and a 1px bottom border (#FFFFFF10).
- **Video Controls:** Custom thin-line icons. Use high-contrast white on glassmorphic backgrounds for control clusters.
- **Chips/Tags:** Pill-shaped with a 1px border and no fill. On hover, fill with a low-opacity version of the accent color.