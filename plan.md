# Refresh Rate Test — Build Plan

> Status: **APPROVED — build in progress.**

---

## 1. Project at a glance

| | |
|---|---|
| **Website name** | Refresh Rate Test |
| **Domain** | freerefreshratetest.com |
| **One-liner** | Check your monitor or screen's refresh rate in real time — instantly see whether your display runs at 60Hz, 90Hz, 120Hz, 144Hz, 165Hz, 240Hz, or higher. |
| **Framework** | Astro (`astro ^7.3.8`, Node ≥ 22.12.0) |
| **Styling** | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| **Design language** | `DESIGN.md` — "Linear" near-black dark system (see §4) |
| **Rendering** | 100% client-side measurement, static output (fast, private, no backend) |

---

## 2. Prerequisites & decisions

1. **Plan approved** — build underway.
2. **Tailwind v4 docs snapshot** — being initialized via the skill's sync script (license accepted).
3. **MCP** — only `agora-docs` is connected (unrelated to this project). Astro work uses the official docs (docs.astro.build) + web research.
4. **Fonts (default):** `DESIGN.md` uses Linear's proprietary typefaces; using its documented free substitutes — **Inter** (display/body) + **JetBrains Mono** (numeric/mono readout).
5. **v1 scope:** refresh-rate core + high-value extras (advertised-rate check, device info, frame-time graph, troubleshooting, FAQ). Deep TestUFO-style sub-tests and extra screen tests are v2.

---

## 3. Competitor analysis & how we beat them

> Researched `testufo.com/refreshrate` and `screentester.io/refresh-rate-test/`. We will **not** copy their UI or design — only learn from feature coverage and close the gaps.

### What they do well
- **TestUFO** — the reference tool. Exact decimal Hz readout (e.g. `144.00 Hz`), moving-UFO motion-blur test, split multi-framerate comparison, deep menu (VRR, mouse polling rate, frame-skipping, BFI, chroma subsampling, HDR). Powerful but **dense, dated, intimidating** for casual users.
- **ScreenTester** — lightweight & friendly: auto-detects Hz on load, a simple smoothness animation, and a **troubleshooting guide** for "stuck at 60Hz." Bundled with basic panel checks (dead-pixel, solid colors). But **shallow** on measurement depth.

### Our wedge — "accurate like TestUFO, friendly like ScreenTester, cleaner than both"
1. **Zero-friction auto-detect** — measurement starts on load; big confident live readout of **Current / Average / Max / Min Hz** + a **stability score (%)**.
2. **Honest accuracy** — live **frame-time graph** (ms per frame) with **jitter/stutter** detection and **dropped-frame / frame-skipping** flags, so users trust the number.
3. **"Did you get what you paid for?" check** — pick advertised rate (120/144/165/240…) → pass/fail verdict.
4. **Guided accuracy** — one-click **Fullscreen measure mode**, focus/visibility guard (warn when tab is backgrounded since `requestAnimationFrame` throttles), **multi-monitor guidance**.
5. **Genuinely useful troubleshooting** — OS/device-specific steps (Windows advanced display settings, cable/bandwidth limits like HDMI 1.4 vs DisplayPort/HDMI 2.1, laptop battery-saver, iPhone ProMotion / Android "Smooth display").
6. **Device & display info panel** — resolution, `devicePixelRatio`, color depth, GPU/renderer hint, browser — auto-collected, client-side.
7. **Shareable result card** — clean summary users can screenshot/share.
8. **Original motion/smoothness visual** — our own tasteful moving-object test (not a UFO clone).
9. **Clean, fast, private, ad-free** — static Astro, all measurement in-browser, nothing uploaded. Accessible (`prefers-reduced-motion`, photosensitivity warning on flashing tests).
10. **SEO content** — explainer/FAQ ("What is refresh rate?", "60Hz vs 120Hz vs 144Hz", "Why am I stuck at 60Hz?").

---

## 4. Design system mapping (from `DESIGN.md`)

Near-black "Linear" system → Tailwind v4 `@theme` tokens in a global stylesheet.

