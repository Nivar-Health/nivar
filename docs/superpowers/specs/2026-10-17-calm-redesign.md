# Nivar calm redesign ("Mist & Pine")

Date: 2026-10-17
Status: **superseded for the landing page.** After review the founder asked for a bolder, more attractive page, and the
landing was rebuilt the same day as "Garden City morning": a white page with a jade action colour (`--jade` #0b7366), deep pond
bands (`--pond`), aqua / marigold / rose / sky tints, General Sans only (no serif accents), an arched "doorway" hero with a
multilingual line that cycles on its own ("Cared for like family.", `LIKE_FAMILY` in `l10n.ts`), a multilingual ribbon, an
animated visit story for "How it works" (`visit-journey.tsx`), and no pause controls (motion follows the OS reduced-motion
setting). Tokens live in `globals.css` (landing palette) and `components/landing/landing.css` (landing scope and motion).
Still current from this spec: the health facts and tips content and its fact-check rules (section 8), the l10n code-point
rules (section 4.5), `site-facts.ts`, the app-wide colour fixes (section 10) and the `bookingEnabled` behaviour.
Original status: final design spec, ready to implement. Merges the judged winner (Direction A, "Calm Clinical Trust") with grafts from B and C, every judge must-fix, the UX audit, the fact-checked health content and the native-reviewed translations.
Scope: the landing page (`/`) is redesigned. Login, the patient app and the staff portals get the new tokens plus fixes to hard-coded colours. They are not redesigned.

Every implementer reads sections 0 to 5 in full and then only the parts their unit names (section 11).

## 0. Rules for implementers

- Follow this spec literally. Where it gives code, paste that code. Where it gives classes, use those classes. If something here does not compile, make the smallest change that keeps the intent, and note it in your final report.
- Only edit the files your unit owns (section 11). If you need a change in a file you don't own, list it in your report. Do not make the change yourself.
- Never use a hex colour, `rgb()` or `#...` inside a `className` or `style` on the landing page. Use the token utilities from section 2. There are three exceptions: SVG glyph attributes may use `var(--token)`, the canvas monitor palette (`MONITOR`) keeps its literals, and `white/<n>` alphas are allowed on deep surfaces.
- Preserve: every anchor id (`#how-it-works #what-we-test #pricing #for-families #live #devices #doctors #faq #callback`), `scroll-mt-16`, the 64px nav, `bookHref()`, `BOOK_LABEL`, `bookingEnabled` behaviour (with booking off, every booking CTA reads "Request a callback" or "Enquire" and points at `#callback`), catalog-driven pricing, the real `EcgMonitor`, and the `/api/leads` contract (`name`, `phone`, `city`, optional `message` up to 1000 characters).
- No new npm dependencies. Motion is CSS keyframes plus small client components.
- Next.js here is 16.4 and differs from your training data. Check `apps/web/node_modules/next/dist/docs/` before using any Next API. Notable: `next/image` `priority` is deprecated (use `loading="eager"` + `fetchPriority="high"`, or `preload`).
- Dev server: http://localhost:3100 (already running; do not stop it). Screenshots: `cd /Users/chirag/Work/nivar/.playwright-mcp/tools && node shot.mjs http://localhost:3100/ ../shots/<name> [--mobile] [--reduced]`. Use `--reduced` to check reduced motion.
- Do not commit. Do not edit `AGENTS.md`.
- **What has been verified:** the code in 2.1, 3.1, 3.3, 4.1 to 4.5, 5.2, 7.2 and 8.2 was extracted from this file into a scratch copy of the app and checked with `tsc` and `eslint` (both clean), then run on a dev server.
  - The page rendered with the new tokens and no console errors, and there was no horizontal overflow at 320, 360, 390 or 1440.
  - The rotator had CLS 0 and fit at 360 (English line 273px plus glyph, inside 320px). It advanced en → kn → hi at 5s, paused on hover, on keyboard focus and with the global toggle, and stayed static under reduced motion.
  - Noto Kannada and Devanagari loaded lazily and rendered the reviewed strings correctly.
  - Reveal: below-fold blocks were hidden and then revealed on scroll; nothing was hidden without JavaScript or under reduced motion.

## 1. Decisions

| Decision | Choice | Why (the founder's words) |
|---|---|---|
| Palette | **Mist & Pine**: mist page `#F6F8F6`, white cards, sage-wash and warm sand bands, pine-ink text `#10201B`, one deep-teal action colour `#0E4F45`, deep pine `#0D2420` for at most two immersive panels. Warm accents (sand, blush, rose, amber) live only in illustrations, the tips band and a few chips. | "soothing to eyes", "calmness", "perfect color schema", "professional". There is no pure black or pure white page field and no black slabs. Teal reads as clinical and calm, and sand adds the "connected to the people" warmth. |
| Action colour | `--primary` `#0E4F45` (deep teal). | It is the lightest teal that keeps every existing patient-app pattern (`bg-primary` cards with `text-primary-foreground/60` at 11px, shadcn `hover:bg-primary/80`) at AA without editing them: white/60 on it is 4.53:1 and the /80 hover is 5.59:1. Mid teals (`#0E6655`) fail those at 3.58 and 4.47. |
| Fonts | General Sans (kept) for everything. **Newsreader Italic 400** as the only accent: one phrase per heading. **Noto Sans Kannada 500** and **Noto Sans Devanagari 500** only for Indic text, never preloaded. | "professional" plus "attractive". The serif italic adds warmth without a lifestyle feel. Noto is the lightest option (81KB total), has the widest coverage and was confirmed by both native reviewers. General Sans stays first in every Indic stack so the baseline never jumps. |
| Borders | 1px tokens only: `--border` hairline, `--border-strong` for hover and selected, `--input` (3.53:1) for form fields. Grids use `gap-px` on `bg-border`. Lists use `divide-y`. There are no doubled lines and no alpha-black borders. | "perfect borders" |
| Radii | 6 / 8 / 12 / 16 / 20 / 24 / 32 px and full. Buttons and chips are always pills. Inner radius = outer radius minus padding. | "perfect form" |
| Motion | Slow and breath-paced. One-shot reveals (600ms) on scroll via a single IntersectionObserver. Health glyphs move once on reveal and once on hover. At most one ambient loop per viewport plus the rotator. Every loop can be stopped with one global **Pause animations** control, and under `prefers-reduced-motion` nothing moves on its own. | "use animation carefully", "soothing", "some health related animations too", WCAG 2.2.2 |
| Multilingual line | A rotator under the H1: **"Take care of your health."**, what every family says at the end of a call, in English, ಕನ್ನಡ, हिंदी and मराठी. A 5s dwell, a crossfade, language chips and a pause control. | "an animation of something connected text of health in different languages ... the text keep changing". Both native reviewers picked this line as the warmest and safest for elders. |
| Facts and tips | "Health, in numbers" (4 sourced fact cards) after How it works. "Everyday care" (tip of the day, a 1-minute breathing guide, a visit checklist) after Families. Nothing auto-advances. | "some health facts and tips to engage users" |
| Copy truth | One source of truth for hours, report time, payment and emergency lines (`lib/site-facts.ts`). The H1 no longer promises arrival "within the hour". | The audit found contradictory claims, and in healthcare inconsistent promises destroy trust. |

### What changed from the three directions

- **From A (the winner):** palette base, pine dark surfaces, Newsreader accent, Noto Indic fonts, form spec, light illustrated programme cards, the reassurance strip, the breathing card, and "Most of it is silent. Until someone checks."
- **From B:** the global pause control, `.theme-pine` token scoping, chips in native script, proverbs shown with English glosses (used statically in the tips band), the "Before your nurse arrives" checklist, an honest "Demo" caption on the live dashboard, the FAQ closing line, the heartline glyph on the rotator, and the hero heart synced to the trace.
- **From C:** the rotator sits between the H1 and the lede, `:lang()` resets for General Sans features and tracking, a one-shot IntersectionObserver reveal, a static multilingual sign-off on the final CTA, "Who is it for?" chips in the callback form, a callback cell in the pricing grid, a calm-minute link from the success state, and the photo placed earlier on mobile.
- **Rejected:**
  - Scroll-linked `animation-timeline` reveals (they scrub and leave text half-transparent).
  - Aurora loops and frosted glass everywhere (spa feel, performance cost).
  - Calligraphic Tiro and Fraunces (lifestyle feel, about 190KB).
  - Anek (renders heavier and has a taller line box).
  - A count-up or auto-advancing carousel.
  - Changing the `MONITOR` canvas palette (it is shared with the staff consoles; only its failing dim text is fixed).

## 2. Tokens

### 2.1 `apps/web/src/app/globals.css`: the complete new file

Unit 0 replaces the file with exactly this content.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

/* Nivar ships a single, light theme ("Mist & Pine"). The `dark` variant is kept only so
   shadcn component classes compile; nothing toggles it. Dark *sections* use .theme-pine. */
@custom-variant dark (&:is(.dark *));

@theme inline {
  /* shadcn semantic colours (names unchanged) */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* New semantic colours (follow .theme-pine / .theme-light scopes) */
  --color-foreground-2: var(--foreground-2);
  --color-heading-accent: var(--heading-accent);
  --color-border-strong: var(--border-strong);
  --color-input-hover: var(--input-hover);
  --color-primary-hover: var(--primary-hover);
  --color-primary-active: var(--primary-active);

  /* Brand palette (raw; never re-scoped). Usable as bg-mint, text-saffron, bg-pine, etc. */
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-mist: var(--mist);
  --color-wash: var(--wash);
  --color-mint: var(--mint);
  --color-sand: var(--sand);
  --color-blush: var(--blush);
  --color-sky: var(--sky);
  --color-sage: var(--sage);
  --color-sage-ink: var(--sage-ink);
  --color-teal: var(--teal);
  --color-teal-deep: var(--teal-deep);
  --color-ivory: var(--ivory);
  --color-signal: var(--signal);
  --color-signal-ink: var(--signal-ink);
  --color-trace: var(--trace);
  --color-success: var(--success);
  --color-success-bg: var(--success-bg);
  --color-warning: var(--warning);
  --color-warning-bg: var(--warning-bg);
  --color-warning-ink: var(--warning-ink);
  --color-saffron: var(--saffron);
  --color-saffron-foreground: var(--saffron-foreground);
  --color-danger: var(--danger);
  --color-danger-bg: var(--danger-bg);
  --color-danger-hover: var(--danger-hover);
  --color-pine: var(--pine);
  --color-pine-raised: var(--pine-raised);
  --color-on-pine: var(--on-pine);
  --color-amber-on-dark: var(--amber-on-dark);
  --color-glyph-rose: var(--glyph-rose);
  --color-glyph-amber: var(--glyph-amber);
  --color-glyph-sky: var(--glyph-sky);

  /* Type families */
  --font-sans: var(--font-general), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-general), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-general), ui-sans-serif, system-ui, sans-serif;
  --font-accent: var(--font-newsreader, ui-serif), Georgia, "Times New Roman", serif;
  --font-kn: var(--font-general), var(--font-noto-kn, "Noto Sans Kannada"), "Kannada Sangam MN", "Tunga", "Nirmala UI", sans-serif;
  --font-deva: var(--font-general), var(--font-noto-deva, "Noto Sans Devanagari"), "Kohinoor Devanagari", "Devanagari Sangam MN", "Nirmala UI", "Mangal", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Type scale (font-size + line-height + tracking + weight) */
  --text-h1: clamp(2.5rem, 1.6rem + 3vw, 3.75rem);
  --text-h1--line-height: 1.04;
  --text-h1--letter-spacing: -0.03em;
  --text-h1--font-weight: 500;
  --text-cta: clamp(2.25rem, 1.5rem + 3vw, 3.75rem);
  --text-cta--line-height: 1.04;
  --text-cta--letter-spacing: -0.03em;
  --text-cta--font-weight: 500;
  --text-h2: clamp(2rem, 1.4rem + 2.4vw, 3.25rem);
  --text-h2--line-height: 1.08;
  --text-h2--letter-spacing: -0.028em;
  --text-h2--font-weight: 500;
  --text-h3: 1.375rem;
  --text-h3--line-height: 1.25;
  --text-h3--letter-spacing: -0.015em;
  --text-h3--font-weight: 500;
  --text-h4: 1.125rem;
  --text-h4--line-height: 1.35;
  --text-h4--letter-spacing: -0.01em;
  --text-h4--font-weight: 500;
  --text-lede: 1.125rem;
  --text-lede--line-height: 1.6;
  --text-body: 1.0625rem;
  --text-body--line-height: 1.6;
  --text-small: 0.9375rem;
  --text-small--line-height: 1.55;
  --text-caption: 0.8125rem;
  --text-caption--line-height: 1.45;
  --text-stat: clamp(2.5rem, 2rem + 2vw, 3rem);
  --text-stat--line-height: 1;
  --text-stat--letter-spacing: -0.02em;
  --text-stat--font-weight: 500;
  --text-rotator: clamp(1.5rem, 1.15rem + 1.4vw, 2rem);
  --text-rotator--line-height: 1.6;
  --text-rotator--font-weight: 500;

  /* Radii: exact steps (inputs 12, tiles 16, cards 20-24, panels 32, buttons full) */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-3xl: 24px;
  --radius-4xl: 32px;

  /* Shadows: tinted with pine ink, never grey-black */
  --shadow-xs: 0 1px 2px rgb(16 32 27 / 0.05);
  --shadow-soft: 0 1px 2px rgb(16 32 27 / 0.04), 0 8px 24px -12px rgb(16 32 27 / 0.1);
  --shadow-lift: 0 2px 4px rgb(16 32 27 / 0.04), 0 24px 48px -20px rgb(16 32 27 / 0.2);
  --shadow-glass: 0 12px 32px -16px rgb(16 32 27 / 0.3);

  /* Easing utilities: ease-calm, ease-standard, ease-exit, ease-breath */
  --ease-calm: var(--curve-calm);
  --ease-standard: var(--curve-standard);
  --ease-exit: var(--curve-exit);
  --ease-breath: var(--curve-breath);

  /* App-wide animations (names unchanged; pulse is slower and softer) */
  --animate-pulse-ring: pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  --animate-ecg-sweep: ecg-sweep 3.2s linear infinite;
  --animate-fade-up: fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  --animate-heartbeat: heartbeat 1.4s ease-in-out infinite;

  @keyframes pulse-ring {
    0% {
      transform: scale(1);
      opacity: 0.45;
    }
    85%,
    100% {
      transform: scale(2.2);
      opacity: 0;
    }
  }
  @keyframes ecg-sweep {
    from {
      stroke-dashoffset: 1000;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes fade-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes heartbeat {
    0%,
    40%,
    100% {
      transform: scale(1);
    }
    15% {
      transform: scale(1.08);
    }
    28% {
      transform: scale(0.98);
    }
  }
}

:root {
  /* ---- Raw palette: Mist & Pine (never re-scoped) ---------------------------------- */
  --mist: #f6f8f6; /* page */
  --white: #ffffff; /* cards */
  --wash: #edf3ef; /* sage band, quiet fills */
  --mint: #e1eee7; /* chips, icon tiles, selected */
  --sand: #f4efe4; /* warm band (Everyday care), diabetes tint */
  --blush: #f6ece9; /* heart tint */
  --sky: #e7eef4; /* vitals tint */
  --ivory: #ffffff; /* legacy name, unused */

  --ink: #10201b; /* headings, primary text */
  --ink-2: #43524c; /* ledes, body copy */
  --ink-3: #5a6964; /* meta, captions, hints */
  --sage-ink: #3f6a5e; /* serif accent phrase */
  --sage: #8db5a4; /* decorative strokes only, never text (2.26:1) */

  --teal: #0e6655; /* icons, glyph strokes, grid tint */
  --teal-deep: #0e4f45; /* the action colour */
  --primary-hover: #0b4339;
  --primary-active: #08372f;

  --signal-ink: #0b7148; /* "Live" / "Normal" as text on light */
  --trace: #5fd6a6; /* traces, live dots and logo dot on dark */
  --success: #16704a;
  --success-bg: #e6f2ec;
  --warning: #8f5b0c;
  --warning-bg: #fbf1df;
  --warning-ink: #7a4d08;
  --saffron: var(--warning);
  --saffron-foreground: #ffffff;
  --danger: #b23a30;
  --danger-bg: #fdf3f2;
  --danger-hover: #9a3129;

  --hairline: #dde5e1;
  --hairline-strong: #c5d2cc;
  --input-line: #788d85; /* 3.53:1 on white */
  --input-hover: #5b7068;

  --pine: #0d2420;
  --pine-raised: #13302a;
  --on-pine: #f1f6f3;
  --on-pine-2: #b7c9c1;
  --on-pine-3: #93aaa1;
  --pine-accent: #9ccbb9;
  --ring-on-dark: #7fd1b5;
  --amber-on-dark: #e9c27a;

  --glyph-rose: #b4574e;
  --glyph-amber: #9a6b1e;
  --glyph-sky: #3d6684;

  --chart-1: #0e4f45;
  --chart-2: #2f8a6e;
  --chart-3: #4f7590;
  --chart-4: #b07d27;
  --chart-5: #6f9a8b;

  --sidebar: #f1f5f2;
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--teal-deep);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: var(--mint);
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: var(--hairline);
  --sidebar-ring: var(--teal-deep);

  --radius: 0.75rem;

  /* Motion curves (used by landing.css and the ease-* utilities) */
  --curve-calm: cubic-bezier(0.22, 1, 0.36, 1);
  --curve-standard: cubic-bezier(0.2, 0, 0, 1);
  --curve-exit: cubic-bezier(0.4, 0, 1, 1);
  --curve-breath: cubic-bezier(0.37, 0, 0.63, 1);

  color-scheme: light;
}

/* ---- Semantic tokens: light (page default, and .theme-light inside dark panels) ---- */
:root,
.theme-light {
  --background: var(--mist);
  --foreground: var(--ink);
  --foreground-2: var(--ink-2);
  --heading-accent: var(--sage-ink);
  --card: var(--white);
  --card-foreground: var(--ink);
  --popover: var(--white);
  --popover-foreground: var(--ink);
  --primary: var(--teal-deep);
  --primary-foreground: #ffffff;
  --secondary: var(--wash);
  --secondary-foreground: var(--ink);
  --muted: var(--wash);
  --muted-foreground: var(--ink-3);
  --accent: var(--mint);
  --accent-foreground: var(--ink);
  --destructive: var(--danger);
  --border: var(--hairline);
  --border-strong: var(--hairline-strong);
  --input: var(--input-line);
  --ring: var(--teal-deep);
  --signal: #1e9563; /* live dots on light surfaces: 3.18-3.79:1 */
}

/* ---- Semantic tokens: deep pine panels (Live section, final CTA, auth brand panel) ---- */
.theme-pine {
  --background: var(--pine);
  --foreground: var(--on-pine);
  --foreground-2: var(--on-pine-2);
  --heading-accent: var(--pine-accent);
  --card: var(--pine-raised);
  --card-foreground: var(--on-pine);
  --secondary: rgb(255 255 255 / 0.06);
  --secondary-foreground: var(--on-pine);
  --muted: rgb(255 255 255 / 0.06);
  --muted-foreground: var(--on-pine-3);
  --accent: rgb(255 255 255 / 0.08);
  --accent-foreground: var(--on-pine);
  --border: rgb(255 255 255 / 0.1);
  --border-strong: rgb(255 255 255 / 0.18);
  --input: rgb(255 255 255 / 0.32);
  --ring: var(--ring-on-dark);
  --signal: var(--trace);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    @apply font-sans;
    -webkit-tap-highlight-color: transparent;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "ss01", "cv11";
    text-rendering: optimizeLegibility;
  }
  ::selection {
    background: color-mix(in oklab, var(--teal-deep) 16%, transparent);
  }
  .font-display {
    letter-spacing: -0.025em;
    font-weight: 500;
  }
  .theme-pine {
    background-color: var(--background);
    color: var(--foreground);
  }
  .font-accent {
    font-style: italic;
    font-synthesis: none;
  }
}

/* Indic text: General Sans stays first so every language shares one baseline; Noto supplies
   the Kannada / Devanagari glyphs. Unlayered on purpose so it beats tracking utilities. */
:lang(kn) {
  font-family: var(--font-general), var(--font-noto-kn), "Kannada Sangam MN", "Tunga", "Nirmala UI", sans-serif;
}
:lang(hi),
:lang(mr) {
  font-family: var(--font-general), var(--font-noto-deva), "Kohinoor Devanagari", "Devanagari Sangam MN", "Nirmala UI", "Mangal", sans-serif;
}
:lang(kn),
:lang(hi),
:lang(mr) {
  letter-spacing: 0;
  font-feature-settings: normal;
  font-synthesis: none;
  font-style: normal;
  text-transform: none;
  line-height: 1.6;
}

/* Faint ECG paper: fine 8px grid with a heavier 40px major grid. */
@utility bg-ecg-grid {
  --grid-color: color-mix(in oklab, var(--teal) 7%, transparent);
  --grid-color-major: color-mix(in oklab, var(--teal) 12%, transparent);
  background-image:
    linear-gradient(var(--grid-color-major) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color-major) 1px, transparent 1px),
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
  background-size:
    40px 40px,
    40px 40px,
    8px 8px,
    8px 8px;
  background-position: -1px -1px;
}

/* Same grid tuned for pine panels. */
@utility bg-ecg-grid-dark {
  --grid-color: rgb(255 255 255 / 0.035);
  --grid-color-major: rgb(255 255 255 / 0.07);
  background-image:
    linear-gradient(var(--grid-color-major) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color-major) 1px, transparent 1px),
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
  background-size:
    40px 40px,
    40px 40px,
    8px 8px,
    8px 8px;
  background-position: -1px -1px;
}

/* A solid dot with a slow expanding ring, for "live" indicators. Colour follows currentColor. */
@utility live-dot {
  position: relative;
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background-color: currentColor;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-color: currentColor;
    animation: var(--animate-pulse-ring);
  }
}

/* The one focus recipe: 2px outline in --ring (light or dark scope), 2px offset, follows radius. */
@utility focus-ring {
  &:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
}

@utility pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

@utility tabular {
  font-variant-numeric: tabular-nums;
}

/* Global "Pause animations" (landing): stops every loop on its rest pose. */
html[data-motion="paused"] .motion-loop,
html[data-motion="paused"] .live-dot::after {
  animation: none !important;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
  .motion-loop,
  .live-dot::after {
    animation: none !important;
  }
}

