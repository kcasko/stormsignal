# Storm Signal — interface design

Rebuilt November 12, 2026 to the three-experience structure (Overview / When to go / Storm Prep). The earlier storm-window dial prototype is superseded; its rules about honest timing, explicit dates, and demo isolation carry over.

## Information hierarchy

1. **Official protective action** (only when an urgent warning is active) — full-width banner above everything, NWS instruction text verbatim.
2. **Storm Signal level** for the next 24 hours — one word (Low … Critical, or Unknown) on a panel tinted with the level's colour, a labelled five-step scale (so the scale explains itself without a legend), one sentence saying *why*, and an **hour-by-hour ribbon**: 24 cells, each coloured by the highest factor that applies to that hour (`shared/ribbon.ts`), with the peak run named in words ("Highest: High, 5:00 PM – 7:00 PM"). Hours with missing NWS data are hatched as Unknown, never Low. Screen readers get the ribbon as runs ("High 5PM to 7PM; …").
3. **Official NWS alerts** — kept visually separate from the Storm Signal level, labelled "Official", with NWS severity and full text.
4. **Evidence** — the contributing factors, each with its threshold and time window, then the hourly timeline.
5. **Provenance** — data source, retrieval time, forecast update time, stale/failed notices.

## Wireframes

### Desktop (≥ 960 px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ STORM SIGNAL   Overview  When to go  Storm Prep        [Kalamazoo, MI ▾]    │
│                                          LIVE NWS · retrieved 9:41 PM [↻] │
├──────────────────────────────────────────────────────────────────────────┤
│ ▌SIMULATED SCENARIO — not a real forecast            (only in demo mode)  │
│ ▌TORNADO WARNING — take shelter now. <NWS instruction text>  (urgent only)│
├───────────────────────────────────────────┬──────────────────────────────┤
│ NEXT 24 HOURS                              │ OFFICIAL NWS ALERTS          │
│ ELEVATED  ■■■□□                            │ Wind Advisory  · Moderate    │
│ Gusts may reach 48 mph (≥46 threshold)     │ until Fri 7 PM               │
│ Fri 2 PM – 7 PM.                           │ [Read full alert]            │
│                                            │                              │
│ WHY THIS LEVEL                             │ NOW AT KAZO (obs. 9:35 PM)   │
│ ▸ Forecast gusts 48 mph   Elevated  2–7 PM │ 41°F · Cloudy · N 10 mph     │
│ ▸ Thunder chance 25%      Moderate  4–6 PM │                              │
│ ▸ Wind Advisory (official) Moderate        │ [Compare my plans →]         │
│ Limitations: …                             │ [Build a prep list →]        │
├───────────────────────────────────────────┴──────────────────────────────┤
│ HOURLY TIMELINE  (scrolls horizontally inside its own box)                │
│ 9P 10P 11P 12A …  temp / gust bar / thunder % / precip %                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile (< 960 px)

```
┌──────────────────────────┐
│ STORM SIGNAL  [Kzoo ▾][↻]│
│ LIVE NWS · 9:41 PM       │
├──────────────────────────┤
│ (urgent banner)          │
│ NEXT 24 HOURS            │
│ ELEVATED ■■■□□           │
│ one-sentence reason      │
│ Official alerts (list)   │
│ Why this level (list)    │
│ Hourly (h-scroll box)    │
├──────────────────────────┤
│ Overview│When to go│Prep   │  ← fixed bottom nav, 56 px
└──────────────────────────┘
```

### When to go

```
ACTIVITY  [Driving] [Outdoor event] [Home prep]      DURATION [1 h ▾]
┌─────────────┬─────────────┬─────────────┐
│ A Leave now │ B In 3 h    │ C In 6 h    │   ← columns on desktop,
│ 9:45–10:45P │ 12:45–1:45A │ 3:45–4:45A  │     stacked on mobile
│ MODERATE ■■ │ ELEVATED ■■■│ LOW ■       │
│ gust 34 mph │ gust 47 mph │ gust 22 mph │
│ factors…    │ factors…    │ factors…    │
│ unknowns…   │             │             │
└─────────────┴─────────────┴─────────────┘
WHAT CHANGES BETWEEN OPTIONS — plain sentences comparing B and C to A.
Never "safe". Warnings override the whole panel.
```

### Storm Prep