- **Canvas** `#010102` (never pure `#000`); **surface ladder** `#0f1011 → #141516 → #18191a → #191a1b`; **hairlines** `#23252a / #34343a / #3e3e44`.
- **Text:** ink `#f7f8f8`, muted `#d0d6e0`, subtle `#8a8f98`, tertiary `#62666d`.
- **Single accent:** lavender-blue `#5e6ad2` (hover `#828fff`, focus `#5e69d1`) — only for brand mark, primary CTA, focus ring, link emphasis. No second accent, no gradients, no spotlight cards.
- **Semantic:** success green `#27a644` only (for "you're hitting your rate" verdicts).
- **Type:** Inter — display 600 w/ aggressive negative tracking (−3px @ 80px) → body 400; JetBrains Mono for the live Hz readout.
- **Shape/space:** 4px base; buttons/inputs `rounded-md` (8px), cards `rounded-lg` (12px), panels `rounded-xl` (16px); 96px between sections; max width ~1280px.
- **Depth:** surface lift + 1px hairline (no drop shadows); focus = 2px lavender ring @ 50%.
- **Rules:** dark-only, lavender scarce, cards never pill-rounded, canvas stays `#010102`.

> The big live **Hz number** is the hero "protagonist" — a lifted `surface-1` panel w/ hairline border + mono readout.

---

## 5. Information architecture

- **`/` (home)** — hero live auto-detecting Hz panel + stats + stability; advertised-rate check; device info; motion/smoothness demo; explainer; FAQ; footer.
- **`/how-it-works`** — how browser measurement works + accuracy caveats (rAF/VSYNC/compositor caps).
- **`/troubleshooting`** — "stuck at 60Hz?" guided fixes by OS/device.
- Global: SEO meta + Open Graph for `freerefreshratetest.com`, favicon, sitemap, `robots.txt`.
- Bonus tests (v2): `/dead-pixel-test`, `/color-test`, `/motion-test`. SEO guides (v2).

---

## 6. Core feature — refresh-rate measurement engine

Client TS module hydrated into the Astro page:

- `requestAnimationFrame` loop using `performance.now()` deltas.
- Compute **instantaneous Hz**, **rolling average** (~1s window), **max/min**, **stability %** from frame-time variance.
- **Dropped-frame / skip detection:** flag frame-time outliers (~2× median) → stutter count.
- **Snap-to-standard:** map stable average to nearest common rate (60/75/90/120/144/165/240/360) while showing exact decimal.
- **Guards:** pause/annotate on `document.hidden` (tab throttling); multi-monitor warning; **Fullscreen** for cleaner timing.
- **Reduced motion:** honor `prefers-reduced-motion`; flashing/motion tests opt-in w/ warning.
- Feeds: live readout, frame-time graph, verdict, shareable result card.

**Accuracy disclosure (in UI):** the browser measures the render loop (tied to the primary display, can be capped by browser VSYNC/OS compositing) — stated plainly.

---

## 7. Component inventory (Astro + Tailwind v4)

- `Layout.astro` (extended) — dark canvas, fonts, global `@import "tailwindcss"`, SEO slot.
- `TopNav`, `Footer`.
- `HzReadout` (hero mono readout + current/avg/max/min + stability).
- `FrameTimeGraph` (lightweight `<canvas>` sparkline).
- `AdvertisedRateCheck` (target → pass/fail verdict).
- `DeviceInfoPanel`.
- `MotionSmoothnessDemo` (original, reduced-motion aware).
- `ResultCard` (shareable summary).
- `FaqAccordion`, `TroubleshootingList`.
- UI primitives: `Button` (primary/secondary/tertiary), `Card`, `StatusBadge`, `SectionEyebrow`.

---

## 8. Build steps

1. Init Tailwind v4 docs snapshot (skill sync). ✅ in progress
2. Install `tailwindcss` + `@tailwindcss/vite`; register Vite plugin in `astro.config.mjs`; create `src/styles/global.css` (`@import "tailwindcss";` + `@theme { … }` tokens). Follow v4 gotchas.
3. Wire fonts (Inter + JetBrains Mono).
4. Build measurement module.
5. Build components → compose `/` → secondary pages.
6. SEO: meta/OG, sitemap, `robots.txt`, favicon.
7. Accessibility + responsive (breakpoints 1440/1280/1024/768/480).
8. Dev server in **background mode** per `AGENTS.md` (`astro dev --background`; `astro dev status|logs|stop`); verify; `astro build`.

---

## 9. Out of scope (v1)
- Accounts/login, backend, databases, analytics vendors.
- Server-side result storage (sharing is client-generated).
- Deep TestUFO-style sub-tests (chroma subsampling, BFI, HDR).

---

## 10. Deliverables
- Working Astro site, Tailwind v4 themed to `DESIGN.md`.
- Home page with live refresh-rate test + §3 differentiators.
- Secondary pages (how-it-works, troubleshooting).
- SEO basics for `freerefreshratetest.com`.
- Clean, accessible, dark-only, ad-free, fully client-side.
