---
name: Regal Kinetic Editorial
colors:
  surface: '#0e150b'
  surface-dim: '#0e150b'
  surface-bright: '#333c2f'
  surface-container-lowest: '#091006'
  surface-container-low: '#161e13'
  surface-container: '#1a2216'
  surface-container-high: '#242c20'
  surface-container-highest: '#2f372b'
  on-surface: '#dde5d3'
  on-surface-variant: '#bdcbb2'
  inverse-surface: '#dde5d3'
  inverse-on-surface: '#2b3326'
  outline: '#87957e'
  outline-variant: '#3e4a38'
  surface-tint: '#5ce139'
  primary: '#5ce139'
  on-primary: '#083900'
  primary-container: '#2eb800'
  on-primary-container: '#0a4000'
  inverse-primary: '#186e00'
  secondary: '#ffb963'
  on-secondary: '#472a00'
  secondary-container: '#e59000'
  on-secondary-container: '#543200'
  tertiary: '#c6c6c7'
  on-tertiary: '#2f3131'
  tertiary-container: '#9fa0a0'
  on-tertiary-container: '#353737'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7aff55'
  primary-fixed-dim: '#5ce139'
  on-primary-fixed: '#032100'
  on-primary-fixed-variant: '#105300'
  secondary-fixed: '#ffddb9'
  secondary-fixed-dim: '#ffb963'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#663e00'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#0e150b'
  on-background: '#dde5d3'
  surface-variant: '#2f372b'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-xl:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  stack-xl: 64px
---

## Brand & Style
The design system for this media entity bridges the gap between high-end editorial prestige and vibrant broadcast energy. The brand personality is authoritative yet dynamic—capturing the "Best Ever" spirit through a lens of sophistication.

The visual style is **Corporate / Modern** with a refined editorial edge. It utilizes expansive white space (or deep tonal depth in dark mode), sharp precision in grid alignment, and high-contrast typography to ensure content remains the hero. By pairing luxury serif headers with a tech-forward sans-serif body, the system evokes a sense of trustworthy journalism powered by modern delivery platforms. The emotional response is one of excitement tempered by professionalism: the vibrancy of a live broadcast meeting the permanence of a premium magazine.

## Colors
The palette is rooted in the "Regal Precision" foundation—utilizing deep charcoal and pure white as the structural canvas. The brand identity is injected through two high-energy accents:

- **Primary Green (#2EB800):** A vibrant, "electric" green used for key action buttons, live indicators, and primary brand markers. It signifies growth and "Go" energy.
- **Secondary Gold/Orange (#E69100):** An "Amber Play" tone reserved for secondary highlights, progress bars, and premium features (VIP/Plus status).
- **Dark Mode (Default):** Uses a deep #121212 base to make media content pop. Surfaces use a slightly lighter #1E1E1E to create depth.
- **Light Mode:** Shifts to a #F9F9F9 background with text in #121212. The vibrant green is slightly darkened to #269900 for better accessibility on white.

Interaction states should use the "Muted" variants for backgrounds of subtle alerts or hover states to ensure the UI doesn't become over-saturated.

## Typography
The typographic hierarchy creates a distinct "Media" feel. **Playfair Display** provides the editorial gravitas required for headlines and featured story titles. Its high-contrast strokes require generous leading to maintain legibility.

**Outfit** serves as the functional backbone. Its geometric clarity ensures that metadata, captions, and UI labels remain legible even at small sizes on mobile devices. 

- Use **Display-LG** for hero section titles and major brand moments.
- **Label-LG** should always be uppercase with slight tracking (0.05em) to denote categories or "Live" badges.
- Body text should never exceed a width of 700px to maintain optimal reading speed.

## Layout & Spacing
This design system follows a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The layout philosophy is content-first, using "breathable" margins to suggest a premium experience.

- **Grid:** Use a 24px gutter to provide clear separation between media cards.
- **Margins:** Desktop views utilize a wide 64px side margin to center the focus. Mobile scales down to 20px to maximize screen real estate for video thumbnails.
- **Rhythm:** All vertical spacing follows an 8px base unit. Component internal padding should default to 16px (2 units) or 24px (3 units) to maintain a spacious, modern feel.
- **Reflow:** On tablet, the 12-column grid transitions to 8 columns, with font sizes scaling down by roughly 15% via fluid typography scales.

## Elevation & Depth
Hierarchy is established through **Tonal Layers** rather than heavy shadows. 

- **Level 0 (Base):** The primary background (#121212 or #F9F9F9).
- **Level 1 (Cards/Navigation):** A subtle elevation using the surface color (#1E1E1E). In Dark Mode, a 1px "ghost border" (#FFFFFF at 8% opacity) is used instead of a shadow to define edges.
- **Level 2 (Overlays/Modals):** Uses a sophisticated **Backdrop Blur** (20px) with a semi-transparent fill of the base color. This maintains context of the media underneath while bringing the foreground into focus.
- **Interaction:** Hovering over media cards should trigger a slight scale-up (1.02x) and an increase in the brightness of the ghost border, rather than a traditional drop shadow.

## Shapes
The shape language is **Rounded (Level 2)**. This balances the sharp, professional nature of the typography with an approachable, modern feel.

- **Standard Elements:** Buttons and input fields use a 0.5rem (8px) radius.
- **Containers:** Content cards and media thumbnails use a more pronounced 1rem (16px) radius to frame imagery elegantly.
- **Special Elements:** Search bars and "Live" tags can utilize the **Pill (Level 3)** style to distinguish them from functional content cards.

## Components
- **Buttons:**
    - *Primary:* Filled with Brand Green (#2EB800), text in White. High-contrast and bold.
    - *Secondary:* Outlined in Secondary Gold (#E69100) with a subtle 10% gold fill on hover.
    - *Ghost:* No background, white text (or black in light mode), used for navigation items.
- **Media Cards:** Aspect ratio of 16:9 for video content. Title in Playfair Display (Headline-MD) placed directly below the image. Hover state reveals the Secondary Gold play button overlay.
- **Chips/Badges:** Small, pill-shaped tags. "LIVE" badges use the Primary Green background with a pulsing animation. Category tags use a subtle grey-scale tint.
- **Inputs:** Dark grey backgrounds (#1E1E1E) with a 1px border. On focus, the border transitions to the Primary Green.
- **Progress Bars:** Thin 4px height. The filled portion uses the Secondary Gold to represent playback progress, providing a warm contrast against the dark UI.
- **Navigation:** A top-pinned glassmorphic bar that blurs the content behind it, keeping the Brand Logo (vibrant green) as the focal anchor on the left.