@media (prefers-reduced-motion: no-preference) {
  html:has([data-landing]) {
    scroll-behavior: smooth;
  }
}
```

Removed from the old file: the unused `landing-flow` keyframes, the `--animate-*` literal colours, and the old palette. All landing motion moves to `landing.css` (section 5).

### 2.2 Classes whose meaning changes app-wide

The names stay the same and the values change. Nobody needs to edit code for these. Unit 8 checks them visually.

| Utility | Before | After | Effect |
|---|---|---|---|
| `bg-background` | white | mist `#F6F8F6` | Pages turn mist; white `bg-card` cards now stand out. Translucent headers (`bg-background/85`) tint mist. |
| `bg-primary`, `text-primary`, `border-primary`, `ring-primary` | black | deep teal `#0E4F45` | Every shadcn button, active tab, selected radio, the patient hero card and the book-wizard selection turn teal. All existing `text-primary-foreground/60..85` pairs stay at or above 4.5:1. |
| `ring` / focus | black | teal | Focus rings turn teal (9.45:1 on white). |
| `bg-muted`, `bg-secondary` | `#f4f4f1` warm grey | wash `#EDF3EF` | Quiet fills turn sage. |
| `bg-accent` | `#f4f4f1` | mint `#E1EEE7` | Menu hover and selected states. |
| `text-muted-foreground` | `#6a6a66` | `#5A6964` | 5.41:1 on the page, at least 4.83:1 on every tint. |
| `border-border` | `#e4e4df` | `#DDE5E1` | Hairlines are tinted to the palette. |
| `border-input` | `#d9d9d3` (1.42:1) | `#788D85` (3.53:1) | Form fields in every portal get visible edges (WCAG 1.4.11). Expected; check that dense staff forms still look tidy. |
| `bg-ink`, `text-ink` | `#0a0a0a` | `#10201B` | Backdrops (`bg-ink/45`) and the consult stage turn pine-black. |
| `text-saffron`, `bg-saffron`, `text-warning` | `#b9822c` (3.34:1) | `#8F5B0C` (5.72:1) | Fixes the AA failures in staff and patient status text. |
| `text-success`, `bg-success` | `#19a56d` (3.16:1) | `#16704A` (6.09:1) | Text-safe. |
| `text-danger`, `bg-danger`, `text-destructive` | `#c2453d` | `#B23A30` (5.93:1) | |
| `text-signal`, `bg-signal`, `stroke-signal` | `#19c37d` (2.30:1) | `#1E9563` on light (3.79:1 on white); `#5FD6A6` inside `.theme-pine` | Live dots pass 3:1 on every light surface. `text-signal` is still only for dots and icons, never words; use `text-signal-ink` for words. |
| `bg-mint` | `#eef3f0` | `#E1EEE7` | |
| `bg-teal`, `bg-teal-deep` | `#1f6b58` / `#154c3f` | `#0E6655` / `#0E4F45` | |
| `chart-1..5` | black, green, grey, red, light grey | teal-deep, green, slate, amber, soft sage | Admin charts: `INK` bars become teal-deep and the earlier-period bars become sage (3.15:1 on white, 3.0:1 against chart-1). |
| `shadow-soft`, `shadow-lift` | grey-black | pine-tinted | |
| `rounded-lg/xl/2xl/3xl/4xl` | 10/14/18/22/26px | 12/16/20/24/32px | Everything gets about 2px rounder. Spot-check dense admin tables. |
| `live-dot` pulse | 1.8s, scale 2.6 | 2.4s, scale 2.2, opacity .45 | Calmer everywhere. |

### 2.3 Contrast (computed with the WCAG relative-luminance formula; script at `/tmp/nivar-spec/pal.mjs`)

Text on light surfaces (needs 4.5; large text needs 3):

| Text \ Surface | mist `#F6F8F6` | white | wash `#EDF3EF` | mint `#E1EEE7` | sand `#F4EFE4` | blush `#F6ECE9` | sky `#E7EEF4` |
|---|---|---|---|---|---|---|---|
| ink `#10201B` | 15.81 | 16.87 | 15.00 | 14.13 | 14.72 | 14.54 | 14.41 |
| ink-2 `#43524C` | 7.72 | 8.24 | 7.32 | 6.90 | 7.18 | 7.10 | 7.03 |
| muted `#5A6964` | 5.41 | 5.77 | 5.13 | 4.83 | 5.03 | 4.97 | 4.93 |
| sage-ink `#3F6A5E` | 5.73 | 6.11 | 5.44 | 5.12 | 5.33 | 5.27 | 5.22 |
| primary `#0E4F45` | 8.85 | 9.45 | 8.40 | 7.91 | 8.24 | 8.14 | 8.07 |
| teal `#0E6655` | 6.45 | 6.88 | 6.12 | 5.76 | 6.00 | 5.93 | 5.88 |
| signal-ink `#0B7148` | 5.67 | 6.05 | 5.38 | 5.07 | 5.28 | 5.21 | 5.17 |
| success `#16704A` | 5.70 | 6.09 | 5.41 | 5.10 | 5.31 | 5.24 | 5.20 |
| warning `#8F5B0C` | 5.36 | 5.72 | 5.09 | 4.79 | 4.99 | 4.93 | 4.89 |
| danger `#B23A30` | 5.56 | 5.93 | 5.27 | 4.97 | 5.17 | 5.11 | 5.06 |

Other pairs:

| Pair | Ratio | Notes |
|---|---|---|
| white on primary / hover / active | 9.45 / 11.19 / 13.14 | Buttons |
| white at 80 / 75 / 70 / 65 / 60% on primary | 6.70 / 6.10 / 5.53 / 4.99 / 4.53 | Existing patient-app cards stay AA |
| white on primary/80 blended over mist (shadcn hover) | 5.59 | |
| white on danger / danger-hover | 5.93 / 7.38 | |
| primary on mint (chips) | 7.91 | |
| warning-ink on warning-bg | 6.48 | Elevated chip on light |
| danger on danger-bg | 5.44 | Field error, alert |
| success on success-bg | 5.30 | |
| warning-ink on sand | 6.33 | Sand chip |
| ink-2 / muted on glass (white 88% over a mid-tone photo) | 7.36 / 5.16 | Glass cards |
| signal dot `#1E9563` on white / mist / wash / mint / sand | 3.79 / 3.56 / 3.37 / 3.18 / 3.31 | Non-text, at least 3:1 |
| input border on white / mist / wash | 3.53 / 3.31 / 3.14 | Fields only sit on white cards |
| input-hover on white | 5.30 | |
| focus ring (primary) on mist / white / sand | 8.85 / 9.45 / 8.24 | |
| on-pine / on-pine-2 / on-pine-3 on pine | 14.89 / 9.41 / 6.59 | |
| same on pine-raised | 12.95 / 8.18 / 5.73 | |
| pine-accent (serif phrase on dark) on pine / raised | 9.03 / 7.86 | |
| ring-on-dark on pine | 9.06 | |
| trace on pine / raised | 9.03 / 7.85 | |
| amber-on-dark on its 14% chip over pine-raised | 6.20 | Elevated chip on dark |
| on-pine-2 on white/8 over pine-raised | 6.38 | Normal chip on dark |
| text on the CTA glow (pine + teal 35%): on-pine / on-pine-2 / pine-accent | 11.45 / 7.23 / 6.94 | |
| ink on the inverse button (`#F1F6F3`) | 15.44 | |
| trace logo dot on the teal-deep tile | 5.24 | |
| glyph rose on blush / amber on sand / teal on mint / sky glyph on sky | 4.10 / 4.07 / 5.76 / 5.23 | Illustrations, at least 3:1 |
| chart-1..5 on white | 9.45 / 4.22 / 4.91 / 3.62 / 3.15 | Graphics, at least 3:1 |
| monitor dim text, new `#8F8F89`, on `#0a0a0a` / `#0A221E` | 6.09 / 5.12 | Was 3.86 |
| monitor LIVE text `#8FE3BF` on its chip | 10.73 | Replaces coral |
| sage `#8DB5A4` on white | 2.26 | **Decoration only, never text** |
| page vs wash / page vs sand | 1.05 / 1.07 | Too close on cheap LCDs, so every band change also gets a hairline (section 6.0) |

Rules that follow from the table:
- `text-signal` is never used for words. Use `text-signal-ink`.
- Never put `sage` or any glyph colour on text.
- Inputs only sit on `bg-card` (white).
- Muted text is fine on every tint. On deep panels use `text-muted-foreground` (it re-scopes to on-pine-3).

## 3. Typography

### 3.1 `apps/web/src/app/fonts.ts` (new, Unit 0)

```ts
import localFont from "next/font/local";
import { Noto_Sans_Devanagari, Noto_Sans_Kannada } from "next/font/google";

/** Brand face for all UI. */
export const generalSans = localFont({
  variable: "--font-general",
  display: "swap",
  src: [
    { path: "../../public/fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
});

/** Indic glyphs only. Never preloaded; unicode-range means Latin pages never download them. */
export const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-noto-kn",
});

export const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-noto-deva",
});
```

`apps/web/src/app/accent-font.ts` (new, Unit 0). Newsreader lives in its own module: the root layout imports `fonts.ts`, and Next preloads every font declared in a module the root layout imports, so keeping Newsreader there would preload it on every route.

```ts
import { Newsreader } from "next/font/google";

/**
 * Serif accent: one italic phrase per heading. Kept out of ./fonts (which the root layout imports)
 * so that it is preloaded only on the routes that import this module: the landing page (app/page.tsx)
 * and the sign-in pages (via components/auth-layout.tsx). Never in the patient or staff apps.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  preload: true,
  variable: "--font-newsreader",
});
```

Hindi and Marathi share the Devanagari file. Their `lang` values still differ (`hi`, `mr`) so screen readers and OpenType `locl` behave correctly.

### 3.2 `apps/web/src/app/layout.tsx` (Unit 0)

- Remove the inline `localFont` call and import `generalSans, notoKannada, notoDevanagari` from `./fonts`.
- `<html lang="en-IN" className={cn(generalSans.variable, notoKannada.variable, notoDevanagari.variable, "h-full antialiased")}>`. Import `cn` from `@/lib/utils`. Do **not** add `newsreader` here.
- Set `viewport.themeColor` to `"#f6f8f6"`.
- Change the `metadata.description` ending to "...and your report is usually ready within the hour."
- Keep everything else (`AuthProvider`, `TooltipProvider`, `Toaster`).

### 3.3 `apps/web/src/lib/utils.ts` (Unit 0)

`tailwind-merge` doesn't know the custom sizes, so it would drop `text-h1` when it meets `text-foreground`. This was verified: `twMerge("text-h1 text-foreground")` returns `"text-foreground"`.

```ts
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["h1", "h2", "h3", "h4", "cta", "lede", "body", "small", "caption", "stat", "rotator"],
      ease: ["calm", "standard", "exit", "breath"],
      shadow: ["soft", "lift", "glass"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 3.4 Scale and usage

| Utility | Size | Line-height | Where |
|---|---|---|---|
| `text-h1` | 40px at 360 to 60px at 1440 | 1.04, tracking -0.03em, 500 | Hero H1 only |
| `text-cta` | 36 to 60px | 1.04 | Final CTA H2 |
| `text-h2` | 32 to 52px | 1.08, -0.028em | Section titles |
| `text-h3` | 22px | 1.25 | Card titles, tip title |
| `text-h4` | 18px | 1.35 | Small headings, FAQ questions |
| `text-lede` | 18px | 1.6 | Section ledes (`text-foreground-2`) |
| `text-body` | 17px | 1.6 | Paragraphs (`text-foreground-2` for long copy) |
| `text-small` | 15px | 1.55 | Card secondary text, list items |
| `text-caption` | 13px | 1.45 | Sources, meta, captions. Never essential information. |
| `text-xs` | 12px | | Pills only. **Nothing smaller than 12px on the landing page.** |
| `text-stat` | 40 to 48px | 1, tabular | Fact figures |
| `text-rotator` | 24 to 32px | 1.6, 500 | The multilingual line |

Other rules:
- Headings use `font-display`. Numbers use `tabular-nums`.
- Eyebrows are sentence case, 14px/500, in `text-heading-accent`. No all-caps anywhere on the landing page.
- **Accent phrase:** `<span className="font-accent text-[1.06em] font-normal tracking-[-0.01em] text-heading-accent">` (the `font-accent` base rule adds italic). Use at most one per heading. In the hero H1 the accent uses `text-primary` instead.
- **Indic text:**
  - Always put `lang="kn" | "hi" | "mr"` on the element. The global `:lang()` rules pick the font, reset tracking and features, and set line-height 1.6.
  - Never set Indic text in `font-accent`. Never use italic, uppercase, letter-spacing, per-letter animation, `overflow:hidden` clipping or `word-break: break-all` on it.
  - Weight is 500 only (`font-synthesis: none` prevents faux bold).

## 4. Shared primitives and utilities (Unit 0)

### 4.1 `apps/web/src/components/landing/primitives.tsx`: complete new file

The old props `dark` (Section, SectionTitle, IconTile) and `grey` (SectionTitle) are kept as deprecated aliases so the page compiles while the units migrate. New code must not use them.

```tsx
import Link from "next/link";
import type { ComponentProps, CSSProperties, HTMLAttributes, ReactNode } from "react";
import { bookingEnabled } from "@/lib/features";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* Buttons: one shape (pill), one focus recipe, 44px default target          */
/* ------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,transform] duration-160 ease-standard active:scale-[0.98] focus-ring disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  /** 40px visual, 44px hit area. Nav only. */
  sm: "h-10 px-4 text-sm before:absolute before:inset-x-0 before:-inset-y-0.5",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
  secondary: "border border-border-strong bg-card text-foreground hover:border-input hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  /** Light pill for deep pine panels. */
  inverse: "bg-on-pine text-ink hover:bg-white",
};

/** Trailing arrow that nudges 2px on hover. Add to a button or link that ends with an icon. */
export const ARROW_NUDGE =
  "[&>svg:last-child]:transition-transform [&>svg:last-child]:duration-240 hover:[&>svg:last-child]:translate-x-0.5";

export function buttonClass(variant: ButtonVariant = "primary", className?: string, size: ButtonSize = "md") {
  return cn(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className);
}

/** Booking CTAs open the booking flow, or the callback form while booking is switched off. */
export function bookHref(query?: string) {
  if (!bookingEnabled) return "#callback";
  return query ? `/app/book?${query}` : "/app/book";
}

export const BOOK_LABEL = bookingEnabled ? "Book a check-up" : "Request a callback";
/** Short per-row CTA (programme cards, pricing rows). */
export const ROW_CTA_LABEL = bookingEnabled ? "Book" : "Enquire";

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, className, size)} {...props} />;
}

/* ------------------------------------------------------------------------- */
/* Scroll reveal (server-safe helper; the observer lives in reveal.tsx)      */
/* ------------------------------------------------------------------------- */

/** Spread on an element to fade it up once when it scrolls into view. `i` staggers by 70ms (max 6). */
export function revealProps(i = 0) {
  return { "data-nv-reveal": "", style: { "--i": Math.min(Math.max(i, 0), 6) } as CSSProperties };
}

/* ------------------------------------------------------------------------- */
/* Layout                                                                    */
/* ------------------------------------------------------------------------- */

/** Page-width container: 1200px content, 20px gutters on phones, 24px from sm. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1248px] px-5 sm:px-6", className)}>{children}</div>;
}

export type SectionTone = "default" | "white" | "wash" | "sand" | "deep";

const SECTION_TONE: Record<SectionTone, string> = {
  default: "bg-background",
  white: "bg-card",
  wash: "bg-wash",
  sand: "bg-sand",
  deep: "theme-pine",
};

/** Section rhythm: 64px mobile, 96px desktop. `deep` scopes the pine tokens. */
export function Section({
  id,
  tone = "default",
  divider = "none",
  titleId,
  className,
  children,
  dark,
}: {
  id?: string;
  tone?: SectionTone;
  /** Hairline(s) at the band edge. Use whenever two bands of similar lightness touch. */
  divider?: "none" | "top" | "bottom" | "both";
  /** id of the section's h2, wired to aria-labelledby. */
  titleId?: string;
  className?: string;
  children: ReactNode;
  /** @deprecated use tone="deep" */
  dark?: boolean;
}) {
  const t = dark ? "deep" : tone;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "scroll-mt-16 py-16 lg:py-24",
        SECTION_TONE[t],
        divider === "top" && "border-t border-border",
        divider === "bottom" && "border-b border-border",
        divider === "both" && "border-y border-border",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Small sentence-case label above a heading. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-sm font-medium text-heading-accent", className)}>{children}</p>;
}

/** Section heading: optional eyebrow, title, optional serif accent phrase, optional lede. */
export function SectionTitle({
  eyebrow,
  title,
  accent,
  grey,
  lede,
  align = "left",
  id,
  reveal = true,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Serif italic phrase after the title, at most one per heading. */
  accent?: ReactNode;
  /** @deprecated alias of accent */
  grey?: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  /** Put the same id in <Section titleId>. */
  id?: string;
  reveal?: boolean;
  className?: string;
  /** @deprecated no-op: .theme-pine recolours automatically */
  dark?: boolean;
}) {
  const acc = accent ?? grey;
  return (
    <div
      {...(reveal ? revealProps(0) : {})}
      className={cn("flex flex-col", align === "center" && "items-center text-center", className)}
    >
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h2 id={id} className="font-display max-w-[22ch] text-h2 text-balance text-foreground">
        {title}
        {acc && (
          <>
            {" "}
            <span className="font-accent text-[1.06em] font-normal tracking-[-0.01em] text-heading-accent">{acc}</span>
          </>
        )}
      </h2>
      {lede && <p className="mt-5 max-w-[56ch] text-lede text-foreground-2">{lede}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* ------------------------------------------------------------------------- */

export type SurfaceTone = "card" | "wash" | "mint" | "sand" | "blush" | "sky";

const SURFACE_TONE: Record<SurfaceTone, string> = {
  card: "bg-card shadow-xs",
  wash: "bg-wash",
  mint: "bg-mint",
  sand: "bg-sand",
  blush: "bg-blush",
  sky: "bg-sky",
};

const SURFACE_PAD = { none: "", sm: "p-4", md: "p-6 lg:p-7", lg: "p-6 sm:p-8" } as const;
const SURFACE_RADIUS = { xl: "rounded-xl", "2xl": "rounded-2xl", "3xl": "rounded-3xl" } as const;

/** The one card recipe: 1px hairline, tinted shadow, concentric radius. */
export function Surface({
  as = "div",
  tone = "card",
  radius = "2xl",
  padding = "md",
  interactive = false,
  className,
  children,
  ...rest
}: {
  as?: "div" | "article" | "li" | "section" | "figure";
  tone?: SurfaceTone;
  radius?: keyof typeof SURFACE_RADIUS;
  padding?: keyof typeof SURFACE_PAD;
  /** Hover: border strengthens, card rises 2px, a lift shadow fades in (the shadow itself is never animated). */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "relative border border-border",
        SURFACE_TONE[tone],
        SURFACE_RADIUS[radius],
        SURFACE_PAD[padding],
        interactive &&
          "transition-[transform,border-color] duration-240 ease-standard after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 after:shadow-lift after:transition-opacity after:duration-240 hover:-translate-y-0.5 hover:border-border-strong hover:after:opacity-100",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Frosted card that floats over photography. Always light, even inside a pine section. */
export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "theme-light rounded-2xl border border-white/60 bg-white/88 px-3.5 py-3 text-[0.8125rem] leading-[1.4] text-foreground shadow-glass backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Live indicator. Static by default; `pulse` adds the slow ring (counts as a loop). */
export function LiveDot({ className, pulse = false }: { className?: string; pulse?: boolean }) {
  return <span aria-hidden className={cn("live-dot text-signal", !pulse && "[&::after]:hidden", className)} />;
}

export type IconTileTone = "mint" | "outline" | "inverse";

const ICON_TILE_SIZE = {
  sm: "size-8 rounded-lg [&_svg]:size-4",
  md: "size-10 rounded-xl [&_svg]:size-[18px]",
  lg: "size-12 rounded-xl [&_svg]:size-5",
} as const;

const ICON_TILE_TONE: Record<IconTileTone, string> = {
  mint: "bg-mint text-primary",
  outline: "border border-border bg-card text-foreground",
  inverse: "border border-border bg-white/6 text-foreground",
};

export function IconTile({
  size = "md",
  tone = "mint",
  className,
  children,
  dark,
}: {
  size?: keyof typeof ICON_TILE_SIZE;
  tone?: IconTileTone;
  className?: string;
  children: ReactNode;
  /** @deprecated use tone="inverse" */
  dark?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        ICON_TILE_SIZE[size],
        ICON_TILE_TONE[dark ? "inverse" : tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type PillTone = "neutral" | "mint" | "sand" | "warning" | "danger" | "success" | "outline" | "inverse";

const PILL_TONE: Record<PillTone, string> = {
  neutral: "bg-wash text-ink-2",
  mint: "bg-mint text-primary",
  sand: "bg-sand text-warning-ink",
  warning: "bg-warning-bg text-warning-ink",
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  outline: "border border-border bg-card text-foreground",
  inverse: "bg-white/8 text-foreground-2",
};

/** Badge / chip. 24px (sm) or 32px (md). Text is never below 12px. */
export function Pill({
  tone = "neutral",
  size = "sm",
  className,
  children,
  ...rest
}: {
  tone?: PillTone;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        size === "sm" ? "h-6 px-2.5 text-xs" : "h-8 px-3 text-[0.8125rem]",
        PILL_TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tracking-wide text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Rupee formatting with the Indian grouping. */
export function inr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
```

Usage rules:
- **Hover transitions:** never put `data-nv-reveal` (or `revealProps`) on an element that also has its own hover transform or transition. The reveal transition-delay would delay the hover. Wrap it instead: reveal goes on the `<li>`, the hover goes on the inner card or link.
- **Focus:** every interactive element uses `focus-ring` and must not also carry `outline-none`. The only exceptions are form fields (section 9).

### 4.2 `apps/web/src/components/landing/reveal.tsx` (new)

Attributes are namespaced `nv-` so they never collide with third-party or framework attributes. Content stays visible without JavaScript. Nothing is hidden until this observer has run, and anything already on screen (or above it) is marked revealed before hiding switches on. So there is no flash, no layout shift, and no failsafe timer to tune.

```tsx
"use client";

import { useEffect } from "react";

const SELECTOR = "[data-nv-reveal]:not([data-nv-revealed])";

/**
 * One observer for the whole landing page. Elements carry `data-nv-reveal` (see revealProps).
 * Hiding is CSS-only and applies only once <html data-nv-reveal-ready> is set here, and only under
 * prefers-reduced-motion: no-preference (landing.css). Rendered once by app/page.tsx.
 * Elements that client components add after mount are picked up too, so nothing stays hidden.
 */
export function RevealObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-nv-revealed", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    // On or above the screen: show at once. Below it: reveal when scrolled into view.
    const track = (el: Element) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.setAttribute("data-nv-revealed", "");
      else io.observe(el);
    };
    document.querySelectorAll(SELECTOR).forEach(track);
    root.setAttribute("data-nv-reveal-ready", "");

    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) track(node);
          node.querySelectorAll(SELECTOR).forEach(track);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      root.removeAttribute("data-nv-reveal-ready");
    };
  }, []);
  return null;
}
```

### 4.3 `apps/web/src/components/landing/motion.tsx` (new)

This is the global motion preference. It stops every loop app-wide on the landing page and satisfies WCAG 2.2.2 for the mini-trace, the live dots, the ECG monitor and the rotator. `usePrefersReducedMotion` moves here, and `live-feeds.ts` re-exports it (Unit 0 changes that one line). This keeps `device-sim` out of the hero bundle.

```tsx
"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when the visitor asked the OS for reduced motion. False during SSR. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

const KEY = "nivar:motion";
type Choice = "paused" | "playing" | null;
let choice: Choice = null;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "paused" || v === "playing") choice = v;
  } catch {
    /* storage blocked: fall back to the OS preference */
  }
}
function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot(): Choice {
  load();
  return choice;
}
function getServerSnapshot(): Choice {
  return null;
}

export function setMotionPaused(paused: boolean) {
  choice = paused ? "paused" : "playing";
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/**
 * Effective "animations paused" state: the visitor's explicit choice, else the OS reduced-motion
 * preference. Mirrors it onto <html data-motion>, which landing CSS uses to stop .motion-loop.
 */
export function useMotionPaused(): boolean {
  const c = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const reduced = usePrefersReducedMotion();
  const paused = c === null ? reduced : c === "paused";
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "paused" : "playing";
  }, [paused]);
  return paused;
}

