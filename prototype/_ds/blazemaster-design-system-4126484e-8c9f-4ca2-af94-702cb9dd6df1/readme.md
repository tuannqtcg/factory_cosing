# BlazeMaster Design System

## Overview

**BlazeMaster CPVC** is the world's most specified fire sprinkler system, manufactured by **Lubrizol Advanced Materials (LZAM)**. BlazeMaster CPVC pipe and fittings are used in residential and commercial wet-pipe fire sprinkler systems globally. The brand is a B2B / B2B2C product — targeting fire protection contractors, engineers, and specifiers.

BlazeMaster is one of several LZAM CPVC brands:
- **BlazeMaster** — fire suppression sprinkler (this design system)
- **FlowGuard Gold** — hot/cold water plumbing CPVC
- **Corzan** — industrial CPVC
- **Lubrizol** — parent brand (PMS 300 blue)

### Sources
- `uploads/20-172-LZAM-CPVC-Master-Brand-Guidelines-v5.pdf` — Master brand guidelines PDF (LZAM v5, 2020, 26 pages, created by Natalie Smith / Robert Kelemen at Lubrizol)
- `uploads/utm-avo.ttf` — Avenir display font (brand-licensed)
- No Figma link or codebase was provided.

---

## CONTENT FUNDAMENTALS

**Tone:** Authoritative, technical, trustworthy. BlazeMaster speaks to professionals — fire protection engineers, contractors, and code officials. Copy is direct and factual, never casual or promotional.

**Voice:**
- Confident but not boastful — the brand's leadership position is stated matter-of-factly ("The world's most specified…")
- Technical precision matters — correct product names, specs, and standards are essential
- "You" oriented — copy addresses the specifier or contractor, not an end consumer
- No emoji. No slang. No hyperbole.
- Third person for product claims; second person for instructions and CTAs

**Casing:**
- Headlines: Title Case for short headlines; Sentence case for body-level headings
- CTAs: Title Case ("Learn More", "Find a Distributor")
- All-caps used sparingly for overline labels only ("PRODUCT OVERVIEW", "WHY BLAZEMASTER")

**Language examples:**
- "BlazeMaster CPVC — The world's most specified fire sprinkler system."
- "Trusted by contractors, engineers, and code officials worldwide."
- "Specify with confidence."
- "Engineered for performance. Built to code."

**Emoji:** Never used.
**Exclamation marks:** Avoided — the brand speaks with quiet authority.

---

## VISUAL FOUNDATIONS

### Color
- **Primary:** Crimson red `#a8003b` — fire/safety red derived from CMYK (0, 100, 65, 34). This is the brand's signature color, used for primary CTAs, headline accents, and brand elements.
- **Dark:** Near-black `#1a1a1a` for body text; `#333333` (K=80) for UI chrome.
- **Gray:** `#737373` (K=55) for secondary text; `#b3b3b3` for borders and disabled.
- **Warm Cream:** `#ebe6d4` (C8 M10 Y17 K0) — warm off-white used in section backgrounds; gives pages a premium, physical-material feel.
- **White:** `#ffffff` — primary background.
- **Fire Orange:** `#ff6600` — heat/urgency accent. Never used as primary CTA color.
- **No gradients.** The brand is flat and clean. No bluish-purple, no ombre, no glassmorphism.

### Typography
- **Display/Headings:** Avenir (provided `utm-avo.ttf`). Avenir Black for hero headlines; Avenir Roman for subheadings. Geometric, humanist, warm yet professional.
- **Body/UI:** Roboto — Light (300), Regular (400), Medium (500), Bold (700). Technical precision, high legibility.
- **Fallback:** Helvetica Neue LT Pro (appears in brand PDF for certain applications).
- Headlines are large and confident — generous whitespace around them.
- Overlines use wide letter-spacing (0.12em), uppercase, small size.
- No italic usage in primary branded contexts.

