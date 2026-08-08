---
name: Regal Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#775a19'
  on-secondary: '#ffffff'
  secondary-container: '#fed488'
  on-secondary-container: '#785a1a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e9c176'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4201'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
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
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-bold:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
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
  container-max: 1280px
  gutter: 24px
---

## Brand & Style

The design system is built upon a philosophy of **Editorial Minimalism** and **High-Contrast Precision**. It targets a sophisticated audience that values clarity, luxury, and intentionality. The aesthetic bridges the gap between traditional print media and cutting-edge digital interfaces, utilizing expansive white space and razor-sharp typography to evoke a sense of authoritative calm.

The visual style is characterized by:
- **High-Contrast Editorial:** Dramatic shifts in scale and weight.
- **Micro-interactions:** Motion that feels weighted and intentional, rather than purely decorative.
- **Clean Structure:** A rigid adherence to grid systems, softened by premium typographic choices.

## Colors

The palette is anchored by a deep midnight navy (Primary) and a refined champagne gold (Secondary/Accent). 

- **Primary:** Used for core branding, heavy lifting in light-mode text, and structural elements.
- **Secondary:** Reserved for highlighting excellence—call-to-actions, active states, and subtle decorative accents.
- **Light Mode (Regal Precision):** Utilizes pure white backgrounds and slate-tinted neutrals to maintain a sterile, high-end gallery feel.
- **Dark Mode:** Transitions to a deep obsidian base, replacing pure blacks with slightly tinted slates to maintain depth and reduce eye strain while preserving the high-contrast ethos.

## Typography

This design system employs a high-contrast typographic pairing to signal luxury and modernity.

- **Headlines (Playfair Display):** Should be used for all expressive titles. The high-contrast serifs provide the "Editorial" feel. Use tighter letter spacing for large display sizes to maintain visual impact.
- **Body & UI (Outfit):** A clean, geometric sans-serif that ensures maximum legibility across all digital touchpoints. Its open counters and modern construction balance the traditional nature of the serif headlines.
- **Labels:** Always use `label-bold` with uppercase styling and increased letter-spacing for category headers and small UI descriptors to differentiate them from body copy.

## Layout, Spacing & Motion

The layout follows a strict 12-column fluid grid for desktop, collapsing to 4 columns for mobile. 

- **Spacing:** We utilize an 8px base unit. Generous vertical rhythm is encouraged; use `xl` (80px) spacing between major sections to emphasize the minimalist aesthetic.
- **Motion Philosophy:** Animations must feel "weighted." 
    - **Entrance:** Elements should use `easing-entrance` with a subtle Y-axis offset (8px to 12px) to glide into place.
    - **Hover States:** Transitions on buttons and links should be `duration-fast` using `easing-standard`.
    - **Page Transitions:** Use `duration-slow` for soft fades to maintain the "Regal" atmosphere.

## Elevation & Depth

This design system avoids heavy shadows in favor of **Tonal Layering** and **Low-Contrast Outlines**.

- **Surface Tiers:** Depth is primarily communicated through color shifts. Backgrounds are pure, while containers use a subtle neutral tint (`surface`).
- **Borders:** Use thin, 1px borders for cards and dividers. In light mode, these should be low-contrast; in dark mode, they provide the necessary structural definition.
- **Floating Elements:** Only high-priority overlays (Modals, Dropdowns) may use a shadow. Use a very large blur radius (32px+) with extremely low opacity (4-8%) to mimic natural ambient light without breaking the flat editorial aesthetic.

## Shapes

The shape language is disciplined and professional. 
- **Soft (0.25rem):** Standard for buttons, input fields, and smaller UI components.
- **Large (0.5rem):** Reserved for primary cards and content containers.
- **Sharp Corners:** Dividers and layout-defining containers should remain at 0px roundedness to maintain the "Precision" aspect of the brand.

## Components

- **Buttons:** Primary buttons use the Primary Color with `label-bold` text. They should have a subtle 1px inset border of the Secondary Color on hover.
- **Input Fields:** Use a "bottom-border only" or "full-outline" approach with `surface` backgrounds. Transitions on focus should involve the border color changing to Secondary with a `duration-fast` transition.
- **Cards:** Cards should be border-heavy rather than shadow-heavy. Use the `surface` color to distinguish content blocks.
- **Chips/Tags:** Use `label-sm` with a light tint of the Primary or Secondary color. These are strictly `rounded-lg`.
- **Navigation:** Top-tier navigation uses `label-bold`. Active states are indicated by a 2px bottom bar in the Secondary color, appearing with the `easing-entrance` motion token.
- **Lists:** High-density lists should use the `surface` color on alternating rows or on hover to maintain the grid-like precision.