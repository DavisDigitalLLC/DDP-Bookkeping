# DDP Bookkeeping Brand Profile

## Brand Overview

**Brand name:** DDP Bookkeeping  
**Category:** Accounting / bookkeeping app  
**Brand feel:** Modern, trustworthy, clean, professional, approachable, finance-focused.

DDP Bookkeeping should feel like a modern financial-tech product: clean enough for bookkeeping, friendly enough for small business users, and polished enough to feel credible.

---

## Logo Direction

### Primary Logo

Use a horizontal lockup:

- Stylized **DDP** monogram
- Thin vertical divider
- Wordmark: **DDP Bookkeeping**

The monogram uses geometric letterforms. The small bar-chart detail inside the **P** gives the brand a bookkeeping / growth / financial-organization cue without making the logo feel cluttered.

### App Icon

Use the simplified DDP monogram only. Do not include the full wordmark inside the app icon.

Recommended app icon treatment:

- Full-bleed deep green gradient background
- White outer **D** and **P** forms
- Emerald green middle **D**
- Emerald green small bar-chart detail inside the **P**
- Strong contrast and minimal detail

---

## Color Palette

| Token | Color Name | Hex | Recommended Use |
|---|---:|---:|---|
| `deepEvergreen` | Deep Evergreen | `#005A43` | Primary anchor color; backgrounds, headers, navigation, primary brand surfaces. |
| `forestGreen` | Forest Green | `#0A3D33` | Dark supporting green; gradients, shadows, high-contrast text areas. |
| `emeraldAccent` | Emerald Accent | `#00C98D` | Highlights, charts, progress indicators, CTAs, active states. |
| `mintHighlight` | Mint Highlight | `#6FE7BE` | Soft accent, success highlights, badges, subtle backgrounds. |
| `white` | White | `#FFFFFF` | Logo/text on green, clean surfaces, content cards. |
| `softGray` | Soft Gray | `#F4F6F5` | Page backgrounds, dividers, secondary cards. |
| `charcoalText` | Charcoal Text | `#18211F` | Primary body copy on light backgrounds. |
| `mutedText` | Muted Text | `#64736E` | Secondary labels and helper text. |

### Gradients

```css
--ddp-primary-gradient: linear-gradient(135deg, #0A3D33 0%, #005A43 48%, #008C67 100%);
--ddp-emerald-glow: linear-gradient(135deg, #005A43 0%, #00C98D 100%);
```

Use the primary gradient for full-bleed brand surfaces such as banners, splash screens, hero sections, and app icon backgrounds.

---

## Typography Recommendations

These are recommendations based on the visual style, not verified exact source fonts from the generated artwork.

### Primary Font

**Montserrat SemiBold / Bold**

Use for:

- Page titles
- Main section headers
- High-emphasis labels
- Marketing headlines

### Secondary Font

**Inter Regular / Medium**

Use for:

- Body copy
- Forms
- Tables
- App UI labels
- Settings screens
- Transaction / bookkeeping details

### Optional Accent Font

**Manrope Medium**

Use sparingly for:

- Small marketing callouts
- Dashboard cards
- Badge labels

### Font Stack

```css
font-family: Inter, Montserrat, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

---

## UI Style Guidance

- Use deep green as the anchor brand color.
- Use emerald for highlights, charts, and CTAs.
- Maintain generous white space and clean alignment.
- Keep iconography minimal and finance-focused.
- Use the standalone DDP icon when the wordmark would be too small.
- Avoid unnecessary financial symbols such as dollar signs unless they serve a clear UI purpose.

### Suggested UI Tokens

```css
:root {
  --ddp-deep-evergreen: #005A43;
  --ddp-forest-green: #0A3D33;
  --ddp-emerald-accent: #00C98D;
  --ddp-mint-highlight: #6FE7BE;
  --ddp-white: #FFFFFF;
  --ddp-soft-gray: #F4F6F5;
  --ddp-charcoal-text: #18211F;
  --ddp-muted-text: #64736E;

  --ddp-primary-gradient: linear-gradient(135deg, #0A3D33 0%, #005A43 48%, #008C67 100%);

  --ddp-radius-sm: 8px;
  --ddp-radius-md: 14px;
  --ddp-radius-lg: 24px;
  --ddp-shadow-soft: 0 18px 45px rgba(10, 61, 51, 0.18);
  --ddp-card-border: 1px solid rgba(10, 61, 51, 0.10);
}
```

---

## Tailwind Config Snippet

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        ddp: {
          evergreen: '#005A43',
          forest: '#0A3D33',
          emerald: '#00C98D',
          mint: '#6FE7BE',
          softGray: '#F4F6F5',
          charcoal: '#18211F',
          muted: '#64736E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
        accent: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        ddpSm: '8px',
        ddpMd: '14px',
        ddpLg: '24px',
      },
      boxShadow: {
        ddpSoft: '0 18px 45px rgba(10, 61, 51, 0.18)',
      },
    },
  },
};
```

---

## Asset Files Included

- `assets/ddp_bookkeeping_banner_1024x500.png`
- `assets/ddp_bookkeeping_app_icon_1024x1024.png`
- `assets/ddp_bookkeeping_brand_profile_guide.png`
- `ddp_bookkeeping_brand_tokens.json`

---

## Claude Code Instructions

Use `ddp_bookkeeping_brand_tokens.json` as the source of truth for colors, font recommendations, gradients, usage notes, and asset names.

When building screens, prioritize:

1. Full-bleed green gradient for splash / onboarding / hero areas.
2. White or soft-gray card surfaces for bookkeeping content.
3. Emerald accent for positive actions, chart bars, check states, and progress.
4. Inter for most UI text and Montserrat for headings.
5. Minimal finance-focused iconography.
