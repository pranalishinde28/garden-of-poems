# UX audit — The Garden of Poems

October 2026, on the `feat/ux` branch (after reading while swinging, the avatar and the map).

## How this was done

- **Walk-throughs:** a first-time guest, desktop (1400×820) and phone (390×844, touch), with `node dev/screenshot.mjs --flow audit`. Screens and raw results are in `dev/shots/audit/` (not in Git).
- **Automated checks:** axe-core (WCAG 2 A/AA plus best practice) on every screen, in day and night, a count of HUD buttons, their size and how many are off-screen, and frame times on the development Mac.
- **Signed-in owner and visitor:** checked by reading the code paths (`cloud/*.js`). Exercising them for real needs a test database, which Phase 6 adds (local Supabase), so they are listed with that caveat.
- **Not covered:** real phones and screen readers. Contrast on translucent panels can't be measured automatically (the background is the moving 3D scene); those findings come from the screenshots.

## Findings, ranked by impact

Impact means how many people it affects and how badly: **High** blocks or confuses most people, **Medium** hurts some people or some of the time, **Low** is polish.

| # | Impact | Who | Finding | Evidence |
|---|---|---|---|---|
| 1 | High | Phone | **Four of the eleven HUD buttons are off-screen.** "Walk through time" and "Write" can't be reached by touch at 390 px. | audit: `offscreen: 4`; `could not reach #h-time, #h-write` |
| 2 | High | Everyone | **The first steps are a single faint line** at the bottom ("Walk with WASD…") that disappears after 9 s. It doesn't say where to write, what glows, or how to read. On phones the joystick and the corner map cover it. | `desktop-02-first-walk`, `phone-02-first-walk` |
| 3 | High | Everyone | **"How to move" shows that same line again, and nothing else.** There is no list of keys or controls anywhere. | `desktop-07-help` (no visible change) |
| 4 | High | Everyone | **Eleven unlabelled icon buttons.** Their meaning only appears on hover (not on touch). Rarely used ones (season, moonlight, view, gate) sit beside daily ones. | HUD in every screenshot |
| 5 | High | Signed-in | **No saving state.** Nothing says whether a poem reached the account, is still saving, or failed. Errors only appear as a brief toast, and there is no offline handling. | `cloud/cloud.js` `syncNow`: a failure shows one toast (`Cloud.warned`) |
| 6 | Medium | Everyone | **Panels behave differently from one another.** Esc closes the reader, editor and pop-ups, but not Customize or Gardens. Clicking outside closes only pop-ups. Focus is neither moved into the panel nor kept there. | `ui/input.js` Escape branch; no focus management |
| 7 | Medium | Phone | **The joystick, corner map and hint sit over open panels** (Gardens and Customize show the joystick through them), and the prompt above the joystick is crowded. | `phone-03-gardens`, `phone-04-customize` |
| 8 | Medium | Everyone | **Low contrast on light text over a translucent panel** when the scene behind is bright (Gardens placeholders, menu items, small italic hints). At night the HUD icons nearly vanish against the sky. | `desktop-03-gardens`, `desktop-06-menu`, `desktop-10-night` |
| 9 | Medium | Screen readers, keyboard | **The action prompt (`#cue`) is a button with no accessible name** (axe: critical). Content sits outside landmarks (axe `region`). Moving and interacting needs a mouse or keys, and only the map offers a keyboard route to every poem. | axe `button-name` (#cue), `region` (#c, h1, #time-pop) |
| 10 | Medium | All devices | **No quality setting.** About 23k grass tufts, a reflection pass, shadows and post-processing always run at full settings. It holds 60 fps on the development Mac (median 16.7 ms, 95th percentile 16.7 ms), but nothing adapts for weaker laptops or phones. | audit `fps`; CLAUDE.md trap 6 |
| 11 | Medium | Writers | **Writing has no safety net.** A half-written poem is lost if the panel closes or the tab reloads. A deleted poem is gone at once (after a confirm), with no undo. There is no word or line count. | `ui/writing.js`, `ui/reading.js` `#r-del` |
| 12 | Medium | Phone | **The editor and on-screen keyboard:** the editor doesn't follow `visualViewport`, so with the keyboard open, the lower fields and "Plant this poem" can sit under it. | `ui/writing.js`, no viewport handling |
| 13 | Low | Phone | **Small tap targets on the intro:** "Or wander a sample garden first" and "Sign in or create an account" are 15–18 px text links. | `phone-01-intro` |
| 14 | Low | Everyone | **Reduced motion is respected only partly.** Camera tweens are capped and the text fades are cut, but drifting petals, fireflies, rain and the swing's sway carry on. | `reduceMotion` in `player/camera.js`, CSS |
| 15 | Low | Visitors | **Visiting:** the "Visiting X's garden" bar and "Return to my garden" are clear, but the map and corner map don't say whose garden it is beyond the title. Notes are reachable only from inside a poem. | `cloud/visiting.js` (code reading) |

## What I'm fixing in this phase

These follow your brief, in impact order:

1. **HUD (1, 4):** a small primary row with clear icons, each with a tooltip and its keyboard shortcut: Write, Map, Sound, Customize, Gardens, Help (?), More (⋯). Season, moonlight, view, time, rain, the gate and the rest move into ⋯ as labelled items. It fits a 360 px phone.
2. **First steps (2, 3):** a short, skippable three-step introduction (move, the bench, the map and reading), shown once. Plus a **"?" help sheet** listing every key and touch control.
3. **Panels (6, 7, 9):** one behaviour for all of them. Esc closes, clicking outside closes, there is a visible ×, focus moves in and returns, and Tab stays inside. They scroll on small screens. While a panel is open, the joystick, corner map and hints step aside. The prompt gets an accessible name, and landmarks get roles.
4. **Feedback (5):** a quiet saving line for signed-in gardens ("Saved", "Saving…", "Not saved yet: offline"), offline and online notices, and loading and error states on sign-in and the Gardens actions. (A real offline queue, retries and conflicts come in Phase 6.)
5. **Accessibility (8, 9, 14):** stronger panel backgrounds and text colours in day and night, visible focus outlines, screen-reader announcements when a poem opens, and reduced motion that also stills particles and the swing's auto-sway.
6. **Performance (10):** a Quality setting (Auto, Low, Medium, High) that scales grass density, shadows, the reflection pass, post-processing and pixel ratio. Auto measures frame times during the first seconds and settles on a level.
7. **Mobile (12, 13, 7):** the editor follows the on-screen keyboard, intro links become 44 px targets, and the joystick gets a dead zone and a softer response.
8. **Writing (11):** drafts autosave on this device, a word and line count, a gentle mood suggestion from the words (accept or ignore), and "Poem removed. Undo" for a few seconds after a delete.

## Proposals (not built; for your OK)

Ideas that fit the vision but go beyond the brief:

- **A "poems" list for screen readers and keyboards:** a plain, quiet list (by region or date) that opens each poem in the world. The map partly covers this today.
- **Seasons from your writing:** let the garden's season follow when most of your poems were written, as the original brief described (spring, summer, autumn, winter, including snow).
- **A walk through time, with a slider:** scrub through months and watch plants appear in the order they were written.
- **Gentle sound per region:** water near the pond, insects in the Moon Garden at night, birds in the meadow; very quiet, and off with the music switch.
- **"Return to where I was" after a glide**, and bookmarks for favourite poems on the map.
- **Shareable single-poem links** (`?garden=user&poem=id`) that open straight into that plant, with a soft preview card for social sites.
- **Writing prompts at the bench** for days when nothing comes.
- **Visitors' footprints:** see how many people walked your public garden this week, without names.
- **Realtime presence** (the Phase 4 stretch goal): see other signed-in visitors as figures in the same garden. Movement only, no chat.