### Backgrounds & Surfaces
- White (#fff) is the default page background.
- Warm cream (`#ebe6d4`) for alternating or hero section backgrounds — gives a warm, physical feel.
- Dark charcoal (`#333333`) for footer, dark-mode section backgrounds.
- Red (`#a8003b`) for bold hero bands or call-to-action strips.
- **No patterns, textures, or hand-drawn illustrations.** Brand is clean and industrial.
- **Photography:** Full-bleed photography of pipes, installation contexts, job sites. Color treatment is warm and slightly desaturated. No grain. No b&w.

### Cards
- Minimal card treatment: white background, very subtle shadow (`0 2px 8px rgba(0,0,0,0.08)`), thin border (`1px solid #b3b3b3`) or no border.
- Rounded corners: `2px` (nearly square) — industrial, not soft.
- No colored left-border accent cards.

### Borders & Dividers
- Thin `1px solid #b3b3b3` for dividers and card outlines.
- Red bottom-border (`3px solid #a8003b`) used as a strong accent rule under section headings.

### Spacing & Layout
- 4px base grid. Generous section padding: 80px top/bottom.
- Max content width: 1280px, centered.
- Left-aligned text preferred over centered in body sections.
- Strong vertical rhythm.

### Buttons
- **Primary:** Solid red `#a8003b` background, white text, `2px` radius. No shadow. On hover: darkens to `#7a0029`. No outline or glow.
- **Secondary:** White/transparent with red border, red text. On hover: light red fill.
- **Ghost:** No border, red text, underline on hover.
- Uppercase label text with wide tracking.

### Animation & Interaction
- Minimal animation. No bounces. No playful transitions.
- Hover: color shift (darken) — 150ms ease. No scale transforms on buttons.
- Page transitions: simple fade if any.
- No looping decorative animations.

### Iconography
See ICONOGRAPHY section below.

### Corner Radii
- `2px` — near-square. Industrial, not rounded-consumer.
- Pill (`9999px`) only for tags/badges.

### Shadow System
- Cards: `0 2px 8px rgba(0,0,0,0.08)` — very subtle lift.
- Dropdowns/modals: `0 8px 32px rgba(0,0,0,0.12)`.
- No inner shadows. No colored shadows.

### Transparency & Blur
- Minimal. No glassmorphism. Dark overlays over photos use a solid dark fill at ~60% opacity, not blur.

---

## ICONOGRAPHY

The brand guidelines PDF does not include a custom icon set. Based on the brand PDF structure:
- **No custom icon font** was provided.
- Icons appear to be simple, clean line-weight SVGs used sparingly for product feature callouts.
- **Substitution:** This design system uses [Lucide Icons](https://lucide.dev/) (CDN) — clean, consistent 1.5px stroke weight, matching the brand's industrial precision.
  - CDN: `https://unpkg.com/lucide@latest`
  - Usage: `<i data-lucide="shield"></i>` + `lucide.createIcons()`
- **Flag:** If BlazeMaster has proprietary icons, replace Lucide with those assets.
- No emoji used as icons. No unicode symbols as icons.

**Logo:**
- `uploads/BlazeMaster_white.eps` — white version of BlazeMaster logo (EPS vector)
- A rasterized PNG version should be exported from the EPS for web use. See `assets/` folder.
- The wordmark uses Avenir Black with "BlazeMaster" in all-caps tracking.

---

## FILE INDEX

```
BlazeMaster Design System
├── styles.css                   ← Global CSS entry point (import this)
├── readme.md                    ← This file
├── SKILL.md                     ← Agent skill descriptor
│
├── tokens/
│   ├── colors.css               ← Color custom properties
│   ├── typography.css           ← Type scale + font stack tokens
│   ├── spacing.css              ← Spacing, radius, shadow tokens
│   └── fonts.css                ← @font-face declarations
│
├── assets/
│   └── fonts/
│       └── utm-avo.ttf          ← Avenir (brand display font)
│
├── guidelines/
│   ├── colors-primary.card.html
│   ├── colors-neutral.card.html
│   ├── colors-semantic.card.html
│   ├── type-display.card.html
│   ├── type-body.card.html
│   ├── type-scale.card.html
│   ├── spacing-tokens.card.html
│   ├── spacing-usage.card.html
│   ├── brand-logo.card.html
│   └── brand-motion.card.html
│
├── components/core/
│   ├── Button.jsx + Button.d.ts + Button.prompt.md
│   ├── Badge.jsx + Badge.d.ts + Badge.prompt.md
│   ├── Card.jsx + Card.d.ts + Card.prompt.md
│   ├── Tag.jsx + Tag.d.ts + Tag.prompt.md
│   └── core.card.html
│
└── ui_kits/marketing/
    └── index.html               ← BlazeMaster marketing site UI kit
```

---

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| Button | `components/core/Button.jsx` | Primary, secondary, ghost variants |
| Badge | `components/core/Badge.jsx` | Status and count indicators |
| Card | `components/core/Card.jsx` | Content card with optional accent |
| Tag | `components/core/Tag.jsx` | Product category / filter labels |

## UI Kits

| Kit | Location | Description |
|-----|----------|-------------|
| Marketing Site | `ui_kits/marketing/index.html` | Hero, nav, product features, CTA sections |
