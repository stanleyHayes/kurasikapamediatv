---
name: Indigo Signal Elite
colors:
  surface: '#0c1516'
  surface-dim: '#0c1516'
  surface-bright: '#313b3c'
  surface-container-lowest: '#071011'
  surface-container-low: '#141d1e'
  surface-container: '#182122'
  surface-container-high: '#222c2d'
  surface-container-highest: '#2d3638'
  on-surface: '#dae4e5'
  on-surface-variant: '#c8c5cd'
  inverse-surface: '#dae4e5'
  inverse-on-surface: '#293233'
  outline: '#929097'
  outline-variant: '#47464c'
  surface-tint: '#c6c4df'
  primary: '#c6c4df'
  on-primary: '#2f2e43'
  primary-container: '#1a1a2e'
  on-primary-container: '#83829b'
  inverse-primary: '#5d5c74'
  secondary: '#ffb3b2'
  on-secondary: '#680012'
  secondary-container: '#ff525c'
  on-secondary-container: '#5b000f'
  tertiary: '#b0c6ff'
  on-tertiary: '#002d6e'
  tertiary-container: '#001a46'
  on-tertiary-container: '#5181e4'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e0fc'
  primary-fixed-dim: '#c6c4df'
  on-primary-fixed: '#1a1a2e'
  on-primary-fixed-variant: '#45455b'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b2'
  on-secondary-fixed: '#410008'
  on-secondary-fixed-variant: '#92001e'
  tertiary-fixed: '#d9e2ff'
  tertiary-fixed-dim: '#b0c6ff'
  on-tertiary-fixed: '#001944'
  on-tertiary-fixed-variant: '#00429a'
  background: '#0c1516'
  on-background: '#dae4e5'
  surface-variant: '#2d3638'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
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
  label-bold:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  max-width: 1280px
---

## Brand & Style

This design system is crafted for a high-authority media and news environment, evoking a sense of urgent intelligence and premium editorial quality. The personality is "The Informed Insider"—professional, unshakeable, and meticulously curated.

The visual style blends **Corporate Modern** with **High-Contrast Editorial**. It utilizes deep, cinematic backgrounds to establish depth, while employing vibrant "Signal" accents to denote breaking news and critical information. The interface prioritizes clarity and density, ensuring that large volumes of information remain digestible and authoritative. 

Key aesthetic drivers:
- **High-Authority Editorial:** Large, sophisticated serif headlines against dark canvases.
- **Precision Modernism:** Clean geometric body text and sharp functional elements.
- **Cinematic Depth:** Subtle gradients and tonal layering to prevent the dark mode from feeling "flat."

## Colors

The palette is rooted in the "Indigo Night" spectrum, optimized for a high-end dark mode experience.

- **Primary (Indigo Night):** Used for structural elements, headers, and primary containers. It provides a more sophisticated alternative to pure black.
- **Secondary (Signal Red):** Reserved for high-priority actions, "Live" indicators, breaking news badges, and critical alerts. It must be used sparingly to maintain its "Signal" impact.
- **Tertiary (Deep Indigo/Royal):** Used for interactive states, text links, and subtle accents to provide a cooler counter-balance to the red.
- **Neutral (Ice White):** The primary color for typography and iconography, ensuring maximum legibility against the deep indigo backgrounds.

**Color Application:**
- Backgrounds should use a tiered approach: `#0D0D1A` for the base and `#16162D` for cards/modules.
- Use a 5% opacity "Signal Red" tint for hover states on dark buttons to maintain the brand glow.

## Typography

The typography strategy relies on the tension between the classic, authoritative **Playfair Display** and the ultra-modern, geometric **Outfit**.

- **Headlines:** Always use Playfair Display. For major news features, use the `display-lg` size with tight letter spacing.
- **Body Text:** Outfit provides exceptional readability at small sizes on digital screens. Its geometric nature complements the editorial serifs by providing a clean, tech-forward anchor.
- **Metadata/Labels:** Use Outfit in bold, uppercase for categories (e.g., "WORLD NEWS," "LIVE") to evoke a news-ticker or broadcast aesthetic.
- **Contrast:** Maintain a high contrast ratio. Headlines should be near-white (`#F4FEFF`), while secondary body text can drop to 70% opacity for visual hierarchy.

## Layout & Spacing

This design system utilizes a **Fixed Grid** model for desktop and a **Fluid Grid** for mobile devices.

- **Desktop:** A 12-column grid with 24px gutters. Content is centered with a max-width of 1280px to maintain editorial readability.
- **Mobile:** A 4-column fluid grid with 16px margins.
- **Rhythm:** All spacing is based on an 8px baseline grid. Padding within cards and modules should strictly follow 8px increments (16, 24, 32, 48) to maintain a rigorous, professional structure.
- **Density:** News-heavy views (lists/feeds) should use tighter vertical spacing (16px), while long-form article views should increase whitespace (48px+) to allow the reader to focus.

## Elevation & Depth

In this dark-mode system, hierarchy is achieved through **Tonal Layers** and **Subtle Rim Lighting** rather than heavy shadows.

- **Level 0 (Base):** Deepest indigo background.
- **Level 1 (Cards/Modules):** Slightly lighter surface (`#16162D`). Use a 1px solid stroke in a slightly lighter indigo (`#2A2A45`) to define boundaries.
- **Level 2 (Overlays/Modals):** High-elevation surfaces. Use a soft, 20% opacity black shadow with a 32px blur to separate the modal from the background.
- **Interactive Accents:** Use a subtle outer glow (Signal Red) for active "Live" indicators to make them appear to emit light, simulating a broadcast studio environment.

## Shapes

The shape language is "Rounded Eight," providing a professional yet modern feel.

- **Standard Elements:** Buttons, input fields, and small cards use a **0.5rem (8px)** corner radius.
- **Large Containers:** Hero sections and major article cards use **1rem (16px)** to soften the large surface areas.
- **Functional Accents:** Small tags (e.g., "New") use **0.25rem (4px)** to maintain a sharper, more precise look.
- **Interactive States:** Buttons should not change shape on hover, but rather use color and scale transitions.

## Components

- **Buttons:**
    - *Primary:* Signal Red background with Ice White text. No border.
    - *Secondary:* Transparent with a 1.5px Ice White border.
    - *Ghost:* No background, Ice White text, primary indigo background on hover.
- **Chips/Badges:**
    - Use for categories. Small (12px) Outfit Bold text. For "Live" status, use a Signal Red background with a pulsing animation.
- **Input Fields:**
    - Dark indigo fill (`#0D0D1A`) with a 1px stroke. Label text sits above the field in Outfit Medium.
- **Cards:**
    - Vertical layout for news feeds. The image should occupy the top 50%, with a slight gradient overlay at the bottom of the image to allow white typography to sit over it if necessary.
- **News Ticker:**
    - A dedicated full-width component at the top or bottom of the screen. Dark indigo background with a Signal Red "LATEST" tag on the far left.
- **Video Player:**
    - Custom controls using Signal Red for the progress bar and Ice White for iconography.