/**
 * The one control for all landing motion.
 * icon: 32px circle (44px hit area) for the rotator. compact: "Pause"/"Play" for the live dashboard.
 * pill: full label for the footer.
 */
export function MotionToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "compact" | "pill";
  className?: string;
}) {
  const paused = useMotionPaused();
  const label = paused ? "Play animations" : "Pause animations";
  const Icon = paused ? Play : Pause;
  const base =
    "relative inline-flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-foreground transition-colors duration-160 hover:bg-muted focus-ring";
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => setMotionPaused(!paused)}
        aria-label={label}
        title={label}
        className={cn(base, "size-8 before:absolute before:-inset-1.5 [&_svg]:size-3.5", className)}
      >
        <Icon aria-hidden />
      </button>
    );
  }
  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => setMotionPaused(!paused)}
        className={cn(
          base,
          "h-9 gap-1.5 px-3 text-[0.8125rem] font-medium before:absolute before:inset-x-0 before:-inset-y-1 [&_svg]:size-3.5",
          className,
        )}
      >
        <Icon aria-hidden />
        <span>{paused ? "Play" : "Pause"}</span>
        <span className="sr-only"> animations</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setMotionPaused(!paused)}
      className={cn(base, "h-11 gap-2 px-4 text-sm font-medium [&_svg]:size-4", className)}
    >
      <Icon aria-hidden />
      {label}
    </button>
  );
}
```

In `apps/web/src/components/landing/live-feeds.ts`, delete the local `REDUCED_QUERY`, `subscribeReduced` and `usePrefersReducedMotion` and add `export { usePrefersReducedMotion } from "./motion";`. Nothing else in that file changes. If `useSyncExternalStore` becomes unused there, remove it from the import.

### 4.4 `apps/web/src/lib/site-facts.ts` (new)

This is the single source for operational claims. Every landing, login and FAQ string that states hours, report time, payment or emergency numbers reads from here. The founder confirms these values (section 13).

```ts
/** Operational facts shown to patients. Change them here only. */
export const SITE = {
  legalName: "Nivar Health",
  city: "Bangalore",
  hours: { short: "7 am to 9 pm", inSentence: "between 7 am and 9 pm" },
  callbackWithin: "30 minutes",
  report: {
    promise: "usually within the hour",
    chip: "Usually within the hour",
    strip: "Report usually within the hour",
  },
  payment: {
    line: "Pay securely in the app by UPI, card or net banking.",
    faq: "In the app, by UPI, card or net banking, when you confirm your booking. If the nurse does not arrive, we refund you in full.",
  },
  cancellation: "Free cancellation until the nurse sets off",
  /** Set when a real number exists. UI hides phone and WhatsApp entry points while null. */
  phone: null as { display: string; tel: string } | null,
  whatsapp: null as { display: string; href: string } | null,
  emergency: {
    short: "In an emergency, call 112 (or 108 for an ambulance).",
    full: "Nivar is not an emergency service. In an emergency, call 112 (or 108 for an ambulance).",
  },
} as const;
```

### 4.5 `apps/web/src/components/landing/l10n.ts` (new): the verified strings

Paste this **byte for byte**. It was generated from the reviewed strings file, not retyped. Section 7 explains how the strings were chosen.

```ts
/**
 * Multilingual strings for the landing page.
 * Source: Nivar l10n set, reviewed by two native-speaker reviewers (October 2026).
 * Every string is NFC. Devanagari nukta is base letter + U+093C (never U+0958-U+095F).
 * Do not edit, retype or machine-translate these strings without a new native review.
 */
export type LangCode = "en-IN" | "kn" | "hi" | "mr";
export type IndicLang = Exclude<LangCode, "en-IN">;
export type Phrase = { lang: LangCode; text: string };

const nfc = (s: string) => s.normalize("NFC");

/** Language names in their own script, for chips and selects. Rotation order: en, kn, hi, mr. */
export const LANGUAGES = [
  { lang: "en-IN", endonym: "English", english: "English" },
  { lang: "kn", endonym: nfc("ಕನ್ನಡ"), english: "Kannada" },
  { lang: "hi", endonym: nfc("हिंदी"), english: "Hindi" },
  { lang: "mr", endonym: nfc("मराठी"), english: "Marathi" },
] as const satisfies readonly { lang: LangCode; endonym: string; english: string }[];

/** Hero rotator: what every family says at the end of a call. Same meaning in all four. */
export const TAKE_CARE: readonly Phrase[] = [
  { lang: "en-IN", text: "Take care of your health." },
  { lang: "kn", text: nfc("ಆರೋಗ್ಯ ಜೋಪಾನ") },
  { lang: "hi", text: nfc("सेहत का ख़याल रखिए") },
  { lang: "mr", text: nfc("तब्येतीची काळजी घ्या") },
];

/** Static sign-off on the final CTA. */
export const STAY_HEALTHY: readonly Phrase[] = [
  { lang: "en-IN", text: "Stay healthy" },
  { lang: "kn", text: nfc("ಆರೋಗ್ಯವಾಗಿರಿ") },
  { lang: "hi", text: nfc("स्वस्थ रहिए") },
  { lang: "mr", text: nfc("निरोगी राहा") },
];

/** Static eyebrow of the Everyday care section: each language's own "health is wealth" saying. */
export const PROVERBS: readonly (Phrase & { lang: IndicLang; gloss: string })[] = [
  { lang: "kn", text: nfc("ಆರೋಗ್ಯವೇ ಭಾಗ್ಯ"), gloss: "Health itself is fortune." },
  { lang: "hi", text: nfc("पहला सुख निरोगी काया"), gloss: "The first happiness is a healthy body." },
  { lang: "mr", text: nfc("आरोग्य हीच खरी संपत्ती"), gloss: "Health is the true wealth." },
];
```

Code-point audit (for review and for the acceptance check in section 12):

| Constant | lang | Text | Code points | Sequence |
|---|---|---|---|---|
| LANGUAGES kn | `kn` | ಕನ್ನಡ | 5 | U+0C95 U+0CA8 U+0CCD U+0CA8 U+0CA1 |
| LANGUAGES hi | `hi` | हिंदी | 5 | U+0939 U+093F U+0902 U+0926 U+0940 |
| LANGUAGES mr | `mr` | मराठी | 5 | U+092E U+0930 U+093E U+0920 U+0940 |
| TAKE_CARE kn | `kn` | ಆರೋಗ್ಯ ಜೋಪಾನ | 12 | U+0C86 U+0CB0 U+0CCB U+0C97 U+0CCD U+0CAF U+0020 U+0C9C U+0CCB U+0CAA U+0CBE U+0CA8 |
| TAKE_CARE hi | `hi` | सेहत का ख़याल रखिए | 18 | U+0938 U+0947 U+0939 U+0924 U+0020 U+0915 U+093E U+0020 U+0916 U+093C U+092F U+093E U+0932 U+0020 U+0930 U+0916 U+093F U+090F |
| TAKE_CARE mr | `mr` | तब्येतीची काळजी घ्या | 20 | U+0924 U+092C U+094D U+092F U+0947 U+0924 U+0940 U+091A U+0940 U+0020 U+0915 U+093E U+0933 U+091C U+0940 U+0020 U+0918 U+094D U+092F U+093E |
| STAY_HEALTHY kn | `kn` | ಆರೋಗ್ಯವಾಗಿರಿ | 12 | U+0C86 U+0CB0 U+0CCB U+0C97 U+0CCD U+0CAF U+0CB5 U+0CBE U+0C97 U+0CBF U+0CB0 U+0CBF |
| STAY_HEALTHY hi | `hi` | स्वस्थ रहिए | 11 | U+0938 U+094D U+0935 U+0938 U+094D U+0925 U+0020 U+0930 U+0939 U+093F U+090F |
| STAY_HEALTHY mr | `mr` | निरोगी राहा | 11 | U+0928 U+093F U+0930 U+094B U+0917 U+0940 U+0020 U+0930 U+093E U+0939 U+093E |
| PROVERBS kn | `kn` | ಆರೋಗ್ಯವೇ ಭಾಗ್ಯ | 14 | U+0C86 U+0CB0 U+0CCB U+0C97 U+0CCD U+0CAF U+0CB5 U+0CC7 U+0020 U+0CAD U+0CBE U+0C97 U+0CCD U+0CAF |
| PROVERBS hi | `hi` | पहला सुख निरोगी काया | 20 | U+092A U+0939 U+0932 U+093E U+0020 U+0938 U+0941 U+0916 U+0020 U+0928 U+093F U+0930 U+094B U+0917 U+0940 U+0020 U+0915 U+093E U+092F U+093E |
| PROVERBS mr | `mr` | आरोग्य हीच खरी संपत्ती | 22 | U+0906 U+0930 U+094B U+0917 U+094D U+092F U+0020 U+0939 U+0940 U+091A U+0020 U+0916 U+0930 U+0940 U+0020 U+0938 U+0902 U+092A U+0924 U+094D U+0924 U+0940 |

### 4.6 Brand: `components/brand/logo.tsx`, `components/brand/ecg-line.tsx`, `app/icon.svg` (Unit 0)

- **`LogoMark`:**
  - default: tile `#0E4F45`, stroke `#FFFFFF`, dot `#5FD6A6`.
  - `light` variant (used on pine): tile `#FFFFFF`, stroke `#0D2420`, dot `#1E9563`.
  - These are the only hex literals allowed outside globals, because an SVG mark must render the same in favicons and print.
- **`Logo` wordmark:** default `text-ink`, light `text-on-pine`. The period keeps `text-signal`.
- **`app/icon.svg`:** `<rect ... fill="#0E4F45"/>`, stroke `#FFFFFF`, circle `#5FD6A6`.
- **`EcgLine`:** add the prop `draw?: boolean` (default `false`).
  - When `draw` is true it renders **one** path with `pathLength={1}`, `className={cn(strokeClassName, "ecg-draw")}`, `strokeWidth={thin ? 1.5 : 2}`, the same join, cap and `vectorEffect`, and no faint underlay or sweep.
  - `landing.css` animates `.ecg-draw` once when an ancestor has `data-nv-revealed`.
  - All existing props and defaults are unchanged.

## 5. Motion

### 5.1 Principles

1. **Breath pace:**
   - Entrances: 600ms on `--curve-calm`.
   - UI state changes: 160 to 240ms on `--curve-standard`.
   - Exits: 450ms on `--curve-exit`.
   - Loops: on `--curve-breath`.
   - Stagger: 70ms, capped at 6 items.
2. **Properties:** animate only `transform`, `opacity` and SVG `stroke-dashoffset`. Never animate blur, filters, box-shadow, height or layout. Never overshoot or bounce.
3. **Budget:** at most one ambient loop per viewport (the hero ECG card counts as one, with its heart in sync), plus the language rotator, plus at most one pulsing live dot. Every other dot is static. Rest poses are designed: every loop's base style is its rest pose, so stopping it (`animation: none`) looks intentional.
4. **Stopping motion:**
   - Every loop carries `.motion-loop` (or is `.live-dot::after`). Under `html[data-motion="paused"]` or `prefers-reduced-motion: reduce` it stops.
   - JavaScript motion (rotator, ECG canvas) reads `useMotionPaused()`.
   - One-shot animations still run when paused (they finish within 2s), and collapse to their end state under reduced motion.
5. **LCP:** the H1, the hero lede and the hero photo never animate and never start at opacity 0.
6. **Banned:** count-up numbers, auto-advancing carousels, parallax, scroll-jacking, scroll-scrubbed reveals, red pulsing, multiple heartbeats out of sync.

### 5.2 `apps/web/src/components/landing/landing.css`: complete new file (Unit 0)

```css
/* Landing motion. Calm and one-shot by default. Loops carry .motion-loop so the global
   "Pause animations" control and prefers-reduced-motion stop them (globals.css).
   One-shots use fill-mode `backwards`: the element's base style is always the final pose,
   so without JS (no data-nv-revealed) everything simply shows at rest. */

@keyframes draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@keyframes landing-reveal {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
@keyframes landing-trace {
  from { transform: translateX(0); }
  to { transform: translateX(-240px); }
}
@keyframes landing-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes lubdub {
  0% { transform: scale(1); }
  10% { transform: scale(1.12); }
  20% { transform: scale(1); }
  30% { transform: scale(1.06); }
  42%, 100% { transform: scale(1); }
}
/* Identical copies: a hover wrapper needs its own name so leaving hover never replays the reveal. */
@keyframes lubdub-hover {
  0% { transform: scale(1); }
  10% { transform: scale(1.12); }
  20% { transform: scale(1); }
  30% { transform: scale(1.06); }
  42%, 100% { transform: scale(1); }
}
@keyframes rise-in { from { transform: translateY(var(--rise, 18px)); } to { transform: none; } }
@keyframes rise-in-hover { from { transform: translateY(var(--rise, 8px)); } to { transform: none; } }
@keyframes needle-in { from { transform: rotate(var(--from, -70deg)); } to { transform: none; } }
@keyframes needle-in-hover { from { transform: rotate(var(--from, -14deg)); } to { transform: none; } }
@keyframes ring-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.96); }
}
@keyframes rule-in { from { transform: scaleX(0); } to { transform: none; } }
@keyframes grow-y { from { transform: scaleY(0); } to { transform: none; } }
@keyframes step-dot {
  from { background-color: var(--card); border-color: var(--border); color: var(--muted-foreground); }
}
@keyframes breathe {
  0%, 100% { transform: scale(0.6); }
  50% { transform: scale(1); }
}
@keyframes tip-in {
  from { opacity: 0; transform: translateX(calc(var(--dir, 1) * 8px)); }
  to { opacity: 1; transform: none; }
}

/* ---- 1. Scroll reveal (RevealObserver) ---- */
@media (prefers-reduced-motion: no-preference) {
  html[data-nv-reveal-ready] [data-nv-reveal] {
    transition:
      opacity 600ms var(--curve-calm),
      transform 600ms var(--curve-calm);
    transition-delay: calc(var(--i, 0) * 70ms);
  }
  html[data-nv-reveal-ready] [data-nv-reveal]:not([data-nv-revealed]) {
    opacity: 0;
    transform: translateY(12px);
  }
}
@media print {
  [data-nv-reveal] { opacity: 1 !important; transform: none !important; }
}

/* ---- 2. Hero ---- */
/* Non-LCP hero pieces only (glass cards, small cards, trust row, promises). */
.landing-reveal {
  animation: landing-reveal 600ms var(--curve-calm) both;
  animation-delay: var(--reveal-delay, 0ms);
}
/* 4 beats per 240-unit strip at 72 bpm: 4 x 833.3ms = 3333ms. Keep the "72 bpm" label in sync. */
.landing-trace {
  animation: landing-trace 3333ms linear infinite;
}
/* One lub-dub per beat (833ms), phased so the peak lands as each R wave enters the card's right edge. */
.hero-heart {
  display: inline-flex;
  transform-origin: center;
  animation: lubdub 833ms var(--curve-standard) -610ms infinite;
}
.landing-progress {
  transform-origin: left center;
  animation: landing-progress 1200ms var(--curve-calm) 500ms both;
}

/* ---- 3. Multilingual rotator (health-words.tsx) ---- */
.hw-cell {
  display: grid;
}
.hw-item {
  grid-area: 1 / 1;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transform: translateY(0.35em);
  transition:
    opacity 450ms var(--curve-exit),
    transform 450ms var(--curve-exit),
    visibility 0s linear 450ms;
}
.hw-item[data-state="active"] {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition:
    opacity 700ms var(--curve-calm) 150ms,
    transform 700ms var(--curve-calm) 150ms,
    visibility 0s;
}
.hw-item[data-state="leaving"] {
  opacity: 0;
  visibility: visible;
  transform: translateY(-0.35em);
}
.hw-beat path {
  stroke-dasharray: 1;
}
.hw-beat[data-draw] path {
  animation: draw 900ms var(--curve-calm) both;
}

/* ---- 4. Programme glyphs (programme-glyphs.tsx). Card link carries .group. ---- */
.pg-glyph .pg-heart,
.pg-glyph .pg-heart-h,
.pg-glyph .pg-rings-h {
  transform-box: fill-box;
  transform-origin: center;
}
.pg-glyph .pg-needle,
.pg-glyph .pg-needle-h {
  transform-box: view-box;
  transform-origin: 56px 74px;
}
.pg-glyph .pg-arc {
  stroke-dasharray: 1;
}
[data-nv-revealed] .pg-heart { animation: lubdub 900ms var(--curve-standard) 300ms backwards; }
[data-nv-revealed] .pg-level { --rise: 18px; animation: rise-in 1400ms var(--curve-calm) 200ms backwards; }
[data-nv-revealed] .pg-arc {
  animation: draw 1200ms var(--curve-calm) backwards;
  animation-delay: calc(200ms + var(--k, 0) * 120ms);
}
[data-nv-revealed] .pg-needle { --from: -70deg; animation: needle-in 900ms var(--curve-calm) 250ms backwards; }
.group:is(:hover, :focus-visible) .pg-heart-h { animation: lubdub-hover 900ms var(--curve-standard); }
.group:is(:hover, :focus-visible) .pg-level-h { --rise: 8px; animation: rise-in-hover 700ms var(--curve-calm); }
.group:is(:hover, :focus-visible) .pg-rings-h { animation: ring-breathe 900ms var(--curve-breath); }
.group:is(:hover, :focus-visible) .pg-needle-h { --from: -14deg; animation: needle-in-hover 600ms var(--curve-calm); }

/* ---- 5. How it works connector (how-it-works.tsx). data-nv-reveal sits on the <ol>. ---- */
.hiw-line path {
  stroke-dasharray: 1;
}
[data-nv-revealed] .hiw-line path { animation: draw 1600ms var(--curve-calm) 200ms backwards; }
[data-nv-revealed] .hiw-vline {
  transform-origin: top;
  animation: grow-y 1600ms var(--curve-calm) 200ms backwards;
}
[data-nv-revealed] .hiw-dot {
  animation: step-dot 400ms var(--curve-standard) backwards;
  animation-delay: calc(200ms + var(--step, 0) * 400ms);
}

/* ---- 6. Fact figure underline (health-facts.tsx) ---- */
.fact-rule {
  transform-origin: left center;
}
[data-nv-revealed] .fact-rule { animation: rule-in 600ms var(--curve-calm) 250ms backwards; }

/* ---- 7. Breathing guide (breathing-card.tsx): 5s in, 5s out, 6 breaths = 1 minute ---- */
.breath-disc {
  transform: scale(0.6);
  transform-origin: center;
}
.breath[data-state="running"] .breath-disc {
  animation: breathe 10s var(--curve-breath) 6;
}
@media (prefers-reduced-motion: reduce) {
  .breath-disc { animation: none !important; transform: scale(0.8); }
}

/* ---- 8. Tip deck (tip-deck.tsx) ---- */
.tip-in {
  animation: tip-in 240ms var(--curve-standard) both;
}

/* ---- 9. Callback success check (callback-form.tsx) ---- */
.success-ring {
  stroke-dasharray: 1;
  animation: draw 600ms var(--curve-calm) both;
}
.success-check {
  stroke-dasharray: 1;
  animation: draw 400ms var(--curve-calm) 550ms both;
}

/* ---- 10. ECG hairline that draws once (EcgLine draw, final CTA) ---- */
.ecg-draw {
  stroke-dasharray: 1;
}
[data-nv-revealed] .ecg-draw { animation: draw 1800ms var(--curve-calm) 200ms backwards; }

/* ---- 11. Nav link underline + scroll-spy (site-nav.tsx) ---- */
.nav-link {
  position: relative;
}
.nav-link::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: -6px;
  height: 2px;
  border-radius: 2px;
  background: var(--primary);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 240ms var(--curve-standard);
}
.nav-link:hover::after,
.nav-link[aria-current="true"]::after {
  transform: scaleX(1);
}
```

### 5.3 Motion inventory