```
WHAT MATTERS TO YOU  [x] Home [x] Vehicle [ ] Household [x] Electronics
Hazards in play: High wind · Thunderstorms (from forecast + alerts)
BEFORE (3 of 7 done ▬▬▬▭▭)  │ DURING              │ AFTER
☐ Secure outdoor furniture  │ ▸ Stay indoors away │ ▸ Avoid downed lines
  why · when · source       │   from windows      │ ▸ Generator outdoors
```

## Interaction flows

- **Location change** → aborts the in-flight request, clears old data (no stale city shown under a new name), loads.
- **Source switch** (Live ↔ labelled scenario) → scenario data never replaces failed live data; the simulated banner is permanent while a scenario is selected.
- **Overview → When to go** → "Compare my plans" carries the current weather; activity defaults to Driving.
- **When to go → Storm Prep** → hazards from the same assessment drive the checklist.
- Checkbox state persists in `localStorage` per task id; Reset clears it.

## Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#f4f2ec` | `#121417` | page |
| `--sheet` | `#fbfaf6` | `#1a1d21` | raised sections |
| `--ink` | `#16181b` | `#ecebe6` | text |
| `--muted` | `#5b5f66` | `#a0a4ab` | secondary text |
| `--rule` | `#d6d2c7` | `#2e3238` | hairlines |
| `--focus` | `#1d4ed8` | `#8fb2ff` | focus ring, selection |
| `--lv-low` | `#33604c` | `#7fb89c` | Low |
| `--lv-moderate` | `#735800` | `#e0c25a` | Moderate |
| `--lv-elevated` | `#9a4607` | `#f29a50` | Elevated |
| `--lv-high` | `#a31f15` | `#f47766` | High |
| `--lv-critical` | `#6e1c93` | `#d48cf2` | Critical (NWS uses magenta for the most urgent warnings) |
| `--lv-unknown` | `#5d626a` | `#8d929a` | Unknown (also hatched) |

All level colours meet WCAG AA (≥4.5:1) for small text on every background in both schemes; checked with axe in `e2e/`. Severity is never colour-only: every level shows its word plus a five-segment glyph; Unknown uses a hatched glyph.

Type: **Source Serif 4** for headlines and the level word (editorial voice), **Public Sans** for UI and body, **IBM Plex Mono** for numbers, times and station IDs. Fonts are bundled from npm (`@fontsource`), so no third-party font requests.

Spacing: 4 px base; steps 4/8/12/16/24/32/48/64. Sections are separated by hairline rules, not cards or shadows. Corner radius 2 px on controls only. Motion: none besides focus/press feedback.

## November 13 local palette refinement

Cool slate page (#edf2f7), white panels, navy text (#172b43), muted slate (#52657b), blue action color (#2159a6). Dark equivalents: page #0c1726, panels #142337, text #edf3fa, muted #a8bbd1 and action #9bc6ff. Severity retains its established colors. A compact introduction explains the product above current conditions; a native disclosure contains the three-step usage guide.

## Dial-led alternative — November 13

The working local alternative restores a 12-hour storm-window dial beside the live planning controls. It derives hourly colors and peak-window text from the current assessment engine. The ring represents general weather; A/B/C/D options use activity-specific exposure rules. Full-day assessment is labelled separately below the planner. The selected activity duration uses a dashed outer track. Dates/time zones are explicit, late custom starts do not wrap, and the hourly text disclosure supplies a color-independent alternative. At phone widths controls precede the dial. Alert maps and history are preserved beneath the planning workspace.

## Storm console — November 13 (final direction)

**Overview is an answer page.** One navy hero band (the dial's palette) holds the answer: the Storm Signal level as a large word on the labelled five-step scale, the one-sentence reason and an expandable "why / what would change it" on the left; current conditions and the four numbers that drive most decisions in the next 24 hours (peak gust and when, thunder chance, snow/ice totals, active official alerts) on the right. The hero redefines the colour tokens locally, so everything inside stays WCAG AA. Below it: the hour-by-hour ribbon, two calls to action (compare when to go, build a prep checklist), how the forecast has changed, and the hourly table, in the left column; official alerts with maps, timelines and ended alerts, then a short product intro, in the right column. Phones: hero, alerts, then the rest.

**When to go owns the dial.** The twelve-hour dial sits beside the activity/time controls and the plain-language "what changes between options"; the option cards run full width below it, three or four across.
