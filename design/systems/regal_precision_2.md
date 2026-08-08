---
name: Regal Precision
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#45464d'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#171c1f'
  on-tertiary-container: '#808488'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#dfe3e7'
  tertiary-fixed-dim: '#c3c7cb'
  on-tertiary-fixed: '#171c1f'
  on-tertiary-fixed-variant: '#43474b'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
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
  body-sm:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system embodies a sophisticated blend of editorial elegance and modern functionalism. It targets a high-end professional audience that values clarity, authority, and a premium experience. 

The aesthetic is a hybrid of **Minimalism** and **Modern Corporate**, utilizing expansive white space and precise geometric alignment. It evokes a sense of established trust through traditional serif typography while remaining contemporary and accessible through clean, sans-serif body text. The emotional response should be one of "quiet confidence"—professional, polished, and unmistakably premium.

## Colors
The palette is centered around a **Professional Deep Navy** (#0F172A), serving as the primary anchor for branding and high-importance interaction points. 

- **Primary:** Deep Navy for primary buttons, active states, and dominant brand elements.
- **Secondary:** Slate blue-grey for secondary actions and supporting iconography.
- **Tertiary:** Ultra-light cool grey used for subtle surface differentiation and background zones.
- **Neutral:** Dark slate for text content to ensure high legibility against white backgrounds.

Functional colors for Success, Warning, and Error should be desaturated to maintain the sophisticated atmosphere of the design system.

## Typography
The typographic strategy employs a high-contrast pairing: **Playfair Display** for headlines provides an editorial, authoritative voice, while **Outfit** offers a clean, geometric, and modern feel for all functional and body text.

Maintain generous line heights for body text to enhance readability. All labels and metadata should use Outfit with slightly increased letter spacing when set in all-caps to maintain a premium, architectural look.

## Layout & Spacing
This design system utilizes a **Fixed Grid** model for desktop and a **Fluid Grid** for mobile devices.

- **Desktop (1440px+):** 12-column grid, 1120px max-width container, 24px gutters, and 64px outside margins.
- **Tablet (768px - 1439px):** 8-column fluid grid, 24px gutters, 32px margins.
- **Mobile (Up to 767px):** 4-column fluid grid, 16px gutters, 16px margins.

Spacing follows an 8px base unit. Use `lg` and `xl` spacing for section vertical rhythm to emphasize the minimalist, airy brand personality.

## Elevation & Depth
Hierarchy is established primarily through **Tonal Layers** and **Low-Contrast Outlines**. 

Shadows are used sparingly and should be "Ambient Shadows"—extremely diffused, with a 10% opacity of the primary navy color to create a soft, natural lift rather than a harsh digital drop. 

- **Level 0 (Base):** White background.
- **Level 1 (Cards/Containers):** 1px border (#E2E8F0) or Tertiary background.
- **Level 2 (Overlays/Modals):** High-diffusion shadow (0px 12px 32px rgba(15, 23, 42, 0.08)).

Avoid heavy gradients or skeuomorphic textures; keep surfaces flat and matte.

## Shapes
The shape language is **Soft** and restrained. Elements use a 0.25rem (4px) base radius. This subtly softens the "Brutalist" edge of a fixed grid without becoming overly "bubbly" or informal.

- **Buttons & Inputs:** 4px radius.
- **Cards & Large Containers:** 8px (rounded-lg) radius.
- **Icons:** Use a 2px stroke weight with consistent square ends to match the architectural feel of the Outfit typeface.

## Components
- **Buttons:** Primary buttons use the Deep Navy background with white Outfit text (Medium weight). Hover states transition to a slightly lighter tint. Use wide horizontal padding (24px) for a premium feel.
- **Inputs:** Clean, 1px bordered boxes using #E2E8F0. Focus state uses a 1px Deep Navy border—no "glow" or heavy outer rings.
- **Chips:** Tertiary background with Slate text, no border, 4px radius.
- **Cards:** White background, 1px Slate-200 border. Headings within cards should use Playfair Display (Medium) while content uses Outfit.
- **Lists:** Use subtle #F1F5F9 horizontal dividers. Row height should be generous (min 56px) to maintain the airy aesthetic.
- **Data Tables:** High-density text is prohibited. Use ample padding and "Outfit" for all numerical data to ensure geometric clarity.