| # | Name | Where | Conveys | Trigger | Duration and curve | Loop? | Paused / reduced motion |
|---|---|---|---|---|---|---|---|
| 1 | Scroll reveal | Section titles, card groups (never hero) | Content settling | Element enters the viewport | 600ms calm, 12px rise, 70ms stagger | Once | Not hidden; shows instantly |
| 2 | Hero arrival | Glass cards, ETA and price cards, trust row, promises | Arrival | Load | 600ms calm, delays 200 to 500ms | Once | Instant |
| 3 | Mini-trace | Hero ECG glass card | A live heart at 72 bpm | Load | 3333ms linear | Loop (`.motion-loop`) | Static strip |
| 4 | Hero heart | Next to "72 bpm" | Heartbeat, in sync with the trace | Load | 833ms lub-dub | Loop (`.motion-loop`) | Still |
| 5 | ETA fill | Hero "Nurse at your door" card | Nurse on the way | Load | 1200ms, 500ms delay, to 62% | Once | Filled |
| 6 | Language rotator | Under the H1 | "Take care of your health" in four languages | Timer (5s dwell) | Out 450ms exit, in 700ms calm (150ms later), 0.35em rise | JS loop, auto-pauses | No autoplay; chips switch instantly |
| 7 | Heartline | Left of the rotator phrase | A pulse between languages | Each language change | 900ms draw | Once per change | Static |
| 8 | Heart glyph | Heart Check card | Heartbeat | Reveal; hover or focus | 900ms lub-dub | Once | Final pose |
| 9 | Drop level | Diabetes Care card | Sugar level settling | Reveal; hover or focus | 1400ms / 700ms rise | Once | Final pose |
| 10 | Vitals rings | Complete Home Check-up card | Every vital covered | Reveal (arcs draw, 120ms stagger); hover (breathe) | 1200ms / 900ms | Once | Final pose |
| 11 | BP gauge needle | Essential Vitals card | A reading settling | Reveal; hover or focus | 900ms / 600ms, no overshoot | Once | Final pose |
| 12 | ECG connector | How it works | The visit as one heartbeat | Reveal | 1600ms draw; dots fill at 400ms stagger | Once | Drawn |
| 13 | Fact rule | Fact figures | Emphasis | Reveal | 600ms scaleX | Once | Drawn |
| 14 | Live ECG monitor | Live dashboard (canvas) | Real simulated stream | In view | rAF | JS loop | Freezes on the last frame; never starts under reduced motion until Play |
| 15 | Monitor LIVE dot | Monitor header | Live | Streaming | 2.4s pulse | Loop (`live-dot`) | Static |
| 16 | Card lift | Programme cards, interactive Surfaces | Affordance | Hover | 240ms, -2px, lift shadow fades in | n/a | Instant, colour only |
| 17 | Button press | All pill buttons | Feedback | Active | 160ms, scale .98 | n/a | Instant |
| 18 | Nav underline | Desktop nav | Hover; current section | Hover, scroll-spy | 240ms scaleX | n/a | Instant |
| 19 | Tip swap | Tip deck | Next tip | Click | 240ms fade and 8px slide in the direction of travel | n/a | Instant |
| 20 | Breathing | Everyday care | Breathe in and out | **Visitor presses Start** | 10s per breath (5 in, 5 out) × 6 | Finite (60s) | No scaling; text and count only |
| 21 | Success check | Callback success | Done | Submit success | 600ms ring, then 400ms check | Once | Final pose |
| 22 | CTA ECG hairline | Final CTA panel | Heartbeat signature | Reveal | 1800ms draw | Once | Drawn |
| 23 | FAQ panel | Accordion | Open and close | Click | Existing base-ui height animation | n/a | Instant |

Per-viewport audit:
- Hero: 3+4 (one group) plus 6.
- Live: 14 plus 15.
- Every other viewport: none, or one-shots only.
- Under `--reduced`, the screenshot tool must show no moving element.

## 6. Sections, in final page order

### 6.0 Page order and band rhythm

| # | Section | Anchor | Component (file) | Tone | Divider | Unit |
|---|---|---|---|---|---|---|
| 1 | Nav | n/a | `SiteNav` (`site-nav.tsx`) | translucent mist | bottom on scroll | 1 |
| 2 | Hero | n/a | `Hero` (`hero.tsx`) | default (mist) plus a sage glow | none | 1 |
| 3 | Reassurance strip | n/a | `ReassuranceStrip` (`reassurance.tsx`) | white | both | 1 |
| 4 | Programmes | `#what-we-test` | `Programmes` (`programmes.tsx`) | default | none | 2 |
| 5 | How it works (+ soft CTA) | `#how-it-works` | `HowItWorks` (`how-it-works.tsx`) | wash | both | 2 |
| 6 | Health, in numbers | `#health-facts` (new) | `HealthFacts` (`health-facts.tsx`) | default | none | 3 |
| 7 | Live (+ soft CTA) | `#live` | `LiveSection` (`live-section.tsx`) | deep (pine) | none | 4 |
| 8 | Devices | `#devices` | `Devices` (`devices.tsx`) | default | none | 5 |
| 9 | Pricing | `#pricing` | `Pricing` (`pricing.tsx`) | wash | both | 5 |
| 10 | Families | `#for-families` | `Families` (`families.tsx`) | default | none | 5 |
| 11 | Everyday care | `#health-tips` (new) | `EverydayCare` (`everyday-care.tsx`) | sand | both | 3 |
| 12 | Doctors | `#doctors` | `Doctors` (`doctors.tsx`) | default | none | 6 |
| 13 | FAQ | `#faq` | `FaqSection` (`faq-section.tsx`) | default | top | 6 |
| 14 | Callback | `#callback` | `Callback` (`closing.tsx`) | wash | both | 7 |
| 15 | Final CTA | n/a | `FinalCta` (`closing.tsx`) | default, with an inset pine panel | none | 7 |
| 16 | Footer | n/a | `SiteFooter` (`closing.tsx`) | default | top | 7 |

Rules for every section:
- Wrap in `<Section id titleId tone divider>` and put the same id on `SectionTitle id` (or on the h2). The id is `${anchor}-title`, for example `pricing-title`.
- Content goes in `<Container>`.
- The title-to-content gap is `mt-12 lg:mt-14`.
- Card groups use `revealProps(i)` on each `<li>` (or one `revealProps` on the group).
- **Accent phrase use** is deliberately varied to break the monotony the audit found:
  - **With accent:** Programmes, How it works, Live, Devices, Pricing, Families, Everyday care, Doctors, FAQ, Callback, Final CTA.
  - **With an eyebrow:** How it works, Health, in numbers, Live, Doctors.
  - **Centred:** none. Left alignment stays the professional default; the variety comes from the bands, layouts and eyebrows.

### 6.1 Nav (`site-nav.tsx`, Unit 1)

- **Header:**
  - `sticky top-0 z-50 border-b bg-background/85 backdrop-blur-md transition-colors duration-200 supports-[backdrop-filter]:bg-background/75`.
  - The border is `border-border` once `scrollY > 4`, otherwise `border-transparent` (existing logic).
  - Height `h-16` (unchanged).
- **Logo link:** `-m-1 rounded-lg p-1 focus-ring` (remove `outline-none` and the `ring-*` classes).
- **Desktop links (md+):** the same four `LINKS`.
  - Class: `nav-link rounded-sm text-[0.9375rem] font-medium text-foreground-2 transition-colors hover:text-foreground focus-ring`. Gap `gap-8`.
  - **Scroll-spy:**
    - One `IntersectionObserver` over the four target sections (`document.getElementById(href.slice(1))`) with `rootMargin: "-45% 0px -50% 0px"`.
    - The link whose section is intersecting gets `aria-current="true"`; all others get none.
    - When none is intersecting (hero, other sections), no link is current.
    - The underline comes from `.nav-link` in `landing.css`.
- **Right side**, in order:
  1. If `SITE.phone`: `lg` and up shows `<a href={`tel:${SITE.phone.tel}`}>` with a `Phone` icon and `SITE.phone.display`, styled `buttonClass("ghost", "hidden lg:inline-flex", "sm")`. When null it renders nothing.
  2. `bookingEnabled` "Log in": `buttonClass("ghost", "hidden sm:inline-flex", "sm")`.
  3. CTA: `<ButtonLink href={bookHref()} size="sm">{BOOK_LABEL}</ButtonLink>`.
  4. Mobile trigger: `buttonClass("ghost", "size-11 px-0 md:hidden")`, `aria-label="Open menu"`.
- **Mobile sheet:**
  - `SheetContent side="right" className="w-full gap-0 bg-background sm:max-w-sm"`.
  - Header with the logo and a `border-b border-border` (unchanged).
  - Links: `border-b border-border py-4 text-h4 text-foreground focus-ring` (keep `closeAndScroll`).
  - Then Log in (booking on).
  - Footer block `mt-auto flex flex-col gap-4 p-6`:
    - CTA `<ButtonLink size="lg" className="w-full" ...>` (keep `onClick={closeAndScroll}`).
    - If `SITE.phone`, a secondary full-width call button.
    - `<p className="text-caption text-muted-foreground">{SITE.emergency.short}</p>`.
- The `bookingEnabled` behaviour and the sheet's scroll-after-close logic are unchanged.

### 6.2 Hero (`hero.tsx`, `mini-trace.tsx`, `health-words.tsx`; Unit 1)

**Copy (final):**
- H1: `Your doctor's check-up.`, then a line break, then the accent `At your doorstep.` This replaces "At home, within the hour.", which contradicted the FAQ's "within an hour or two" (section 13).
- Rotator: section 7.
- Lede: `A Nivar nurse brings clinic-grade devices to your home. A Nivar doctor watches every reading live, talks with you on video and sends your report, usually within the hour. From {inr(fromPrice)}, all inclusive.`
- CTAs: `{BOOK_LABEL}` → `bookHref()`; `See how it works` → `#how-it-works`.
- Trust row: `Now in Bangalore` · `Same-day slots` · `{SITE.hours.short}`, with a static `LiveDot` before the first item.
- Promises:
  1. `A Nivar nurse comes to you with a smart ECG and stethoscope`
  2. `A full-time Nivar doctor watches your readings live and consults on video`
  3. `Your report and prescription in the app, usually within the hour`
- Media caption: `Sample app screens. Names and readings are illustrative.`

**Structure.** A single grid with named areas, so the human photo comes straight after the CTAs on mobile and beside the copy on desktop:

```tsx
<section aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-8 pb-16 sm:pt-12 lg:pt-16 lg:pb-24">
  {/* static sage glow behind the photo column (desktop only, decorative) */}
  <div
    aria-hidden
    className="pointer-events-none absolute -top-32 -right-40 -z-10 hidden size-[720px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--sage)_30%,transparent),transparent)] lg:block"
  />
  <Container>
    <div className="grid gap-x-10 gap-y-10 [grid-template-areas:'copy'_'media'_'promises'] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-[auto_1fr] lg:[grid-template-areas:'copy_media'_'promises_media']">
      <div className="[grid-area:copy] lg:pt-4">
        <h1 id="hero-title" className="font-display text-h1 text-foreground">
          Your doctor&apos;s check-up.
          <span className="block font-accent text-[1.04em] font-normal tracking-[-0.01em] text-primary">At your doorstep.</span>
        </h1>
        <HealthWords className="mt-5" />
        <p className="mt-5 max-w-[52ch] text-lede text-foreground-2">…lede…</p>
        <div className="mt-7 grid gap-3 min-[400px]:flex min-[400px]:flex-wrap">
          <ButtonLink href={bookHref()} size="lg">{BOOK_LABEL}</ButtonLink>
          <a href="#how-it-works" className={buttonClass("secondary", undefined, "lg")}>See how it works</a>
        </div>
        <p className="landing-reveal mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-small text-muted-foreground [--reveal-delay:200ms]">
          <LiveDot /> <span>Now in Bangalore</span> <span aria-hidden>·</span> <span>Same-day slots</span> <span aria-hidden>·</span> <span>{SITE.hours.short}</span>
        </p>
      </div>
      <div className="flex flex-col gap-4 [grid-area:media]">…photo, small cards, caption…</div>
      <ul className="landing-reveal max-w-[560px] divide-y divide-border border-y border-border [grid-area:promises] [--reveal-delay:300ms]">…</ul>
    </div>
  </Container>
</section>
```

- **The H1, the lede, the CTAs and the photo are never animated** (this is the LCP fix). Remove both `.landing-reveal` column wrappers that exist today.
- **Promise row:** `flex items-start gap-3.5 py-4 text-body text-foreground`. The icon is `<span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-mint text-primary"><Check className="size-3.5" strokeWidth={2.5} /></span>`.
- **Photo:**
  - Wrapper: `relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-muted lg:aspect-[3/4]`.
  - `<Image src="/img/hero-nurse.jpg" alt="A Nivar nurse placing a smart ECG patch on a woman seated at home" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 480px, (min-width: 640px) 90vw, 100vw" className="object-cover object-[50%_38%] lg:object-center" />`
  - **Remove `priority`.**
- **ECG glass card:** `<GlassCard className="landing-reveal absolute top-3 right-3 w-[184px] [--reveal-delay:350ms] lg:top-4 lg:right-auto lg:left-4 lg:w-[208px]">`. On mobile it sits on the wall at the top right, clear of both faces; on desktop it sits top left, as today.
  - Row 1: `Smart ECG` (font-semibold) and `<LiveDot className="size-1.5" /> Lead II` (muted).
  - `<MiniTrace className="mt-2" />`.
  - Row 3, left: `<span aria-hidden className="hero-heart motion-loop self-center text-glyph-rose"><HeartPulse className="size-3.5" strokeWidth={2.25} /></span> 72 <span className="text-xs font-medium text-muted-foreground">bpm</span>` (0.9375rem semibold tabular).
  - Row 3, right: `<span className="font-medium text-signal-ink">Normal</span>`.
- **Doctor glass card:** `<GlassCard className="landing-reveal absolute right-4 bottom-4 hidden items-center gap-3 pr-4 [--reveal-delay:450ms] sm:flex">` with `Avatar initials="AR"`, `Dr. Ananya Rao` and `Cardiologist, on video` (muted).
- **Small cards:** `grid grid-cols-2 gap-4`.
  - ETA: `theme-pine landing-reveal flex flex-col justify-between gap-6 rounded-2xl p-5 [--reveal-delay:400ms]` containing `<p className="text-caption text-muted-foreground">Nurse at your door</p>`, `in 48 min` (`text-[1.375rem] leading-none font-medium tracking-[-0.02em] tabular-nums`), and a track `mt-3.5 h-1 w-full overflow-hidden rounded-full bg-white/15` with bar `landing-progress h-full w-[62%] rounded-full bg-trace`.
  - Price: `<Surface padding="none" className="landing-reveal flex flex-col justify-between gap-6 p-5 [--reveal-delay:480ms]">` containing `Starts at` (caption, muted), `{inr(fromPrice)}` (same size as the ETA figure) and `all inclusive` (caption, muted).
- **Caption** under the cards: `<p className="text-caption text-muted-foreground">Sample app screens. Names and readings are illustrative.</p>`.
- **`mini-trace.tsx`:**
  - Add `motion-loop` to the `<g className="landing-trace">`.
  - Keep the path and the `text-signal` colour (signal on white glass, 3.79:1).
  - Update the doc comment to "72 bpm: 4 beats per 3.333s strip".

**Fold budget (verify):**
- At 360×640: nav 64, top padding 32, H1 3 lines (about 125), rotator about 98, lede 5 lines (about 156), CTAs 28 + 48. **The bottom of the primary CTA is about 551px, which must be at or below 640.**
- At 390×844: both CTAs and the top of the photo are visible.
- If this fails, reduce in this order: rotator `mt-5` to `mt-4`, lede `mt-5` to `mt-4`, `pt-8` to `pt-6`. Never hide the rotator.

### 6.3 Reassurance strip (`reassurance.tsx`, new, Unit 1)

All five claims already appear elsewhere on the site.

```tsx
export function ReassuranceStrip() // no props
```

- Wrapper: `<section aria-labelledby="trust-title" className="border-y border-border bg-card">` with `<h2 id="trust-title" className="sr-only">Why families trust Nivar</h2>`, then `<Container>`.
- List: `<ul className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-border lg:bg-transparent">`.
- Items: `flex items-start gap-3 bg-card px-4 py-5 text-small font-medium text-foreground lg:px-6 lg:py-6`. The last item also gets `col-span-2 lg:col-span-1`.
- Icons: `size-5 shrink-0 text-teal mt-0.5` (lucide):
  1. `Stethoscope`: Full-time doctors on the Nivar payroll
  2. `BadgeCheck`: Registered doctors, MBBS or higher
  3. `Clock`: `{SITE.report.strip}`
  4. `IndianRupee`: No travel charge or consult fee
  5. `ShieldCheck`: Health data stored in India, never sold
- No motion.

### 6.4 Programmes (`programmes.tsx` + `programme-glyphs.tsx`, Unit 2)

The section is driven by the catalog (`packages`, already sorted by `sortOrder`), so admin edits and deactivations show up. Essential Vitals now appears. Each card uses the catalog `tagline`.

- `<Section id="what-we-test" titleId="what-we-test-title">`.
- `SectionTitle`: title `Programmes designed around`, accent `what you worry about.`, lede `Pick the check-up that matches the question on your mind. Every programme includes the nurse visit, the devices and the doctor's written report.`
- **Grid:** `mt-12 grid gap-5 sm:grid-cols-2 lg:mt-14` plus lg columns by count: `{1: "lg:grid-cols-1 lg:max-w-md", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4"}`, defaulting to `lg:grid-cols-3`.
- **Card** (the whole card is one link):

```tsx
<li key={p.slug} {...revealProps(i)}>
  <Link
    href={bookHref(`package=${p.slug}`)}
    className="group relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xs transition-[transform,border-color] duration-240 ease-standard focus-ring after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 after:shadow-lift after:transition-opacity after:duration-240 hover:-translate-y-0.5 hover:border-border-strong hover:after:opacity-100 lg:min-h-[400px]"
  >
    <div
      aria-hidden
      className="flex h-44 items-center justify-center bg-[linear-gradient(180deg,var(--pg-tint)_0%,var(--card)_100%)] lg:h-48"
      style={{ "--pg-tint": programmeStyle(p.slug).tint } as CSSProperties}
    >
      <ProgrammeGlyph slug={p.slug} className="size-28" />
    </div>
    <div className="flex flex-1 flex-col p-6 pt-3">
      {p.popular && <Pill tone="mint" className="mb-3">Most booked</Pill>}
      <h3 className="text-h3 text-foreground">{p.name}</h3>
      <p className="mt-2 text-small text-foreground-2">{p.tagline}</p>
      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
        <p className="flex items-baseline gap-2 tabular-nums">
          <span className="text-[1.25rem] font-medium tracking-[-0.02em] text-foreground">{inr(p.price)}</span>
          {p.mrp > p.price && (
            <s className="text-small text-muted-foreground"><span className="sr-only">Usual price </span>{inr(p.mrp)}</s>
          )}
        </p>
        <span className="inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-primary [&>svg]:transition-transform [&>svg]:duration-240 group-hover:[&>svg]:translate-x-0.5">
          {ROW_CTA_LABEL}
          <ArrowRight aria-hidden className="size-4" />
        </span>
      </div>
    </div>
  </Link>
</li>
```

- Footnote under the grid (keep the text): `mt-8 max-w-[64ch] text-small text-muted-foreground`. `Every visit is carried out by a certified Nivar nurse and reviewed by a Nivar doctor who is on our payroll. Prices include the home visit and the report. No surge pricing, no hidden consultation fee.`
- Delete the orb code and the hard-coded `PROGRAMMES` array.

**`programme-glyphs.tsx`** is a server component with no hooks. Exports:

```ts
export type GlyphKind = "heart" | "drop" | "rings" | "gauge";
export type ProgrammeStyle = { tint: string; glyph: GlyphKind };
export const PROGRAMME_STYLES: Record<string, ProgrammeStyle> = {
  "essential-vitals": { tint: "var(--sky)", glyph: "gauge" },
  "heart-check": { tint: "var(--blush)", glyph: "heart" },
  "diabetes-care": { tint: "var(--sand)", glyph: "drop" },
  "complete-home-checkup": { tint: "var(--mint)", glyph: "rings" },
};
export const DEFAULT_PROGRAMME_STYLE: ProgrammeStyle = { tint: "var(--wash)", glyph: "rings" };
export function programmeStyle(slug: string): ProgrammeStyle;
export function ProgrammeGlyph({ slug, className }: { slug: string; className?: string }): JSX.Element;
```

Each glyph is an inline `<svg viewBox="0 0 112 112" fill="none" aria-hidden className={cn("pg-glyph", className)}>`. Use exactly these shapes; the motion classes are what `landing.css` animates.

- **heart** (Heart Check): an ECG line crosses a heart. The heart beats once on reveal and once on hover or focus.
  ```tsx
  <g className="pg-heart-h"><g className="pg-heart">
    <path d="M56 90C30 72 16 57 16 40c0-12 9-20 20-20 8 0 15 4 20 12 5-8 12-12 20-12 11 0 20 8 20 20 0 17-14 32-40 50z" fill="#fff" fillOpacity={0.7} stroke="var(--glyph-rose)" strokeWidth={3} strokeLinejoin="round" />
  </g></g>
  <path d="M6 58h28l6-10 8 22 8-32 6 24 5-4h39" stroke="var(--teal)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  ```
- **drop** (Diabetes Care): the fluid level rises and settles. The `clipPath` id is `pg-drop-${slug}`.
  ```tsx
  <defs><clipPath id={`pg-drop-${slug}`}><path d="M56 14S26 48 26 70a30 30 0 0060 0C86 48 56 14 56 14z" /></clipPath></defs>
  <g clipPath={`url(#pg-drop-${slug})`}>
    <rect width="112" height="112" fill="#fff" fillOpacity={0.7} />
    <g className="pg-level-h"><g className="pg-level">
      <path d="M8 68c14-6 28 6 48 0s34-6 48 0v44H8z" fill="var(--glyph-amber)" fillOpacity={0.24} />
    </g></g>
  </g>
  <path d="M56 14S26 48 26 70a30 30 0 0060 0C86 48 56 14 56 14z" stroke="var(--glyph-amber)" strokeWidth={3} strokeLinejoin="round" />
  ```
- **rings** (Complete Home Check-up): three vital rings draw in, around the logo's roof and pulse.
  ```tsx
  <g className="pg-rings-h">
    <circle cx="56" cy="56" r="44" stroke="var(--sage)" strokeWidth={3} strokeLinecap="round" pathLength={1} className="pg-arc" style={{ "--k": 0 } as CSSProperties} transform="rotate(-90 56 56)" />
    <circle cx="56" cy="56" r="33" stroke="var(--teal)" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" pathLength={1} className="pg-arc" style={{ "--k": 1 } as CSSProperties} transform="rotate(-90 56 56)" />
    <circle cx="56" cy="56" r="22" stroke="var(--teal)" strokeWidth={3} strokeLinecap="round" pathLength={1} className="pg-arc" style={{ "--k": 2 } as CSSProperties} transform="rotate(-90 56 56)" />
    <path d="M42 60h6l4-8 5 14 4-8h9" stroke="var(--teal-deep)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </g>
  ```
- **gauge** (Essential Vitals): a BP gauge needle settles with no overshoot.
  ```tsx
  <path d="M20 74a36 36 0 0172 0" stroke="var(--glyph-sky)" strokeOpacity={0.25} strokeWidth={10} strokeLinecap="round" />
  <path d="M20 74a36 36 0 0154-31" stroke="var(--glyph-sky)" strokeWidth={10} strokeLinecap="round" />
  <g className="pg-needle-h"><g className="pg-needle">
    <path d="M56 74L73 52" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
  </g></g>
  <circle cx="56" cy="74" r="5" fill="var(--ink)" />
  ```

You may refine path coordinates for optical balance. Keep the class names, the 112 viewBox, the needle pivot at (56, 74), and the rule that the base pose equals the final pose.

### 6.5 How it works (`how-it-works.tsx`, Unit 2)

- `<Section id="how-it-works" tone="wash" divider="both" titleId="how-it-works-title">`.
- `SectionTitle`: eyebrow `How a visit works`, title `One visit.`, accent `The whole check-up.`, lede `Nothing to download before the nurse arrives, nothing to carry to a lab. Here is what happens, in order.`
- **Steps** (the copy is kept; only step 4's time chip and the step 2 chip wording change):

| # | Title | Text | Chip |
|---|---|---|---|
| 1 | Book in two minutes | Choose a programme or a few tests, pick a slot and an address. Same-day slots open every morning. | 2 min |
| 2 | A nurse arrives with the devices | A certified Nivar nurse comes with a smart ECG, a digital stethoscope, a BP monitor and a glucometer. | About 45 min |
| 3 | Your doctor joins live | Readings stream to a Nivar doctor as they are taken. She reviews them and speaks with you on video. | 15 min |
| 4 | Report in your app | A signed report and prescription, with every reading explained in plain words, lands in the app. | `{SITE.report.chip}` |

- **Structure:** `<ol {...revealProps(1)} className="relative mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">`.
  - **Desktop connector (lg+):**
    ```tsx
    <svg aria-hidden viewBox="0 0 1000 40" preserveAspectRatio="none" fill="none" className="hiw-line pointer-events-none absolute inset-x-5 top-0 hidden h-10 lg:block">
      <path d="M0 20H352L364 20L372 6L382 34L390 20H1000" pathLength={1} stroke="var(--sage)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
    ```
  - **Mobile timeline (<sm):** `<span aria-hidden className="hiw-vline absolute top-5 bottom-5 left-5 w-0.5 -translate-x-1/2 rounded-full bg-sage sm:hidden" />`.
  - **Each `<li>`:** `relative pl-14 sm:pl-0`.
    - Dot: `<span aria-hidden className="hiw-dot absolute top-0 left-0 z-10 flex size-10 items-center justify-center rounded-full border border-primary bg-mint text-[0.9375rem] font-semibold text-primary tabular-nums sm:static" style={{ "--step": i } as CSSProperties}>{i + 1}</span>`
    - Then `<h3 className="text-h4 text-foreground sm:mt-6">`, `<p className="mt-2 text-small text-foreground-2">`, `<Pill tone="mint" className="mt-4">{chip}</Pill>`.
  - The step number is a visual aid; the `<ol>` already conveys order.
- **Soft CTA:** `<div {...revealProps(2)} className="mt-12 flex flex-col items-start gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between lg:mt-14">`.
  - Text: `<p className="text-body text-foreground">Ready when you are. Same-day slots open every morning, {SITE.hours.short}.</p>`.
  - Button: `<ButtonLink href={bookHref()}>{BOOK_LABEL}</ButtonLink>`.

### 6.6 Health, in numbers (`health-facts.tsx`, Unit 3)

See section 8.3.

### 6.7 Live (`live-section.tsx`, `live-dashboard.tsx` + monitors, Unit 4)

- `<Section id="live" tone="deep" titleId="live-title" className="relative isolate overflow-hidden">`.
- **Decoration:** `<div aria-hidden className="absolute inset-0 -z-10 bg-ecg-grid-dark" />` and a static glow `<div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--teal)_28%,transparent),transparent)]" />`.
- `SectionTitle`: eyebrow `Live readings`, title `Readings that reach your doctor`, accent `while you're still on the sofa.`, lede `The nurse's devices stream straight to a Nivar doctor's console. If a reading looks off, the doctor asks for a repeat on the spot instead of calling you back next week.` The pine scope recolours everything; delete the `#8a8a85` and `#a3a39e` literals.
- **Grid:** `mt-12 grid gap-6 lg:mt-14 lg:grid-cols-2 lg:gap-8`.
  1. **Photo:** `relative aspect-[4/3] overflow-hidden rounded-3xl bg-pine-raised lg:aspect-auto` with `doctor.jpg` (alt and `sizes` kept).
     - Glass card: `absolute right-4 bottom-4 left-4 flex items-center justify-between gap-4 sm:right-auto sm:w-[300px]`.
     - Left: `<p className="flex items-center gap-2 font-semibold"><LiveDot className="size-1.5" />Live now</p><p className="mt-1 text-muted-foreground">Sample patient, BP 126/78</p>`.
     - Right: `<Pill tone="warning">Elevated</Pill>`.
  2. **`<LiveDashboard />`** (below).
- **Under the grid:** `<p className="mt-4 text-caption text-muted-foreground">Demo with simulated readings and an illustrative patient.</p>`.
- **Soft CTA:** `<div className="mt-12 flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">` with `<p className="text-body text-foreground-2">See your own readings reach a Nivar doctor, live.</p>` and `<ButtonLink href={bookHref()} variant="inverse" size="lg">{BOOK_LABEL}</ButtonLink>`.
- **Demo BP is now 126/78** everywhere on the page. It is "Elevated" under both AHA 2025 (120–129/<80) and ESC 2024 (120–139/70–89), which resolves the guideline ambiguity the judges flagged for 138/88.

**`LiveDashboard`** (props unchanged: `{ className?: string }`):

```tsx
const ref = useRef<HTMLDivElement>(null);
const inView = useInView(ref);
const motionPaused = useMotionPaused();
const running = inView && !motionPaused;
const paired = usePairing(running, 1200);
const feed = useEcgFeed(76);
```

- **Shell:** `rounded-3xl border border-border bg-card p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] sm:p-5`.
- **Header:** `flex flex-wrap items-center justify-between gap-3 px-1 pb-4`.
  - Left: `Rahul Mehta, 58` (`text-[0.9375rem] font-medium text-foreground`) and `Heart Check, Indiranagar` (`text-caption text-muted-foreground`).
  - Right: `flex items-center gap-2` with `<Pill tone="inverse" size="md"><LiveDot className="size-1.5" />Dr. Rao<span className="hidden sm:inline"> reviewing</span></Pill>` and `<MotionToggle variant="compact" />`.
- **Monitor:** `<EcgMonitor feed={running ? feed : null} heartRate={76} status={paired ? "streaming" : "connecting"} paused={motionPaused} pausedLabel="Paused. Press Play to watch a sample ECG." height={200} className="rounded-2xl" />`.
- **Vitals:** `<dl className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-border min-[420px]:grid-cols-2">`. Cells `flex flex-col gap-3 bg-card p-4`.
  - `dt`: `flex items-center justify-between gap-2 text-caption text-muted-foreground`.
  - Chips: Normal is `<Pill tone="inverse">Normal</Pill>`. Elevated is `<Pill className="bg-amber-on-dark/14 text-amber-on-dark ring-1 ring-amber-on-dark/35">Elevated</Pill>`.
  - `dd`: `text-[1.5rem] leading-none font-medium tracking-[-0.02em] text-foreground tabular-nums` with the unit in `text-xs font-normal tracking-normal text-muted-foreground`.
  - `VITALS`:

    | Label | Value | Unit | Flag |
    |---|---|---|---|
    | Blood pressure | 126/78 | mmHg | Elevated |
    | Oxygen saturation | 98 | % | Normal |
    | Blood sugar | 112 | mg/dL | Normal |
    | Heart rate | 76 | bpm | Normal |

- **Imports:** `useMotionPaused` and `MotionToggle` from `./motion`; `LiveDot` and `Pill` from `./primitives`.

**`components/live/ecg-monitor.tsx`:**
- **New optional props:**
  - `paused?: boolean` (default `false`).
  - `pausedLabel?: ReactNode` (default `"Paused"`).
  - All existing callers (doctor and nurse consoles, `/dev/live`) are unaffected.
- **When `paused` is true:**
  - The animation effect draws one frame and starts no rAF loop. Add `paused` to that effect's dependencies; cancel the rAF on cleanup as today. The canvas keeps the frozen trace.
  - Keep a `drawRef` pointing at the current `draw`. At the end of `setup()`, if paused, call `drawRef.current?.()` so a resize does not leave a blank canvas.
- **When `paused` turns false:** set `playerRef.current.lastDataAt = performance.now()` before restarting the loop, so the monitor doesn't flash "Waiting for device..." while the buffer refills.
- **Overlay precedence:**
  1. If `paused && !hasSignal`, show `pausedLabel`.
  2. Else if `paused`, show nothing (the trace stays frozen).
  3. Else use the existing logic.
- **Header badge:** `<LiveBadge live={live && !paused} paused={paused} />`.
- **Reduced motion:** in `onBeat`, skip `heartRef.current?.animate(...)` when `window.matchMedia("(prefers-reduced-motion: reduce)").matches` (read once per effect run into a local `const reduced`).
- **Literals:** every `text-[#7A7A75]` becomes `text-[#8F8F89]` (5 places).

**`components/live/monitor-shared.tsx`:**
- **`MONITOR`:**
  - Set `dim: "#8F8F89"` (6.09:1 on `#0a0a0a`, 5.12:1 on `#0A221E`).
  - Delete `danger`.
  - Every other value stays the same. The monitor is a device screen and stays near-black, so the staff consoles don't change.
- **`LiveBadge({ live, label = "LIVE", paused = false })`:**
  - Live: `bg-[#19C37D]/15 text-[#8FE3BF]` with `<span className="live-dot size-1.5 text-[#19C37D]" />`. This replaces the coral text and the fast `animate-ping`.
  - Paused: `bg-white/5 text-[#8F8F89]` with a static `#8F8F89` dot and the text `PAUSED`.
  - Otherwise: `OFFLINE` with the same dim styling.
- **`MonitorOverlay`:** unchanged.

**`components/live/steth-monitor.tsx`:** only `text-[#7A7A75]` → `text-[#8F8F89]` (2 places). Nothing else.

### 6.8 Devices (`devices.tsx`, Unit 5)

- `<Section id="devices" titleId="devices-title">`.
- `SectionTitle`: title `Clinic-grade devices,`, accent `carried in a small bag.`
- **Grid:** `mt-12 grid gap-10 sm:grid-cols-2 lg:mt-14 lg:gap-8`. Each `<figure {...revealProps(i)}>`.
  - Image wrapper: `relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-ink/6 after:ring-inset`. The photo is 4:3, down from square; `sizes` is kept.
  - Caption `mt-6`: `<h3 className="text-h3">`, `<p className="mt-2.5 max-w-[44ch] text-small text-foreground-2">` (existing two lines joined), then `<ul className="mt-4 flex flex-wrap gap-2">` of `<Pill tone="outline" size="md">`:
    - ECG: `250 samples a second`, `Streams live to your doctor`.
    - Stethoscope: `Heart and lung sounds`, `Saved to your report`.
- **"Also in the bag" row:** `<div {...revealProps(2)} className="mt-10 flex flex-wrap items-center gap-2.5">` with `<p className="mr-1 text-small text-muted-foreground">Also in the bag:</p>` and three `<Pill tone="outline" size="md">`: `<Gauge /> BP monitor`, `<Droplet /> Glucometer`, `<Activity /> Pulse oximeter`.

### 6.9 Pricing (`pricing.tsx`, Unit 5)

- `<Section id="pricing" tone="wash" divider="both" titleId="pricing-title">`.
- Grid `lg:grid-cols-12 gap-12 lg:gap-10`.
- **Left** (`lg:col-span-5 lg:sticky lg:top-24 lg:self-start`):
  - `SectionTitle`: title `Premium care.`, accent `No premium price.`, lede `One price covers the nurse visit, the devices, the doctor's time and the report. {SITE.payment.line}`. This **removes "Pay after the visit"**.
  - Checklist `<ul className="mt-8 flex flex-col gap-3">`. Each `<li className="flex items-center gap-3 text-small text-foreground">` starts with the mint check circle from 6.2 (size-6). Items: `No travel charge`, `No separate consultation fee`, `{SITE.cancellation}`.
  - `<ButtonLink href={bookHref()} variant="secondary" className="mt-8">{bookingEnabled ? "See all tests" : "Request a callback"}</ButtonLink>` (existing logic).
- **Right** (`lg:col-span-7`):
  - **Packages:** `<ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-xs">`.
    - Rows: `grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:p-6`. The popular row also gets `bg-[color-mix(in_oklab,var(--mint)_40%,var(--card))]`.
    - Left side:
      - `<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5"><h3 className="text-h4">{p.name}</h3>{p.popular && <Pill tone="mint">Most booked</Pill>}</div>`.
      - Tagline `mt-1.5 text-small text-foreground-2`.
      - Included chips `mt-3 flex flex-wrap gap-1.5` of `<Pill tone="outline">` (shortName), keeping `aria-label`.
    - Right side `flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-3`:
      - Price `text-[1.25rem] font-medium tracking-[-0.02em] tabular-nums`, MRP `<s>` with the sr-only "Usual price ".
      - `<ButtonLink href={bookHref(`package=${p.slug}`)} variant="secondary" aria-label={`${ROW_CTA_LABEL} ${p.name}`} className={ARROW_NUDGE}>{ROW_CTA_LABEL}<ArrowRight aria-hidden /></ButtonLink>`. That is 44px tall, and the accessible name contains the visible label (2.5.3).
  - **Individual tests:** `<h3 className="mt-12 text-h4">Or pick individual tests</h3>`, then `<ul className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">`.
    - Each `<li className="bg-card">` holds a `Link`: `flex h-full min-h-14 items-center justify-between gap-4 px-5 py-4 text-small transition-colors duration-160 hover:bg-wash focus-ring focus-visible:outline-offset-[-2px]`. The outline is inset because the list clips overflow.
    - Delete the `shadow-[0_0_0_1px...]` hack.
    - **When `services.length` is odd**, append `<li className="bg-card"><a href="#callback" className="…same link classes… font-semibold text-primary">Not sure what you need? Ask us to call you <ArrowRight aria-hidden className="size-4" /></a></li>`.

### 6.10 Families (`families.tsx`, Unit 5)

- `<Section id="for-families" titleId="for-families-title">`. The grid and photo are as today, with `rounded-3xl`.
- `SectionTitle`: title `Book for your parents,`, accent `from anywhere.`, lede (kept) `Add a family member, book in their name and follow the visit from your own phone. You get every update they do, and the report lands in both apps.`
- CTA: as today (`bookingEnabled ? "Book for a family member" : "Request a callback"`).
- **Timeline:** `<ol className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card shadow-lift sm:absolute sm:right-6 sm:bottom-6 sm:mt-0 sm:w-[320px]">`.
  - Each `<li {...revealProps(i + 1)} className="flex items-center gap-3.5 px-4 py-3">` contains `<IconTile size="sm"><e.icon strokeWidth={2} /></IconTile>`, `<span className="flex-1 text-small font-medium">`, `<time className="text-caption text-muted-foreground tabular-nums">`.
  - The events stagger in once (the visit "progressing").
- No "For Amma" chip. Those words were not native-reviewed (section 13).

### 6.11 Everyday care (`everyday-care.tsx`, Unit 3)

See section 8.4.

### 6.12 Doctors (`doctors.tsx`, Unit 6)

The table roles go: the audit found the `role=table` → `ul` → `li role=row` structure broken. Each row becomes a heading plus two labelled paragraphs. On desktop it **looks** like a three-column comparison with a tinted Nivar column.

- `<Section id="doctors" titleId="doctors-title">`.
- `SectionTitle`: eyebrow `Our doctors`, title `Doctors on payroll,`, accent `not on call.`, lede (kept) `Most home-care apps route your visit to whichever doctor is free. Ours are full-time Nivar staff, and that changes what you can expect.`
- `ROWS`: the same four rows and text as today.
- **Structure:**
  ```tsx
  <div {...revealProps(1)} className="mt-12 lg:mt-14">
    <div aria-hidden className="hidden grid-cols-[200px_1fr_1fr] gap-8 md:grid">
      <span />
      <span className="pb-4 text-sm font-medium text-muted-foreground">Typical gig model</span>
      <span className="rounded-t-2xl bg-mint/60 px-6 pt-5 pb-4 text-sm font-semibold text-primary">Nivar</span>
    </div>
    <ul className="flex flex-col gap-4 md:gap-0 md:border-t md:border-border">
      {/* per row r, index i, last = i === ROWS.length - 1 */}
      <li className="rounded-2xl border border-border bg-card p-5 md:grid md:grid-cols-[200px_1fr_1fr] md:gap-8 md:rounded-none md:border-0 md:border-b md:bg-transparent md:p-0">
        <h3 className="text-h4 text-foreground md:py-6">{r.label}</h3>
        <p className="mt-3 text-small text-muted-foreground md:mt-0 md:py-6">
          <span className="mb-1 block text-xs font-medium md:sr-only">Typical gig model</span>
          {r.gig}
        </p>
        <div className={cn("mt-3 flex items-start gap-2.5 rounded-xl bg-mint/60 p-4 text-small text-foreground md:mt-0 md:rounded-none md:px-6 md:py-6", last && "md:rounded-b-2xl")}>
          <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" strokeWidth={3} /></span>
          <p><span className="mb-1 block text-xs font-semibold text-primary md:sr-only">Nivar</span>{r.nivar}</p>
        </div>
      </li>
    </ul>
  </div>
  ```

### 6.13 FAQ (`faq-section.tsx`, `faq.tsx`, Unit 6)

- `<Section id="faq" divider="top" titleId="faq-title">`. Grid `lg:grid-cols-12 gap-10`.
- Left `lg:col-span-4`: `SectionTitle id="faq-title" title="Questions," accent="answered plainly."`.
- Right `lg:col-span-8`: `<FaqAccordion items={items} />`, then `<p className="mt-8 text-body text-foreground-2">Still unsure? <a href="#callback" className="inline-flex items-center gap-1 rounded-sm font-semibold text-primary underline decoration-border-strong underline-offset-4 hover:decoration-current focus-ring">Ask us to call you<ArrowRight aria-hidden className="size-4" /></a></p>`.
- **`faq.tsx` classes:**
  - `Accordion`: `border-t border-border`.
  - `AccordionItem`: `border-b border-border`.
  - `AccordionTrigger`: `min-h-14 gap-6 rounded-lg border-0 py-4 text-h4 text-foreground hover:no-underline focus-visible:ring-0 focus-ring aria-expanded:text-primary **:data-[slot=accordion-trigger-icon]:mt-1 **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-teal`.
  - `AccordionContent`: `max-w-[62ch] pb-6 text-body text-foreground-2`.
- **Items, final copy:**

| Question | Answer |
|---|---|
| How much does a home check-up cost? | (kept) Programmes start at {inr(fromPrice)} and the Complete Home Check-up is {inr(completePrice)}. The price covers the nurse visit, the devices, the doctor consult and the report. There is no travel charge and no separate consultation fee. |
| Which tests can be done at home? | (kept) |
| How quickly can a nurse reach me? | In most of Bangalore a same-day slot is available within an hour or two of booking, {SITE.hours.inSentence}. You see the live arrival time in the app once the nurse sets off. |
| How soon do I get my report? (new) | Usually within the hour of the visit. Your Nivar doctor signs it, explains every reading in plain words and adds a prescription if you need one. It lands in the app, and in your family member's app if you booked for them. |
| Is the doctor a real, registered doctor? | (kept) |
| What happens if a reading is abnormal? | (kept), then append: In an emergency, call 112 (or 108 for an ambulance) straight away. |
| Who can see my health data? | (kept) |
| How do I pay? | {SITE.payment.faq} |
| Can I cancel or reschedule? | (kept) |

### 6.14 Callback section (`closing.tsx` `Callback`, Unit 7)

- `<Section id="callback" tone="wash" divider="both" titleId="callback-title">`. Grid `lg:grid-cols-12 gap-12 lg:gap-10`.
- **Left** `lg:col-span-5`:
  - `SectionTitle`: title `Want us to`, accent `call you?`, lede `Tell us a little about who the check-up is for. A care coordinator calls back within {SITE.callbackWithin}, {SITE.hours.inSentence}, and helps you choose the right programme.`
  - `<ul className="mt-8 flex flex-col gap-4">`, each row `flex items-center gap-3 text-small text-foreground` with `<IconTile size="sm">`:
    - `Phone`: A call back within 30 minutes, {SITE.hours.short}
    - `Stethoscope`: Help choosing the right programme
    - `ShieldCheck`: Your number is only used for this request
  - If `SITE.phone`, add a fourth row: `PhoneCall` + `Prefer to call? {display}` as a `tel:` link.
- **Right** `lg:col-span-6 lg:col-start-7`: `<Surface radius="3xl" padding="lg" className="shadow-soft"><CallbackForm /></Surface>`. Form spec in section 9.

### 6.15 Final CTA (`closing.tsx` `FinalCta`, Unit 7)

```tsx
<section aria-labelledby="cta-title" className="py-16 lg:py-24">
  <Container>
    <div {...revealProps(0)} className="theme-pine relative isolate overflow-hidden rounded-3xl px-6 pt-12 pb-24 sm:px-10 sm:pt-14 lg:rounded-4xl lg:px-16 lg:pt-20 lg:pb-28">
      <div aria-hidden className="absolute -top-1/2 -right-1/4 -z-10 h-[140%] w-[80%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--teal)_35%,transparent),transparent)]" />
      <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="cta-title" className="font-display max-w-[16ch] text-cta text-balance text-foreground">
            {bookingEnabled ? "Book your first check-up" : "Plan your first check-up"}{" "}
            <span className="font-accent text-[1.04em] font-normal tracking-[-0.01em] text-heading-accent">today.</span>
          </h2>
          <p className="mt-6 max-w-[44ch] text-lede text-foreground-2">Same-day slots across Bangalore, {SITE.hours.short}.</p>
          <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-small text-foreground-2">
            {/* STAY_HEALTHY from l10n.ts, each <span lang={p.lang}>, separated by <span aria-hidden>·</span> */}
          </p>
        </div>
        <ButtonLink href={bookHref()} variant="inverse" size="lg">{BOOK_LABEL}</ButtonLink>
      </div>
      <EcgLine draw beats={6} thin className="pointer-events-none absolute inset-x-0 bottom-6 h-14" strokeClassName="stroke-heading-accent" />
    </div>
  </Container>
</section>
```

"Pay after the visit" is removed. The ECG hairline draws once when the panel is revealed.

### 6.16 Footer (`closing.tsx` `SiteFooter`, Unit 7)

- `<footer className="border-t border-border bg-background">` with `<h2 className="sr-only">Site footer</h2>` as its first child. The h3 column headings now sit under an h2. `<Container className="py-14 lg:py-20">`.
- **Brand column** `lg:col-span-5`:
  - `<Logo size="sm" />`.
  - `<p className="mt-5 max-w-[36ch] text-small text-foreground-2">Doctor-led health check-ups at home, across Bangalore.</p>`.
  - If `SITE.phone`: a `tel:` link.
- **Link columns** `lg:col-span-7 grid grid-cols-2 gap-10 sm:grid-cols-3`. Headings `<h3 className="text-sm font-semibold text-foreground">`. Links: `rounded-sm text-small text-foreground-2 transition-colors hover:text-foreground focus-ring`.
  - **Nivar:** How it works, What we test, Pricing, For families, Health facts (`#health-facts`), Health tips (`#health-tips`).
  - **Account:** (booking on) Book a check-up, Log in; then Request a callback, Questions (logic as today).
  - **Company:** Our doctors, Devices, Live readings, (booking on) Staff login.
- **Bottom** `mt-14 flex flex-col gap-5 border-t border-border pt-8`:
  1. Emergency: `<p className="flex w-fit items-start gap-2.5 rounded-2xl border border-danger/25 bg-danger-bg px-4 py-3 text-small text-ink"><Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" /><span>Nivar is not an emergency service. In an emergency, call <a href="tel:112" className="font-semibold text-danger underline underline-offset-2 focus-ring rounded-sm">112</a> (or <a href="tel:108" className="…same…">108</a> for an ambulance).</span></p>`.
  2. `<div className="flex flex-col gap-4 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between">` containing `<p>Health information on this page is general guidance, not a diagnosis.</p>`, `<MotionToggle variant="pill" />` and `<p>{SITE.legalName}, {SITE.city}</p>`.

## 7. The multilingual rotator

### 7.1 Content decision

**Hero line: "Take care of your health."**

| Language | `lang` | Text |
|---|---|---|
| English | `en-IN` | Take care of your health. |
| Kannada | `kn` | `TAKE_CARE[1]` (ಆರೋಗ್ಯ ಜೋಪಾನ) |
| Hindi | `hi` | `TAKE_CARE[2]` (सेहत का ख़याल रखिए) |
| Marathi | `mr` | `TAKE_CARE[3]` (तब्येतीची काळजी घ्या) |

How the reviewer disagreements were resolved:
- **Hero concept.**
  - Directions A and B proposed proverbs ("Health is wealth"). C proposed "Your health, our care". The localisation lead and **both** native reviewers chose "Take care of your health", with all three Indic lines rated "natural".
  - It is the words adult children say to their parents at the end of a call, which is exactly Nivar's buyer. It is respectful to elders: verbless in Kannada, रखिए in Hindi, घ्या in Marathi.
  - It makes no medical claim, carries no number, and means the same thing in all four languages.
- **Rejected strings.**
  - "Good health, at home": both reviewers flagged the Hindi and Marathi as fragments that read like work-from-home ads.
  - "Your health, our responsibility": reviewer 2 flagged the Hindi ज़िम्मा as an outcome guarantee, and the Marathi needed a spelling fix.
  - Neither is used anywhere.
- **Proverbs** ("health is wealth", all rated natural) become the *static* opener of the Everyday care section with English glosses, as the localisation lead recommended. There is only one rotator on the page.
- **"Stay healthy"** (all rated natural) is a *static* sign-off on the final CTA. Hindi uses रहिए (warm, polite), not रहें (signage).
- **Endonym** for Hindi is हिंदी (anusvara, the modern standard). Chips show native script, never flags and never single letters (2.5.3 Label in Name).
- **Order:** en → kn → hi → mr. Hindi and Marathi are adjacent, which the audit warned about. That warning was for concepts where both share the word आरोग्य; here they share no words, so the change is unmistakable, and Kannada, Bangalore's own language, leads the Indic slots.
- **Punctuation:** the strings are used exactly as reviewed. English keeps its full stop; the Indic lines have none, since no danda was reviewed. Do not add punctuation.

### 7.2 Component (`apps/web/src/components/landing/health-words.tsx`, Unit 1)

```tsx
export function HealthWords({ className }: { className?: string })
```

- **Placement and size:**
  - In the hero, between the H1 and the lede.
  - Phrase: `text-rotator text-primary` (24px at 360 to 32px from about 1024 wide; 500 weight; line-height 1.6; 8.85:1 on mist).
  - Widest line: English, 11.2em, which is about 268px at 24px. That leaves room for the 38px heartline glyph inside the 320px content width at 360. The glyph is hidden below 360.

**Behaviour:**

| Aspect | Rule |
|---|---|
| Dwell | 5000ms per language, timed after the incoming item is fully in. A full cycle is about 21s. |
| Transition | Outgoing: opacity 1→0 and translateY 0→-0.35em over 450ms (`--curve-exit`). Incoming: from +0.35em, 700ms (`--curve-calm`), starting 150ms after the exit starts. Pure CSS on `data-state` (`landing.css` §3). |
| Heartline | A 28×16 ECG blip before the phrase draws once (900ms) on every change. It is remounted via `key` and does not animate on first render. |
| SSR / no JS | Item 0 (English) is `active`, the others are `idle` (`visibility:hidden`, still laid out, so the Indic fonts start downloading without a preload). Same on the client at first render, so there is no hydration mismatch. |
| Fonts | Rotation starts only after `document.fonts.ready` (capped at 3s), so the first Indic frame never shows a fallback font. |
| Auto-advance runs only when | `!useMotionPaused()` (no global pause and not reduced motion), and not hovered, and no keyboard focus inside (`:focus-visible`), and at least partly in view (own `IntersectionObserver`, threshold 0), and `document.visibilityState === "visible"`, and fonts are ready. When any of these clears, the dwell restarts from zero; it never swaps immediately on resume. |
| Reduced motion | No autoplay. Chips switch instantly, because the global rule collapses the transitions. |
| Manual | Clicking a chip shows that language, restarts the dwell, and announces the phrase in a polite live region (only on user action). |
| Pause (WCAG 2.2.2) | `<MotionToggle variant="icon" />` in the chip row: 32px visual, 44px hit area, label "Pause animations" or "Play animations". It is global: it also stops the mini-trace, the live dots and the ECG monitor. |
| CLS | All four items share one grid cell (`grid-area: 1/1`), so the box is always the size of the largest. Every item is `white-space: nowrap` at line-height 1.6 with General Sans as the primary font, so the line box is identical for every script. There is no `overflow` clipping, so Kannada ottaksharas and Devanagari matras are never cut. |
| Screen readers | The visual stack is `aria-hidden`. One sr-only sentence: "Take care of your health. Also shown in Kannada, `<span lang="kn">…</span>`; Hindi, `<span lang="hi">…</span>`; and Marathi, `<span lang="mr">…</span>`." No live region announces auto-rotation. |
| Chips | A `role="group"` labelled "Language". Each chip is a `<button>` with `aria-current="true"` when active. The visible text is the endonym inside `<span lang>`, followed by sr-only " (Kannada)" and so on, so the accessible name contains the visible label. Chips are 32px visual with a 44px hit area (`before:-inset-y-1.5`). |

**Code** (complete; use as written):

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { cn } from "@/lib/utils";
import { LANGUAGES, TAKE_CARE } from "./l10n";
import { MotionToggle, useMotionPaused } from "./motion";

const DWELL_MS = 5000;
const EXIT_MS = 450;
const NAMES: Record<string, string> = Object.fromEntries(LANGUAGES.map((l) => [l.lang, l.english]));

/** "Take care of your health" in English, Kannada, Hindi and Marathi. See spec section 7. */
export function HealthWords({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [drawKey, setDrawKey] = useState(0);
  const [announced, setAnnounced] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);
  const motionPaused = useMotionPaused();

  useEffect(() => {
    let alive = true;
    const cap = new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
    Promise.race([document.fonts?.ready ?? Promise.resolve(), cap]).then(() => alive && setFontsReady(true));
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    const el = ref.current;
    const io = el ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting)) : null;
    if (el && io) io.observe(el);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  const swap = useCallback((from: number, to: number) => {
    setLeaving(from);
    setIndex(to);
    setDrawKey((k) => k + 1);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeaving(null), EXIT_MS + 50);
  }, []);

  const running = !motionPaused && !hovered && !focused && inView && tabVisible && fontsReady;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => swap(index, (index + 1) % TAKE_CARE.length), DWELL_MS);
    return () => window.clearTimeout(t);
  }, [running, index, swap]);

  const pick = (i: number) => {
    if (i === index) return;
    swap(index, i);
    setAnnounced(i);
  };

  // Keyboard focus inside pauses rotation; a mouse click on a chip does not (it would stay paused forever).
  const onFocus = (e: FocusEvent<HTMLDivElement>) => setFocused(e.target.matches(":focus-visible"));
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  const [en, ...indic] = TAKE_CARE;

  return (
    <div
      ref={ref}
      className={className}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <p className="sr-only">
        {en.text} Also shown in{" "}
        {indic.map((p, k) => (
          <span key={p.lang}>
            {k === indic.length - 1 ? "and " : ""}
            {NAMES[p.lang]}, <span lang={p.lang}>{p.text}</span>
            {k === indic.length - 1 ? "." : "; "}
          </span>
        ))}
      </p>

      <div aria-hidden="true" className="flex items-center gap-2.5 text-rotator text-primary">
        <svg
          key={drawKey}
          data-draw={drawKey > 0 ? "" : undefined}
          viewBox="0 0 28 16"
          fill="none"
          className="hw-beat hidden h-4 w-7 shrink-0 text-teal min-[360px]:block"
        >
          <path
            d="M1 9h7l2.5 0 2-6 2.5 11 2-5h10"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="hw-cell">
          {TAKE_CARE.map((p, i) => (
            <span
              key={p.lang}
              lang={p.lang}
              className="hw-item"
              data-state={i === index ? "active" : i === leaving ? "leaving" : "idle"}
            >
              {p.text}
            </span>
          ))}
        </span>
      </div>

      <div role="group" aria-label="Language" className="mt-1.5 flex flex-wrap items-center gap-1">
        {LANGUAGES.map((l, i) => (
          <button
            key={l.lang}
            type="button"
            onClick={() => pick(i)}
            aria-current={i === index ? "true" : undefined}
            className={cn(
              "relative inline-flex h-8 items-center rounded-full px-2.5 text-sm font-medium transition-colors duration-160 focus-ring before:absolute before:inset-x-0 before:-inset-y-1.5 min-[400px]:px-3",
              i === index ? "bg-mint text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span lang={l.lang}>{l.endonym}</span>
            {l.lang !== "en-IN" && <span className="sr-only"> ({l.english})</span>}
          </button>
        ))}
        <MotionToggle className="ml-1.5" />
      </div>

      <p aria-live="polite" className="sr-only">
        {announced !== null && <span lang={TAKE_CARE[announced].lang}>{TAKE_CARE[announced].text}</span>}
      </p>
    </div>
  );
}
```

At 360 wide, the chips (English, ಕನ್ನಡ, हिंदी, मराठी) plus the pause button measure about 300px, which fits the 320px content width. `flex-wrap` is only a safety net below 340.

## 8. Health facts and tips

### 8.1 Content rules

These are taken from both fact-checks; where they differed, the more conservative wording is used.

- Every item below passed two independent checks. Corrections are applied, and **nothing is added that was not checked**. AHA fasting-sugar ranges and "Indians get heart disease 10 years earlier" are excluded. The withdrawn "17.9 million CVD deaths" is excluded.
- Scope (India / Worldwide / US / Clinical trials) is in the **visible** copy, not only in the source line.
- Relative risks are labelled as such.
- **Never** place a fact next to a Nivar outcome or detection claim, or next to a CTA. The facts section and the tips section have no booking CTAs. The soft CTA before the facts belongs to How it works, with a section boundary in between.
- No "silent killer", no death tolls as headlines, no "Nivar detects/prevents".
- A **clinician must open the four sources that could not be machine-fetched** before launch (AHA, MoHFW/newsonair, IDF, NTQLS) and two URLs that were not fetched (NHS hypoglycaemia, ntqls.in). See section 12.

### 8.2 `apps/web/src/components/landing/health-content.ts` (new, Unit 3): paste exactly

```ts
/**
 * Health facts and tips for the landing page (spec 2026-10-17, section 8).
 * Every item passed two independent fact-checks (October 2026). Where the checkers differed, the
 * more conservative wording is used. Scope stays in the visible text. Re-check yearly.
 * Do not place these next to Nivar outcome claims or booking CTAs.
 */
export type HealthSource = { label: string; url: string };

export type HealthFact = {
  id: string;
  figure: string;
  /** Small text after the figure, e.g. "lower risk". */
  figureSuffix?: string;
  scope: "India" | "Worldwide" | "US" | "Clinical trials";
  text: string;
  icon: "heart" | "gauge" | "drop" | "trend" | "salt" | "screen";
  sources: HealthSource[];
  /** YYYY-MM the source was last checked. */
  checked: string;
  /** Shown in "Health, in numbers" (keep exactly four featured). */
  featured: boolean;
};

export type TipCategory = "Checks" | "Heart" | "Food" | "Movement" | "Sleep" | "Sugar" | "Breath";

export type HealthTip = {
  id: string;
  category: TipCategory;
  title: string;
  text: string;
  sources: HealthSource[];
  checked: string;
};

export type ChecklistItem = { id: string; text: string; source: { label: string; url?: string } };

const S = {
  icmrIndiab: {
    label: "ICMR-INDIAB national survey (adults 20+, 2008–2020), Lancet Diabetes & Endocrinology, 2023",
    url: "https://doi.org/10.1016/S2213-8587(23)00119-5",
  },
  whoHypertension: {
    label: "WHO, Hypertension fact sheet, 2025",
    url: "https://www.who.int/news-room/fact-sheets/detail/hypertension",
  },
  whoHypertensionGlobal: {
    label: "WHO, Hypertension fact sheet, 2025 (global, adults 30–79, 2024 estimate)",
    url: "https://www.who.int/news-room/fact-sheets/detail/hypertension",
  },
  idfIndia: {
    label: "IDF Diabetes Atlas, 11th edition, 2025 (India, adults 20–79, modelled estimate for 2024)",
    url: "https://diabetesatlas.org/data-by-location/country/india/",
  },
  idpp: {
    label: "Indian Diabetes Prevention Programme (IDPP-1), Diabetologia, 2006",
    url: "https://doi.org/10.1007/s00125-005-0097-z",
  },
  ettehad: {
    label: "Ettehad et al., meta-analysis of 123 trials, The Lancet, 2016",
    url: "https://doi.org/10.1016/S0140-6736(15)01225-8",
  },
  cdcAfib: {
    label: "US CDC, About Atrial Fibrillation, 2024",
    url: "https://www.cdc.gov/heart-disease/about/atrial-fibrillation.html",
  },
  nhsAf: { label: "NHS, Atrial fibrillation, 2025", url: "https://www.nhs.uk/conditions/atrial-fibrillation/" },
  saltSurvey: {
    label: "ICMR-NCDIR National NCD Monitoring Survey 2017–18, Scientific Reports, 2023",
    url: "https://doi.org/10.1038/s41598-023-42694-x",
  },
  whoSalt: {
    label: "WHO, Salt reduction fact sheet, 2026",
    url: "https://www.who.int/news-room/fact-sheets/detail/salt-reduction",
  },
  fssaiSalt: { label: "FSSAI Eat Right India, Reduce salt", url: "https://eatrightindia.gov.in/reduce-salt.jsp" },
  ncdScreening: {
    label: "Ministry of Health & Family Welfare, NP-NCD screening campaign, February 2025 (via All India Radio)",
    url: "https://www.newsonair.gov.in/centre-launches-special-ncd-screening-campaign-for-100-coverage-of-30-age-group/",
  },
  cdcMeasureBp: {
    label: "US CDC, Measuring Your Blood Pressure, 2026",
    url: "https://www.cdc.gov/high-blood-pressure/measure/index.html",
  },
  aha2025: {
    label: "AHA/ACC High Blood Pressure Guideline, 2025",
    url: "https://professional.heart.org/en/science-news/2025-high-blood-pressure-guideline/top-things-to-know",
  },
  whoActivity: {
    label: "WHO Guidelines on Physical Activity and Sedentary Behaviour, 2020",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/",
  },
  ahaLe8: {
    label: "American Heart Association, Life's Essential 8, Circulation, 2022",
    url: "https://doi.org/10.1161/CIR.0000000000001078",
  },
  medlineGlucose: {
    label: "MedlinePlus (US National Library of Medicine), Blood Glucose Test, 2024",
    url: "https://medlineplus.gov/lab-tests/blood-glucose-test/",
  },
  nhsHypo: {
    label: "NHS, Low blood sugar (hypoglycaemia)",
    url: "https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/",
  },
  medlinePulse: { label: "MedlinePlus, Pulse, 2025", url: "https://medlineplus.gov/ency/article/003399.htm" },
  fdaOximeter: {
    label: "US FDA, Pulse Oximeter Basics, 2025",
    url: "https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics",
  },
  nhsBreathing: {
    label: "NHS, Breathing exercises for stress, 2026",
    url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/",
  },
  whoQuit: {
    label: "WHO, Health benefits of smoking cessation, 2020",
    url: "https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation",
  },
  ntqls: { label: "National Tobacco Quit Line Services (MoHFW)", url: "https://ntqls.in/" },
} satisfies Record<string, HealthSource>;

export const HEALTH_FACTS: HealthFact[] = [
  {
    id: "bp-prevalence-india",
    figure: "1 in 3",
    scope: "India",
    text: "About 1 in 3 adults in India has high blood pressure, and most have no symptoms. A quick, painless reading is how you find out.",
    icon: "heart",
    sources: [S.icmrIndiab, S.whoHypertension],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "bp-unaware",
    figure: "44%",
    scope: "Worldwide",
    text: "Worldwide, about 44% of adults with high blood pressure don't know they have it. The only way to find out is to have it measured.",
    icon: "gauge",
    sources: [S.whoHypertensionGlobal],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "diabetes-prediabetes-india",
    figure: "1 in 4",
    scope: "India",
    text: "A national survey found that about 1 in 4 adults in India has diabetes or prediabetes. Blood sugar testing, reviewed by a doctor, is how you find out.",
    icon: "drop",
    sources: [S.icmrIndiab],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "bp-lowering-benefit",
    figure: "20%",
    figureSuffix: "lower risk",
    scope: "Clinical trials",
    text: "In clinical trials, each 10 mmHg drop in the top (systolic) blood pressure number lowered the risk of major heart disease and stroke events by about 20%.",
    icon: "trend",
    sources: [S.ettehad],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "diabetes-undiagnosed-india",
    figure: "4 in 10",
    scope: "India",
    text: "An estimated 4 in 10 adults with diabetes in India have not been diagnosed. A routine blood sugar test is how it's found.",
    icon: "drop",
    sources: [S.idfIndia],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "salt-intake-india",
    figure: "8 g",
    scope: "India",
    text: "In a 2017–18 national survey, adults in India ate an estimated 8 g of salt a day; WHO advises under 5 g. Eating less salt helps lower blood pressure.",
    icon: "salt",
    sources: [S.saltSurvey, S.whoSalt],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "prediabetes-lifestyle-india",
    figure: "28.5%",
    figureSuffix: "lower risk (relative)",
    scope: "India",
    text: "In an Indian trial of adults with impaired glucose tolerance (a type of prediabetes), lifestyle advice lowered the risk of developing diabetes by 28.5% over three years, compared with standard advice.",
    icon: "trend",
    sources: [S.idpp],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "afib-silent",
    figure: "1 in 7",
    scope: "US",
    text: "In the US, AFib, an irregular heartbeat that may cause no symptoms, causes about 1 in 7 strokes. It is sometimes first found at a routine check-up.",
    icon: "heart",
    sources: [S.cdcAfib, S.nhsAf],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "screening-30-plus-india",
    figure: "30+",
    scope: "India",
    text: "Under its national programme for non-communicable diseases, India aims to screen every adult aged 30 and above for high blood pressure and diabetes.",
    icon: "screen",
    sources: [S.ncdScreening],
    checked: "2026-10",
    featured: false,
  },
];

export const HEALTH_TIPS: HealthTip[] = [
  {
    id: "tip-measure-bp",
    category: "Checks",
    title: "Measure blood pressure right",
    text: "Empty your bladder first. Sit with your back supported, feet flat and legs uncrossed, arm resting on a table at chest height, cuff on bare skin. Rest 5 minutes and don't talk during the reading. No food, drinks, smoking or exercise for 30 minutes before.",
    sources: [S.cdcMeasureBp],
    checked: "2026-10",
  },
  {
    id: "tip-know-numbers",
    category: "Heart",
    title: "Know your BP numbers",
    text: "For adults, under 120/80 is considered normal. One high reading isn't a diagnosis: take 2 readings 1–2 minutes apart, note them, and share a pattern of high numbers with a doctor. A reading of 180/120 or higher with chest pain, breathlessness, a severe headache, weakness or trouble speaking? Call 112 or 108 now.",
    sources: [S.aha2025, S.cdcMeasureBp, S.whoHypertension],
    checked: "2026-10",
  },
  {
    id: "tip-salt",
    category: "Food",
    title: "Keep salt under 5 g a day",
    text: "That's just under a teaspoon, all food included. Go easy on pickles, papads, namkeen and chutneys, and skip extra salt on curd, salad or cut fruit.",
    sources: [S.whoSalt, S.fssaiSalt],
    checked: "2026-10",
  },
  {
    id: "tip-move-150",
    category: "Movement",
    title: "Move 150 minutes a week",
    text: "Aim for at least 150 minutes of moderate activity, like brisk walking, each week. Sitting less helps too, and any movement is better than none. New to exercise or living with a health condition? Start small and check with your doctor.",
    sources: [S.whoActivity],
    checked: "2026-10",
  },
  {
    id: "tip-balance-65",
    category: "Movement",
    title: "Over 65? Add balance work",
    text: "On 3 or more days a week, add activities that build balance and strength. They help you stay steady on your feet and lower the risk of falls. If you've had a fall or feel unsteady, ask a doctor or physiotherapist what's safe for you.",
    sources: [S.whoActivity],
    checked: "2026-10",
  },
  {
    id: "tip-sleep",
    category: "Sleep",
    title: "Give sleep 7 to 9 hours",
    text: "Most adults should aim for 7–9 hours of sleep a night on average. The American Heart Association counts sleep among its eight essentials for a healthy heart.",
    sources: [S.ahaLe8],
    checked: "2026-10",
  },
  {
    id: "tip-fasting-test",
    category: "Sugar",
    title: "Fasting sugar test? Plan ahead",
    text: "Don't eat or drink anything except water for at least 8 hours before. On diabetes medicines or insulin? Ask your doctor how to take them that morning. If you feel shaky, sweaty, dizzy or confused while fasting, have something sugary straight away; the test can wait.",
    sources: [S.medlineGlucose, S.nhsHypo],
    checked: "2026-10",
  },
  {
    id: "tip-pulse",
    category: "Heart",
    title: "Check your pulse",
    text: "Rest for a few minutes, then place two fingers on the inside of your wrist, below the base of your thumb. Count the beats for a full minute (or 30 seconds and double it). A resting adult pulse is usually 60–100. If the rhythm feels irregular, tell a doctor. If it's fast or irregular with chest pain, breathlessness or dizziness, call 112 or 108.",
    sources: [S.medlinePulse, S.nhsAf],
    checked: "2026-10",
  },
  {
    id: "tip-spo2",
    category: "Checks",
    title: "Reading a fingertip oximeter",
    text: "For most healthy people, blood oxygen (SpO₂) reads 95–100%. Keep your hand warm, relaxed and still, below heart level, with no nail polish, and wait for a steady number. Readings can be less accurate on darker skin. If you feel unwell, don't rely on the number alone.",
    sources: [S.fdaOximeter],
    checked: "2026-10",
  },
  {
    id: "tip-breathing",
    category: "Breath",
    title: "Take a 5-minute breathing break",
    text: "Breathe in gently through your nose and out through your mouth, counting 1 to 5 each way, without forcing it. Keep going for at least 5 minutes; it can help you feel calmer.",
    sources: [S.nhsBreathing],
    checked: "2026-10",
  },
  {
    id: "tip-quit-smoking",
    category: "Heart",
    title: "Quitting smoking pays off fast",
    text: "Within 20 minutes of your last cigarette, heart rate and blood pressure drop. After a year, your risk of coronary heart disease is about half a smoker's. Free quitline: 1800-11-2356 (8 am to 8 pm, closed Mondays).",
    sources: [S.whoQuit, S.ntqls],
    checked: "2026-10",
  },
];

/** "Before your nurse arrives". Visit-prep content; Nivar's clinical team signs it off. */
export const VISIT_CHECKLIST: ChecklistItem[] = [
  {
    id: "rest",
    text: "Rest for 5 minutes before your blood pressure is taken. Skip tea, coffee, smoking and exercise for 30 minutes before.",
    source: { label: "US CDC", url: S.cdcMeasureBp.url },
  },
  {
    id: "fasting",
    text: "Booked a fasting sugar test? Only water for at least 8 hours before. On diabetes medicines or insulin, ask your doctor how to take them that morning.",
    source: { label: "MedlinePlus", url: S.medlineGlucose.url },
  },
  {
    id: "clothes",
    text: "Wear a loose sleeve and a two-piece outfit, so the nurse can reach your arm for the cuff and your chest for the ECG.",
    source: { label: "Nivar visit tip" },
  },
  {
    id: "papers",
    text: "Keep your medicines and recent reports handy for the doctor's video call.",
    source: { label: "Nivar visit tip" },
  },
];

export const HEALTH_DISCLAIMER =
  "General health information for adults, not medical advice or a diagnosis. Targets differ in pregnancy and for children. Talk to a qualified doctor about your own readings, medicines and treatment, and don't stop or change a medicine without them.";

export const SOURCES_NOTE =
  "Figures come from published studies and public health bodies, not from Nivar patients or Nivar results.";

/** Emergency safety net shown near the BP and pulse tips. Render 112 and 108 as tel: links. */
export const EMERGENCY_NOTE = {
  lead: "Chest pain, sudden breathlessness, weakness or numbness on one side, trouble speaking, or a fast or irregular heartbeat with dizziness or fainting?",
  tail: "Nivar is not an emergency service.",
} as const;

/** Shown under the sources. Set clinicalReviewer once a Nivar doctor has reviewed this file. */
export const CONTENT_REVIEW = { checked: "October 2026", clinicalReviewer: null as string | null };

/** Index of the tip of the day, by calendar day in India (IST, UTC+5:30). */
export function tipOfTheDayIndex(now: Date, count = HEALTH_TIPS.length): number {
  const istDay = Math.floor((now.getTime() + 5.5 * 60 * 60 * 1000) / 86_400_000);
  return ((istDay % count) + count) % count;
}
```

### 8.3 "Health, in numbers" UI (`health-facts.tsx`, Unit 3)

```tsx
export function HealthFacts() // server component, no props
```

- `<Section id="health-facts" titleId="health-facts-title">`.
- `SectionTitle`: eyebrow `Health, in numbers`, title `Most of it is silent.`, accent `Until someone checks.`, lede `High blood pressure and raised blood sugar rarely cause symptoms early on. These figures come from large public-health studies, not from Nivar patients.`
- **Grid:** `<ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">` showing `HEALTH_FACTS.filter((f) => f.featured)`, in data order. Each `<li {...revealProps(i)}>` holds a `<Surface as="article" className="flex h-full flex-col">`:
  - Top row `flex items-center justify-between`: `<Pill tone="neutral">{f.scope}</Pill>` and `<IconTile size="sm">` with the icon mapped from `{ heart: HeartPulse, gauge: Gauge, drop: Droplet, trend: TrendingDown, salt: Soup, screen: ClipboardCheck }`.
  - Figure: `<p className="mt-6 flex flex-wrap items-baseline gap-x-2 text-stat text-primary tabular-nums">{f.figure}{f.figureSuffix && <span className="text-small font-medium tracking-normal text-foreground-2">{f.figureSuffix}</span>}</p>`.
  - Rule: `<span aria-hidden className="fact-rule mt-3 block h-0.5 w-10 rounded-full bg-sage" />`.
  - Text: `<p className="mt-4 text-small text-foreground">{f.text}</p>`.
  - Source: `<p className="mt-auto pt-5 text-caption text-muted-foreground">Source: …</p>`. Each source is `<a href target="_blank" rel="noopener noreferrer" className="rounded-sm underline decoration-border-strong underline-offset-[3px] hover:text-foreground hover:decoration-current focus-ring">{label}<span className="sr-only"> (opens in a new tab)</span></a>`, separated by "; ".
- **Disclaimer:** `<p className="mt-10 flex max-w-[76ch] items-start gap-2.5 text-caption text-muted-foreground"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{HEALTH_DISCLAIMER} {SOURCES_NOTE} Sources checked {CONTENT_REVIEW.checked}.{CONTENT_REVIEW.clinicalReviewer && ` Reviewed by ${CONTENT_REVIEW.clinicalReviewer}.`}</p>`.
- **No CTA, no carousel, no count-up.** Mobile shows all four stacked; there is nothing to swipe.

### 8.4 "Everyday care" UI (`everyday-care.tsx`, `tip-deck.tsx`, `breathing-card.tsx`; Unit 3)

```tsx
export function EverydayCare() // server component, no props
export function TipDeck(props: { tips: readonly HealthTip[]; initialIndex: number; dateLabel: string }) // "use client"
export function BreathingCard() // "use client"
```

**`EverydayCare`:**
- Compute `const now = new Date(); const initialIndex = tipOfTheDayIndex(now); const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(now);`.
- The page is already dynamic (`getCatalog` uses `no-store`). If `next build` objects to `new Date()` during prerendering, call `await connection()` from `next/server` first and make the component `async` (see `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`).
- `<Section id="health-tips" tone="sand" divider="both" titleId="health-tips-title">`, then `<Container>`:
  1. **Proverb strip** (static, the multilingual "health is wealth"): `<ul {...revealProps(0)} aria-label="Sayings about health" className="grid gap-5 border-b border-border-strong pb-8 sm:grid-cols-3 sm:gap-6">`. Each `<li>` for `PROVERBS` holds:
     - `<p lang={p.lang} className="text-[1.25rem] font-medium text-primary">{p.text}</p>`
     - `<p className="mt-1 text-caption text-muted-foreground">{english name} saying · “{p.gloss}”</p>`
  2. `SectionTitle` with `className="mt-8"`: title `Small habits,`, accent `steady health.`, lede `Practical, sourced tips for you and your parents. Try one today, or take a calm minute before your next reading.`
  3. Grid `mt-12 grid gap-5 lg:mt-14 lg:grid-cols-12`:
     - `<div {...revealProps(0)} className="lg:col-span-7"><TipDeck tips={HEALTH_TIPS} initialIndex={initialIndex} dateLabel={dateLabel} /></div>`
     - `<div {...revealProps(1)} className="lg:col-span-5"><BreathingCard /></div>`
     - `<div {...revealProps(2)} className="lg:col-span-12">` holding the visit checklist.
     - Mobile order is the source order: tip, breathing, checklist.
  4. **Visit checklist:** `<Surface as="section" radius="3xl" padding="lg" aria-labelledby="visit-checklist-title">`.
     - Header `flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between`: `<h3 id="visit-checklist-title" className="text-h3">Before your nurse arrives</h3>` and `<p className="text-caption text-muted-foreground">A short checklist for the day of your visit</p>`.
     - `<ul className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-4">`. Each item: `flex items-start gap-3`, the mint check circle (size-6), `<p className="text-small text-foreground">{text}</p>` and `<p className="mt-1 text-caption text-muted-foreground">{source.url ? <a …new-tab link…>{label}</a> : label}</p>`.
  5. **Emergency note:** `<p className="mt-8 flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger-bg px-5 py-4 text-small text-ink"><PhoneCall aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" /><span>{EMERGENCY_NOTE.lead} Call <a href="tel:112" className="font-semibold text-danger underline underline-offset-2 rounded-sm focus-ring">112</a> (or <a href="tel:108" …>108</a> for an ambulance) now. {EMERGENCY_NOTE.tail}</span></p>`.
  6. **Disclaimer and sources:** `<div className="mt-6 flex flex-col gap-3 text-caption text-muted-foreground">` containing the Info-icon disclaimer row (same as 8.3) and `<details><summary className="w-fit cursor-pointer rounded-sm font-medium text-foreground-2 focus-ring">All sources (checked {CONTENT_REVIEW.checked})</summary><ul className="mt-3 flex flex-col gap-1.5">…</ul></details>`. The list holds every unique source URL from the featured facts and all tips, as new-tab links.
- **No CTA in this section.**

**`TipDeck`:**
- **State:** `index` (initially `initialIndex`), `dir` (`1 | -1`), `touched` (false until the first click).
- **Card:** `<Surface as="article" radius="3xl" padding="lg" aria-labelledby={titleId} className="flex h-full flex-col">`, where `titleId = useId()`.
  - Header `flex items-center justify-between gap-3`: `<p className="flex items-center gap-2 text-sm font-medium text-foreground"><span aria-hidden className="size-1.5 rounded-full bg-glyph-amber" />{index === initialIndex ? "Tip of the day" : "Health tip"}</p>`, plus `<p className="text-caption text-muted-foreground">{dateLabel}</p>` only when `index === initialIndex`.
  - Body `mt-6 grid`, with all of these in `[grid-area:1/1]`:
    - **Sizer:** every tip rendered `aria-hidden className="invisible"`, so the card is always the height of the longest tip and there is no layout shift.
    - **Live region:** `<div aria-live="polite" aria-atomic="true">` containing `<div key={tip.id} className={touched ? "tip-in" : undefined} style={{ "--dir": dir } as CSSProperties}>`, which holds `<span className="sr-only">Tip {index + 1} of {tips.length}. </span>` and `<TipBody tip={tip} titleId={titleId} />`.
  - **`TipBody`:**
    - `<Pill tone="mint">{icon}{tip.category}</Pill>`, with icons `{ Checks: Gauge, Heart: HeartPulse, Food: Soup, Movement: Footprints, Sleep: Moon, Sugar: Droplet, Breath: Wind }`.
    - `<h3 id={titleId} className="mt-4 text-h3">{tip.title}</h3>`. Only the live copy gets the id.
    - `<p className="mt-3 text-body text-foreground-2">{tip.text}</p>`.
    - `<p className="mt-4 text-caption text-muted-foreground">Source: …new-tab links…</p>`.
  - Footer `mt-6 flex items-center justify-between gap-4 border-t border-border pt-5`:
    - `<p aria-hidden className="text-caption text-muted-foreground tabular-nums">{index + 1} of {tips.length}</p>`.
    - Two buttons `buttonClass("secondary", "size-11 px-0")` with `aria-label="Previous tip"` / `"Next tip"` and `ArrowLeft` / `ArrowRight` icons. They wrap around.
- **Never auto-advances.**

**`BreathingCard`:**
- **Timing:** 5s in, 5s out, 6 breaths = 60s. This follows the NHS "count 1 to 5 each way" source.
- **State:** `state: "idle" | "running" | "done"` and `t` (elapsed whole seconds).
- **Start:** sets `running`, `t = 0`, and a 1000ms interval that increments `t`. At `t === 60` it clears the interval and sets `done`.
  - Derived: `phase = Math.floor(t / 5) % 2 === 0 ? "in" : "out"`, `count = (t % 5) + 1`, `breath = Math.min(6, Math.floor(t / 10) + 1)`.
- **Stop:** sets `idle`. On `visibilitychange` to hidden while running, also stop. Clear timers on unmount.
- **Markup:** `<Surface as="section" tone="wash" radius="3xl" padding="lg" aria-labelledby={titleId} data-state={state} className="breath flex h-full flex-col items-center text-center">`:
  - `<Eyebrow>One calm minute</Eyebrow>`.
  - `<h3 id={titleId} className="mt-2 text-h3">Breathe with the circle</h3>`.
  - `<p className="mt-3 max-w-[38ch] text-small text-foreground-2">Before a blood pressure reading, your nurse will ask you to sit quietly for five minutes. A few slow breaths can help you feel settled.</p>`.
  - Circle: `<div aria-hidden className="relative mt-8 grid size-40 place-items-center sm:size-44">` containing:
    - `<span className="absolute inset-0 rounded-full border border-border-strong" />`
    - `<span className="breath-disc absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_40%,var(--mint),color-mix(in_oklab,var(--sage)_55%,var(--mint)))]" />`
    - `<span className="relative flex flex-col items-center"><span className="text-h4 text-primary">{label}</span>{state === "running" && <span className="mt-1 text-small text-ink-2 tabular-nums">{count}</span>}</span>`
    - The label is: idle "Ready", running "Breathe in" / "Breathe out", done "Well done".
  - `<p aria-live="polite" className="sr-only">{state === "running" ? (phase === "in" ? "Breathe in" : "Breathe out") : state === "done" ? "Done." : ""}</p>`.
  - `<p className="mt-4 text-caption text-muted-foreground tabular-nums">`: running shows `Breath {breath} of 6 · in through your nose, out through your mouth`; done shows `Done. Notice how you feel.`; idle shows `Six slow breaths, about one minute.`.
  - Button `mt-5`: running is `buttonClass("secondary")` "Stop"; otherwise `buttonClass("primary")` "Start one calm minute" (or "Start again" after done).
  - `<p className="mt-6 text-caption text-muted-foreground">If you feel dizzy, stop and breathe normally. Technique from the <a href={NHS breathing url} …new-tab link…>NHS</a>.</p>`.
- The CSS animation starts on the same render as the interval (`data-state="running"`), so the disc grows during "in" and shrinks during "out". Under reduced motion the disc doesn't scale (`landing.css` §7); the label and count still pace the breathing.

## 9. Callback form (`callback-form.tsx`, Unit 7)

**Keep unchanged:**
- `validate`, the phone digit normalisation, focus-first-invalid, `noValidate`, `method="post"`, the `api.post("/leads", …, { anonymous: true })` call shape, and the success-height lock.

**Changes:**

1. **New optional fields, composed into `message` on the client.** There is no API change.
   - **"Who is the check-up for?"** (first field). A `<fieldset>` with `<legend className="text-[0.9375rem] font-medium text-foreground">Who is the check-up for? <span className="text-caption font-normal text-muted-foreground">Optional</span></legend>` and three radio pills `Myself`, `A parent`, `Someone else`. State `whoFor: "" | "Myself" | "A parent" | "Someone else"`.
     - Each pill: `<label className="relative inline-flex h-11 cursor-pointer items-center rounded-full border border-border-strong bg-card px-4 text-[0.9375rem] font-medium text-foreground transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-mint has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-ring"><input type="radio" name="whoFor" value={v} className="sr-only" checked=… onChange=… />{v}</label>`.
     - Row: `flex flex-wrap gap-2 mt-2`.
   - **"Preferred language for the call"** (after City, optional). A `<select>` with options:
     - `""` → `No preference`
     - Then one option per `LANGUAGES` entry: `value={l.english}`, `lang={l.lang}`, label `{l.endonym}` for English, otherwise `` `${l.endonym} (${l.english})` ``.
     - Hint (13px, linked via `aria-describedby`): `We'll match a coordinator who speaks it when we can.`
   - **Composition on submit:** `const composed = [whoFor && `For: ${whoFor}`, language && `Preferred language for the call: ${language}`, fields.message.trim()].filter(Boolean).join("\n");`. Send `message` only when `composed` is non-empty.
   - **Validation change:** the user's message limit becomes **900** characters (`Keep the message under 900 characters.`), so the composed message stays under the 1000-character server cap.
2. **Field anatomy:**
   - Field wrapper: `flex flex-col gap-2`.
   - Label: `flex items-baseline justify-between text-[0.9375rem] font-medium text-foreground`; Optional tag `text-caption font-normal text-muted-foreground`.
   - Hint: `<p id={id(`${k}-hint`)} className="-mt-0.5 text-caption text-muted-foreground">`, placed between the label and the control and included in `aria-describedby` (the existing `describe(k, true)` helper).
   - Phone hint: `10-digit mobile number. We only call about this request.`
   - `FIELD` constant:
     ```ts
     const FIELD =
       "h-12 w-full scroll-mt-28 rounded-lg border border-input bg-card px-4 text-base text-foreground transition-[border-color,box-shadow,background-color] duration-160 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-transparent hover:border-input-hover focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_var(--primary),0_0_0_5px_color-mix(in_oklab,var(--primary)_14%,transparent)] aria-invalid:border-danger aria-invalid:bg-danger-bg aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--danger),0_0_0_5px_color-mix(in_oklab,var(--danger)_14%,transparent)]";
     ```
     - Field: 48px tall, 12px radius (concentric inside the 24px card with 32px padding), 1px border at 3.53:1, hover 5.30:1.
     - Focus: a 2px teal edge (border plus a 1px ring at 9.45:1) and a soft halo. The transparent focus outline becomes visible in Windows forced-colours mode, where shadows are dropped; it appears only on focus. Never add `outline-none` to fields.
     - Placeholders use full muted colour (5.77:1).
   - **+91 prefix:** `pointer-events-none absolute inset-y-px left-px flex items-center rounded-l-[11px] border-r border-border bg-wash pr-3 pl-3.5 text-base font-medium text-muted-foreground`. Input `pl-[4.5rem] tabular-nums`.
   - **Select:** `FIELD` + `appearance-none pr-10`. The chevron is `text-primary` (was muted).
   - **Textarea:** `FIELD` + `h-auto min-h-28 resize-y py-3 leading-relaxed`. Placeholder (kept): `For example, monthly BP checks for my mother in Jayanagar`.
   - **Field error:** `<p id=… className="flex items-start gap-1.5 text-caption text-danger"><CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />{error}</p>`. Colour is never the only cue: icon, text and border all change.
3. **Server error:**
   - `<div id={id("server")} role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /><p>{serverError}</p></div>`.
   - Default message: `We could not send your request. Please try again in a minute.`, plus `` ` Or call us on ${SITE.phone.display}.` `` only when `SITE.phone` is set.
4. **Submit:** `buttonClass("primary", "w-full", "lg")`. While sending: `<LoaderCircle className="animate-spin" aria-hidden />Sending…`, `disabled` (opacity 60%).
5. **Privacy line:** `<p className="flex items-center gap-2 text-caption text-muted-foreground"><Lock aria-hidden className="size-3.5" />We only use your number to call you about this request.</p>`.
6. **Success state** (same min-height lock, `role="status"`):
   - Check: `<svg viewBox="0 0 64 64" aria-hidden className="size-16"><circle cx="32" cy="32" r="30" fill="var(--mint)" /><circle className="success-ring" cx="32" cy="32" r="30" stroke="var(--teal)" strokeWidth={2} fill="none" pathLength={1} transform="rotate(-90 32 32)" /><path className="success-check" d="M21 33l8 8 15-16" stroke="var(--teal-deep)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} /></svg>`.
   - Heading: `<h3 ref={headingRef} tabIndex={-1} className="font-display mt-5 text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-foreground outline-none">Thanks, {first}. We will call you soon.</h3>`. Focus it on mount (`useEffect` when `done` is set), because the submit button that held focus is gone.
   - Body (kept, with hours from SITE): `A Nivar care coordinator will call you on +91 XXXXX XXXXX, usually within 30 minutes {SITE.hours.inSentence}.`
   - Then `<a href="#health-tips" className="mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-primary underline decoration-border-strong underline-offset-4 hover:decoration-current focus-ring">While you wait: take one calm minute<ArrowRight aria-hidden className="size-4" /></a>`.
   - Then "Send another request" (`text-sm font-semibold text-foreground underline … focus-ring`). It resets every field, including `whoFor` and `language`.
7. **Disabled state** (any button): `disabled:opacity-60 disabled:pointer-events-none`, from the primitives.

## 10. App-wide adjustments (Unit 8)

Token changes do most of the work (2.2). These are the only code edits outside the landing page. **Do not redesign** the patient app or the staff portals.

| File | Change |
|---|---|
| `components/auth-layout.tsx` | **Imports and root:** import `{ newsreader }` from `@/app/accent-font` and add `newsreader.variable` to the root div's className. **Aside:** `bg-ink text-white` → `theme-pine`. Add `<div aria-hidden className="absolute inset-0 bg-ecg-grid-dark" />` as its first child. Logo link: replace `outline-none focus-visible:ring-3 focus-visible:ring-white/40` with `focus-ring`. **Text:** eyebrow `text-white/55` → `text-muted-foreground`; h1 `text-white` → `text-foreground`; points `text-white/75` → `text-foreground-2`; point ring `ring-white/20` → `ring-border-strong` (check icon `text-signal` stays; it is mint inside pine); EcgLine `strokeClassName="stroke-white/40"` → `"stroke-white/30"` (`stroke-signal` glow stays); footnote `border-white/10 text-white/50` → `border-border text-muted-foreground`. **Mobile header:** `bg-ink … text-white` → `theme-pine …`, eyebrow `text-white/60` → `text-muted-foreground`, add `focus-ring` to its logo link. **Main:** `rounded-t-[28px]` → `rounded-t-3xl`. |
| `app/login/page.tsx` | Headline span `className="text-white/55"` → `className="font-accent font-normal text-heading-accent"`. `points[2]` → `"Your report and prescription, usually within the hour"`. `footnote` → `` {`Now serving ${SITE.city}, ${SITE.hours.short}, every day`} `` (import `SITE`). |
| `app/staff/login/page.tsx` | Headline span → `className="font-accent font-normal text-heading-accent"`. Footnote link `text-white/85` → `text-foreground`. |
| `app/login/login-form.tsx`, `app/staff/login/staff-login-form.tsx` | Primary submit buttons only: replace `rounded-xl` with `rounded-full` and remove `shadow-lift`. Nothing else. |
| `components/ui/button.tsx` | `default` variant `hover:bg-primary/80` → `hover:bg-primary-hover`. |
| `components/ui/badge.tsx` | `[a]:hover:bg-primary/80` → `[a]:hover:bg-primary-hover`. |
| `components/ui/sheet.tsx`, `components/ui/dialog.tsx` | Overlay `bg-black/10` → `bg-ink/20`. |
| `app/app/_components/patient-home.tsx` | EcgLine `glowClassName="stroke-signal"` → `"stroke-trace"` (line ~172). |
| `app/app/_components/booking-detail.tsx` | Consult-ready card (~463): `glowClassName="stroke-signal"` → `"stroke-trace"`; its "Doctor is ready" dot `text-signal` → `text-trace` (~466). Full-screen call overlay `bg-[#0a0a0a]` (~495) is **kept**, because video UIs stay near-black. |
| `app/app/_components/checkout-dialog.tsx` | Success disc (~369–370): `bg-signal/25` → `bg-success/25`, `bg-signal text-white` → `bg-success text-white` (6.09:1). |
| `app/app/_components/medical-report.tsx` | `bg-[#FBFAF7]` (~153) → `bg-muted/60`. Line ~377 "In an emergency, call 108." → "In an emergency, call 112 (or 108 for an ambulance)." |
| `components/live/video-call.tsx` | `text-[#0a0a0a]` (65, 226, 266) → `text-ink`; `text-[#C2453D]` (707, 718) → `text-danger`; `bg-[#C2453D] … hover:bg-[#D2554C]` (727) → `bg-danger … hover:bg-danger-hover`. The dark video surfaces (`#1a1a1a`, `#161616`, `#0f0f0f`) and the mic-off coral are kept. |
| `app/doctor/_components/consult-panel.tsx` | `text-[#0a0a0a]` (31, 190) → `text-ink`. |
| `app/nurse/_components/device-card.tsx` | `text-[#0a0a0a]` (117) → `text-ink`. The `#0f0f0f` device panel is kept. |
| `components/live/live-map-inner.tsx` | Pin `fill="#0a0a0a"` → `fill="#0E4F45"`; route `color: "#0a0a0a"` → `"#0E4F45"`. |
| `components/live/live-map.css` | `#f4f4f1` → `var(--wash)`; `#6a6a66` → `var(--muted-foreground)`; text `#0a0a0a` → `var(--ink)`; `#e4e4df` → `var(--border)`; marker and nurse-name backgrounds `#0a0a0a` → `var(--teal-deep)`; `rgba(10, 10, 10, a)` → `rgb(16 32 27 / a)`. |
| `components/live/live-map.tsx` | Skeleton `bg-[#E9EEE9]` → `bg-wash`; `#DCE4DE` in the gradient → `var(--hairline)`; `text-[#5B6B67]` → `text-muted-foreground`. |
| `components/live/ecg-strip.tsx` | `brand` palette → `{ paper: "#F7FAF8", minor: "#E4ECE8", major: "#C9D8D1", trace: "#10201B", text: "#5A6964" }`. Literals are required here. The pink `paper` palette is kept. |
| `app/dev/live/page.tsx` | `accent-[#0a0a0a]` → `accent-primary`. |

**Not changed on purpose:**
- `lib/format.ts`: the status and vital classes become AA through the tokens.
- `staff-shell.tsx`, `app-shell.tsx`: tokens only.
- Admin charts: they read `--chart-*`.
- `MONITOR` canvas colours: Unit 4 only fixes dim text.
- `bg-[#0f0f0f]` device and video panels.

## 11. Work units

**Order:**
1. **Unit 0** runs first, alone, and must pass its acceptance before anything else starts.
2. **Units 1 to 9** then run in parallel.
3. **Unit 9 (integration)** starts with the edits that only depend on Unit 0. It adds each new section import only once that file exists and exports the named component (poll with `test -f` and `grep -q "export function <Name>"`). It runs the final whole-app checks after the other units report done.

**Ownership is disjoint.** A file not listed under your unit is read-only to you.

**Every unit:**
- Uses only Unit 0's exports plus its own files.
- Runs `cd /Users/chirag/Work/nivar/apps/web && npx tsc --noEmit -p .` and `npx eslint <your files>`. Fix your own errors; ignore errors in files you don't own.
- Screenshots its section at desktop, `--mobile` and `--reduced`.
- Reports its changed files, any deviations, and any requests for other files.

### Unit 0: Foundation (runs first, alone)

**Files:**
- `apps/web/src/app/globals.css` (replace with 2.1)
- `apps/web/src/app/fonts.ts` (new, 3.1)
- `apps/web/src/app/layout.tsx` (3.2)
- `apps/web/src/lib/utils.ts` (3.3)
- `apps/web/src/components/landing/primitives.tsx` (4.1)
- `apps/web/src/components/landing/reveal.tsx` (new, 4.2)
- `apps/web/src/components/landing/motion.tsx` (new, 4.3)
- `apps/web/src/components/landing/live-feeds.ts` (re-export only, 4.3)
- `apps/web/src/lib/site-facts.ts` (new, 4.4)
- `apps/web/src/components/landing/l10n.ts` (new, 4.5)
- `apps/web/src/components/landing/landing.css` (replace with 5.2)
- `apps/web/src/components/brand/logo.tsx`, `apps/web/src/components/brand/ecg-line.tsx`, `apps/web/src/app/icon.svg` (4.6)

**Exports others rely on:**
- `fonts.ts`: `generalSans`, `notoKannada`, `notoDevanagari`; `accent-font.ts`: `newsreader` (its own module so it is preloaded only on `/` and the sign-in pages)
- `primitives.tsx`: `buttonClass`, `ButtonLink`, `ARROW_NUDGE`, `bookHref`, `BOOK_LABEL`, `ROW_CTA_LABEL`, `revealProps`, `Container`, `Section`, `SectionTone`, `Eyebrow`, `SectionTitle`, `Surface`, `GlassCard`, `LiveDot`, `IconTile`, `Pill`, `Avatar`, `inr`
- `reveal.tsx`: `RevealObserver`
- `motion.tsx`: `usePrefersReducedMotion`, `useMotionPaused`, `setMotionPaused`, `MotionToggle`
- `site-facts.ts`: `SITE`
- `l10n.ts`: `LANGUAGES`, `TAKE_CARE`, `STAY_HEALTHY`, `PROVERBS` and its types
- `ecg-line.tsx`: `EcgLine` with `draw`

**Acceptance:**
- `tsc` and `eslint` pass on these files.
- The existing (unmigrated) landing page still renders with no console errors (the deprecated aliases keep old call sites compiling), and it already shows the mist and teal palette.
- `node -e` check from section 12 (l10n code points) passes.
- `/login` renders.

### Unit 1: Nav, hero, rotator, reassurance

**Files:**
- `components/landing/site-nav.tsx`
- `components/landing/hero.tsx`
- `components/landing/mini-trace.tsx`
- `components/landing/health-words.tsx` (new)
- `components/landing/reassurance.tsx` (new)

**Exports:**
- `SiteNav()`
- `Hero({ fromPrice }: { fromPrice: number })`
- `MiniTrace({ className })`
- `HealthWords({ className })`
- `ReassuranceStrip()`

**Spec:** 6.1, 6.2, 6.3, 7.

**Acceptance:**
- **Fold:** at 360×640 the primary CTA's bottom edge is at or above 640. At 390×844 the CTA and the top of the photo are both visible.
- **Rotator:**
  - It cycles en → kn → hi → mr at 5s with no layout shift. CLS is 0, measured with a `PerformanceObserver` for `layout-shift` while it cycles.
  - It pauses on hover, on focus, offscreen and when the tab is hidden.
  - The pause button stops it, the mini-trace and the live dots.
  - `--reduced` shows English, static.
- **Horizontal overflow:** none at 320, 360 or 390.
- **Hero assets:** the H1, lede and photo have no `landing-reveal`. The photo uses `loading="eager" fetchPriority="high"` and no `priority`.
- **Scroll-spy:** marks the current nav link with `aria-current`.

### Unit 2: Programmes, how it works

**Files:**
- `components/landing/programmes.tsx`
- `components/landing/programme-glyphs.tsx` (new)
- `components/landing/how-it-works.tsx`

**Exports:**
- `Programmes({ packages }: { packages: Package[] })` (signature unchanged)
- `HowItWorks()`
- `ProgrammeGlyph`, `programmeStyle`, `PROGRAMME_STYLES`, `DEFAULT_PROGRAMME_STYLE`

**Spec:** 6.4, 6.5.

**Acceptance:**
- Four cards come from the fallback catalog. Each shows a glyph, tagline, price, MRP and "Book →", or "Enquire →" with booking off.
- The focus ring is visible on every card (teal, 2px offset).
- Glyphs animate once on reveal and once on hover, and sit still under `--reduced`.
- The connector draws once (desktop); a vertical line shows on mobile.
- The soft CTA follows `bookingEnabled`.

### Unit 3: Health facts and Everyday care

**Files** (all new):
- `components/landing/health-content.ts`
- `components/landing/health-facts.tsx`
- `components/landing/everyday-care.tsx`
- `components/landing/tip-deck.tsx`
- `components/landing/breathing-card.tsx`

**Exports:**
- `HealthFacts()`
- `EverydayCare()`
- `TipDeck({ tips, initialIndex, dateLabel })`
- `BreathingCard()`
- From `health-content.ts`: `HEALTH_FACTS`, `HEALTH_TIPS`, `VISIT_CHECKLIST`, `HEALTH_DISCLAIMER`, `SOURCES_NOTE`, `EMERGENCY_NOTE`, `CONTENT_REVIEW`, `tipOfTheDayIndex` and its types

**Spec:** 8.

**Acceptance:**
- **Content:** exactly the 4 featured facts. `health-content.ts` matches 8.2 byte for byte.
- **Tip deck:** stays the same height through all 11 tips. Prev and Next wrap around. Keyboard and screen readers get a polite announcement only on click.
- **Breathing card:** runs 60s and stops itself. Stop works, and so does a hidden tab. `--reduced` shows no scaling.
- **No CTA** in either section.
- All external links open in a new tab with the sr-only notice.
- `#health-facts` and `#health-tips` are reachable.

### Unit 4: Live section and monitors

**Files:**
- `components/landing/live-section.tsx`
- `components/landing/live-dashboard.tsx`
- `components/live/ecg-monitor.tsx`
- `components/live/monitor-shared.tsx`
- `components/live/steth-monitor.tsx`

**Exports:**
- `LiveSection()`
- `LiveDashboard({ className })`
- `EcgMonitor`: new optional `paused` and `pausedLabel` props
- `LiveBadge`: new optional `paused` prop

**Spec:** 6.7.

**Acceptance:**
- The pine section has no hex literals in its className.
- The Pause button freezes the trace on its last frame, and Play resumes without a "Waiting for device" flash.
- Under `--reduced`, the monitor starts paused with the paused label; Play starts it, and no heartbeat icon animation runs.
- `/dev/live` (doctor and nurse monitor components) renders exactly as before apart from the brighter dim text and the mint LIVE badge (compare screenshots).
- The demo shows BP 126/78 Elevated (amber) and the "Demo with simulated readings…" caption.

### Unit 5: Devices, pricing, families

**Files:**
- `components/landing/devices.tsx`
- `components/landing/pricing.tsx`
- `components/landing/families.tsx`

**Exports (signatures unchanged):**
- `Devices()`
- `Pricing({ packages, services }: { packages: Package[]; services: Service[] })`
- `Families()`

**Spec:** 6.8, 6.9, 6.10.

**Acceptance:**
- **Copy:** no "Pay after the visit" anywhere.
- **Pricing CTAs:** row CTAs are 44px pill buttons whose accessible names include the visible label. With an odd number of services, the extra cell links to `#callback`.
- **Sticky column:** the left column sticks on lg.
- **Families timeline:** staggers in once.
- **Booking off:** labels read "Enquire" / "Request a callback", and links go to `#callback`.

### Unit 6: Doctors, FAQ

**Files:**
- `components/landing/doctors.tsx`
- `components/landing/faq-section.tsx`
- `components/landing/faq.tsx`

**Exports:**
- `Doctors()`
- `FaqSection({ fromPrice, completePrice })`
- `FaqAccordion({ items })`
- `FaqItem` type

**Spec:** 6.12, 6.13.

**Acceptance:**
- **Doctors ARIA:** no `role="table"`, `row` or `cell` remains. On mobile, every cell shows a visible label; on desktop the three columns read correctly; axe reports no ARIA errors.
- **FAQ triggers:** at least 56px tall, with a rounded focus ring.
- **FAQ copy:** uses `SITE` for hours and payment, and the new report question is present.
- **Closing line:** "Still unsure?" links to `#callback`.

### Unit 7: Callback, final CTA, footer

**Files:**
- `components/landing/closing.tsx`
- `components/landing/callback-form.tsx`

**Exports:**
- `Callback()`
- `FinalCta()`
- `SiteFooter()`
- `CallbackForm()`

**Spec:** 6.14, 6.15, 6.16, 9.

**Acceptance:**
- **Payload:** a valid submit posts exactly `{ name, phone, city, message? }`. The message contains the "For:" and "Preferred language for the call:" lines only when chosen. Verify with the network panel or by mocking; the dev server has no backend, so the server-error state is also exercised.
- **Errors:** focus moves to the first invalid field. The error icon, text and border all show.
- **Success:** focus moves to the heading and the check draws.
- **Final CTA:** the ECG hairline draws once. The footer shows the emergency pill (tel links), the guidance line and the Pause animations pill.
- **Copy:** no "Pay after the visit".

### Unit 8: App-wide

**Files:** every file listed in the section 10 table.

**Exports:** unchanged.

**Acceptance:**
- `/login` and `/staff/login`: screenshots at desktop and mobile show the pine panel, the serif accent, a teal primary button and visible input borders.
- `/dev/live` renders the map, strip and video controls with no black-ink leftovers.
- `grep -rn "#0a0a0a" apps/web/src` returns only the kept video and device surfaces listed in section 10.
- `tsc` passes.

### Unit 9: Integration

**Files:**
- `apps/web/src/app/page.tsx`
- `apps/web/next.config.ts`

**Step 1** (immediately; depends only on Unit 0):
- In `next.config.ts`, add `images: { formats: ["image/avif", "image/webp"] }` next to `turbopack`.
- In `page.tsx`:
  - Import `newsreader` from `@/app/accent-font`, `cn` from `@/lib/utils`, and `RevealObserver`.
  - Root: `<div data-landing className={cn(newsreader.variable, "flex min-h-dvh flex-1 flex-col bg-background")}>`.
  - Render `<RevealObserver />` as the last child of the root.
  - Skip link: append `focus-ring` to its className.
  - Metadata:
    - Keep `TITLE`.
    - `DESCRIPTION` = `A Nivar nurse visits your home in Bangalore with a smart ECG and stethoscope, a full-time Nivar doctor watches your readings live and consults on video, and your report is usually ready within the hour.`
    - OpenGraph and Twitter `title` = `Your doctor's check-up, at your doorstep.`

**Step 2:** as each file appears, wire the final order. The end state is:

```tsx
<SiteNav />
<main id="main" className="flex-1">
  <Hero fromPrice={fromPrice} />
  <ReassuranceStrip />
  <Programmes packages={packages} />
  <HowItWorks />
  <HealthFacts />
  <LiveSection />
  <Devices />
  <Pricing packages={packages} services={services} />
  <Families />
  <EverydayCare />
  <Doctors />
  <FaqSection fromPrice={fromPrice} completePrice={complete} />
  <Callback />
  <FinalCta />
</main>
<SiteFooter />
<RevealObserver />
```

Imports:
- `ReassuranceStrip` from `@/components/landing/reassurance`
- `HealthFacts` from `@/components/landing/health-facts`
- `EverydayCare` from `@/components/landing/everyday-care`
- All others as today

**Step 3** (after all units report done): run the full section 12 checklist.
- `cd apps/web && npx tsc --noEmit -p . && npx eslint && npx next build`. The dev server writes to `.next/dev`, so building alongside it is safe.
- Full-page screenshots: desktop, mobile, `--reduced`.
- Report failures to the orchestrator with file and owner. Do not edit other units' files.

## 12. Acceptance checklist (whole page)

**Visual and brand**
- [ ] No pure black or pure white page fields. The only dark surfaces are the Live section, the final CTA panel, the hero ETA card and the monitor screens.
- [ ] One action colour (deep teal). Warm accents appear only in glyphs, the tips band, the amber dot and Elevated chips.
- [ ] Every band change has a hairline (6.0). There are no doubled borders.
- [ ] Every card, button, chip, input and photo uses the radius scale. No `rounded-[14px]`, `rounded-[10px]` or `rounded-[22px]` remain in `components/landing`.
- [ ] `grep -nE "#[0-9a-fA-F]{3,8}" apps/web/src/components/landing/*.tsx` returns only SVG glyph `#fff` fills.

**Content truth**
- [ ] "Pay after the visit", "same evening" and "At home, within the hour" no longer appear (`grep -rn` over `src`).
- [ ] Hours, report time, payment and emergency lines come from `SITE`.
- [ ] Health copy matches 8.2. The four featured facts carry their scope, and every fact and tip has a source link.
- [ ] The Live demo and the hero cards carry their "sample" or "demo" captions.
- [ ] Clinician link check before launch: `for u in $(grep -oE 'https://[^"]+' apps/web/src/components/landing/health-content.ts | sort -u); do curl -s -o /dev/null -w "%{http_code} $u\n" -L -A "Mozilla/5.0" "$u"; done`. Open the AHA, MoHFW/newsonair, IDF, NHS hypoglycaemia and ntqls.in pages in a browser and confirm the quoted wording.

**Multilingual**
- [ ] `node -e 'const s=require("fs").readFileSync("apps/web/src/components/landing/l10n.ts","utf8"); if (/[क़-य़]/.test(s) || s !== s.normalize("NFC")) { console.error("FAIL"); process.exit(1) } console.log("ok")'` prints `ok`.
- [ ] Every Indic string on the page sits in an element with the correct `lang`. Hindi and Marathi render in Noto Sans Devanagari and Kannada in Noto Sans Kannada (DevTools > Rendered fonts). Nothing uses a faux bold and nothing is clipped.
- [ ] `₹` still renders in General Sans. The Indic font files load only on `/`, never on `/app` or the staff routes (Network panel).

**Accessibility (WCAG 2.2 AA)**
- [ ] Contrast as in 2.3. An axe or Lighthouse run on `/` reports no contrast failures.
- [ ] Every interactive element shows the 2px teal (or mint on pine) focus outline. Tab through the whole page, including the programme cards, the chips, the tip buttons, the radio pills and the footer toggle.
- [ ] Targets are at least 44px for pills, row CTAs, chips (hit area), the tip arrows, FAQ triggers (56px) and radio pills.
- [ ] One h1. h2 per section (the reassurance strip and footer h2s are sr-only). No skipped levels inside sections.
- [ ] 2.2.2: the rotator, mini-trace, live dots and ECG monitor all stop with Pause animations, which is reachable in the hero, the Live dashboard and the footer. The breathing guide is user-started. Nothing else moves for more than 5s.
- [ ] Reduced motion (`--reduced`): nothing moves on its own, and every element is visible.
- [ ] No JavaScript (disable JS): every section and all copy is visible, and the rotator shows English.
- [ ] Form: labels, hints and errors are linked by `aria-describedby`. Errors use an icon plus text. The server error uses `role="alert"` and success uses `role="status"` with focus moved to the heading.

**Motion**
- [ ] The hero H1, lede, CTAs and photo never animate. The rotator causes no layout shift.
- [ ] Per viewport: at most one ambient loop, plus the rotator in the hero, plus one pulsing dot in Live.
- [ ] One-shots never replay on mouse-out (glyph hover wrappers).

**Performance**
- [ ] LCP element (desktop photo, mobile H1) renders without waiting for any animation. Lighthouse mobile LCP is at most 2.5s on the dev build at a comparable baseline; CLS is under 0.05; no long tasks over 200ms from the landing scripts.
- [ ] Only Newsreader Italic (about 30KB) is preloaded beyond General Sans. Noto Kannada and Devanagari (about 81KB together) load lazily and only on `/`.
- [ ] No new npm dependencies (`git diff apps/web/package.json` is empty).

**Responsive**
- [ ] No horizontal overflow at 320, 360, 390, 768, 1024 or 1440 (`shot.mjs` prints overflow).
- [ ] 360×640: the primary CTA is in the first viewport. The hero photo appears directly after the CTAs and trust row.
- [ ] Page height: desktop (1440) at most about 11,500px; 390px wide at most about 16,500px.

**`bookingEnabled=false`** (run the dev server once with `NEXT_PUBLIC_BOOKING_ENABLED=false` on another port, for example `npx next dev -p 3101`)
- [ ] Every booking CTA reads "Request a callback" or "Enquire" and points at `#callback`.
- [ ] No "Log in" or staff login links appear.
- [ ] The Final CTA reads "Plan your first check-up today."

**Build**
- [ ] `npx tsc --noEmit -p .`, `npx eslint` and `npx next build` pass with no new warnings about `priority` or fonts.

## 13. Open questions for the founder

The spec ships safe defaults. Each one is a single edit in `lib/site-facts.ts` or one copy line.

1. **Payment timing.** The app requires payment to confirm a booking, so "Pay after the visit" was removed. The FAQ now says "pay when you confirm your booking; full refund if the nurse does not arrive". Is the refund promise right?
2. **Hours.** The landing page said 7 am–9 pm and the login page said 7 AM–8 PM. The spec uses 7 am to 9 pm everywhere. Which is correct?
3. **Promise.** The H1 changed from "At home, within the hour" to "At your doorstep". The report promise is now "usually within the hour" of the visit everywhere. Is that true in operations?
4. **Phone and WhatsApp.** Contact numbers are hidden until `SITE.phone` and `SITE.whatsapp` are set. Families booking for elders strongly expect a number.
5. **Call languages.** The callback form offers Kannada, Hindi and Marathi "when we can". Can the coordinators cover those languages? If not, trim the list in `l10n.ts` usage or remove the field.
6. **Clinical sign-off.** A Nivar doctor should review `health-content.ts` (facts, tips, the visit checklist) and set `CONTENT_REVIEW.clinicalReviewer`. Counsel should check the health copy against the ASCI healthcare guidelines.
7. **Native sign-off.** Two native reviewers have approved every Indic string used. A final human read of the live page (rendering and context) is still recommended. "For Amma · ಅಮ್ಮ · माँ · आई" was not reviewed and is not used.
8. **Trust content to add later (no fabrication meanwhile):** real doctor photos with names, qualifications, KMC numbers and languages spoken; privacy, terms and refund pages; the legal entity and address for the footer.
