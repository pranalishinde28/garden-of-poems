# The Garden of Poems: context for Claude

You are picking up a project that was built over a long conversation in claude.ai. This file gives you the vision, the history of decisions, how the code is laid out, and the traps already found. Read it fully before changing anything. The owner is a full-stack developer and steers from VS Code. Personal and live-project details are in `CLAUDE.local.md`, which stays out of Git; read it too if it exists.

## The vision

> "What if my poems were a place I could physically walk through?"

The Garden of Poems is a walkable 3D garden where every poem a person writes becomes something growing. There is no list, dashboard or archive. You walk, find a plant, and read the poem it grew from. Over time the garden becomes a personal landscape, a memory palace made of poetry. A person should one day be able to stand somewhere and think "I wrote that when I was 24", or "I haven't visited this part of myself in a long time."

The aesthetic is a dreamy Japanese literary garden crossed with a quiet indie game: cherry blossoms, wisteria, a pond with koi, a stream, stone lanterns, Mount Fuji on the horizon, soft light, fireflies at night. The interface should almost disappear: minimal floating controls, an elegant serif (Cormorant Garamond), translucent paper-like panels. No SaaS dashboard look, no neon, nothing cartoonish or childish.

It is now a multi-user app. Each person signs in, writes, and grows their own garden. They customize what it looks like (scenery, trees, which flowers and animals live there, music, a sign at the gate with their name and links). They keep it private or open it so others can visit, read, and leave kind notes.

The core loop must always feel excellent:

**write a poem → it becomes a seed that flies across the garden and grows → walk → discover → read → keep exploring**

The owner's quality bar, in their words over the conversation: "everything should be very very realistic and interactable", realistic trees, grass, sky, water and petals, nothing confusing to click. Be honest when something cannot be made photoreal with procedural Three.js; say so and propose the realistic route (for example glTF assets or PBR textures).

## Where things stand

### Files
```
index.html            page markup only; loads src/main.js
src/main.js           imports every module in run order, then starts the frame loop
src/styles.css        all CSS
src/core/             util, shared state (state, the clock T, tweens), late.js, loop.js (frame), updates,
                      power.js (the frame-rate policy), things.js (touchable things: fountain, bells)
src/world/            terrain, renderer, textures, sky, lights, wind, geometry, ground, paths, grass,
                      decor, arbors, tulips, swings, lamps, fuji, particles, atmosphere, post
src/plants/           mapping (mood → plant), autumnLeaves, sakura, flowers, types, registry, flowerGardens, samples
src/water/            water.js (shader), reflection.js
src/animals/          animals.js (and SFX)
src/audio/            music.js (piano, own files, rain sound)
src/player/           camera.js (player, tweens, collision), walk.js
src/ui/               input, helpers, filter, reading, writing, swinging, themes, hud, intro
src/cloud/            cloud.ts (typed Supabase client, the sync queue, conflicts, account tools), database.types.ts
                      (generated: npm run db:types), gardensPanel, visiting, notes
src/settings/         storage.js (poems, SETTINGS, THEME, localStorage/IDB), customize.js, avatarEditor.js, quality.js
src/player/           also avatar.js (the figure) and figure.js (placing it, the third-person camera)
src/ui/               also swingReader, map, guide (first steps, help, shortcut keys)
src/world/            also fountain.js, architecture.js (the temple carpentry kit), shrines.js (pagoda,
                      bell tower, Shinto shrine inside the garden)
src/debug.js          window.__garden for the test harness, only with ?debug in the URL
dev/screenshot.mjs    headless Chrome (Puppeteer): --check smoke test, or screenshots of fixed views
dev/compare.mjs       mean pixel difference between before-*/after-* screenshot pairs
.env.example          VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (copy to .env, which is git-ignored)
supabase/migrations/  the database, one change per file (baseline = the original schema)
supabase/tests/       pgTAP tests for RLS and validation (npm run db:test)
supabase/schema.sql   generated snapshot of the result (npm run db:snapshot); never edit
supabase/config.toml  local Supabase (ports 55320–55329)
dev/cloud-e2e.mjs     end-to-end against local Supabase (npm run e2e:local)
docs/                 ux-audit.md (Phase 5), database.md (local work, migrations, moving the live database)
tsconfig.json         type-checks src/cloud/*.ts (npm run typecheck)
.github/workflows/    deploy.yml: check + database tests on every push and PR; deploys main to GitHub Pages
```
Built with Vite. Three.js stays at **r128** (pinned `three@0.128.0`) and supabase-js at 2.45.4, both from npm. The single-file app this was split from is the baseline commit on `main`.

### Running locally
- `npm install`, `cp .env.example .env` and fill it in, then `npm run dev` (http://localhost:8080, the Site URL configured in Supabase).
- `npm run check` builds and runs the smoke test: it enters with the sample poems, opens one, switches to autumn and rain, checks the canvas drew, and fails on any page error. It also prints whether accounts are connected.
- Screenshots: `npm run build && npm run shots -- --out dev/shots/after`; for the old single file, `node dev/screenshot.mjs --legacy old.html --out dev/shots/before`. Then `node dev/compare.mjs dev/shots <views…>`. Run-to-run noise (wind, clouds, animals) is a mean difference of about 3–12/255 depending on the view, so compare against a noise run before calling something changed.
- `node dev/screenshot.mjs --check --url http://localhost:8080/` tests a running dev server.
- Database: Docker Desktop, then `npx supabase start`, `npm run db:test`, `npm run e2e:local` (see docs/database.md).
- Deploy: push or merge to `main`. The workflow runs `npm run check` and the database tests, builds with the repository secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and `GARDEN_BASE=/<repo>/`, and publishes to GitHub Pages. Auth redirects use `siteURL()` (Vite's base path).
- If a local Python lacks CA certificates, run HTTPS scripts with `SSL_CERT_FILE=/etc/ssl/cert.pem`.

### Supabase (live)
- A live project exists. Its URL and publishable key are in `.env` locally and in the deploy secrets; its ID and settings are in `CLAUDE.local.md`.
- Check **Authentication → Sign In / Providers** and **URL Configuration** before launch; the current values are in `CLAUDE.local.md`.
- The client uses the new-style **publishable key** (`sb_publishable_...`) from `.env`; it works with supabase-js 2.45.4. Never put the secret / service_role key in the client.
- When the app is hosted somewhere, update Site URL and Redirect URLs in Authentication → URL Configuration.
- **Until the owner runs the steps in docs/database.md, the live database is still on the baseline.** `cloud.ts` detects that at sign-in (`db.legacy`: `deleted_at` or an RPC missing) and falls back to upsert/delete sync, a direct `public_gardens` query and direct username updates; features that need the update say so (`NEEDS_UPDATE`). Keep that fallback until the live database is migrated.

### Stack and data
- **Rendering:** Three.js r128, procedural geometry and canvas-drawn textures only (no image or model assets).
- **Backend:** Supabase. Auth is email + password (see the live project's settings); data lives in Postgres with RLS. The publishable key is public by design.
- **Tables:**
  - `profiles(id, username, display_name)`: created by a trigger on sign-up.
  - `gardens(owner, name, description, theme, is_public, settings jsonb, updated_at)`: one per person, private by default.
  - `poems(owner, id, title, content, mood, theme, important, private, plant_type, position, ...)`: primary key is `(owner, id)`. The id is chosen client-side.
  - `notes(garden_owner, poem_id, author, text ≤280)`: kind notes from visitors.
- **View:** `public_gardens` is what visitors browse (`security_invoker`).
- **Privacy is enforced in RLS, not just the UI:**
  - Private gardens are owner-only.
  - Poems flagged `private` stay hidden even in a public garden.
  - Notes can only be left on poems the author can read, and never on one's own.
- **Guests:** with no account the garden lives in `localStorage` (`garden-of-poems:v1`). The first sign-in on a device imports those poems into the account.
- **Sync (cloud.ts):** `savePoems()` writes localStorage then calls `queueSync()`, which compares each poem with the signature last sent (`sync.sigs`) and queues `save`, `remove` or `restore` operations. The queue is kept per person in localStorage, so it survives reloads and being offline. `syncNow()` sends them through `save_poem(p, base)`, `remove_poem()` and `restore_poem()`, where `base` is the server `updated_at` this device last saw. A `conflict` opens the keep-which dialog (`#conflict`); `deleted` means removed elsewhere, so the poem is dropped here too. Failures retry with exponential backoff. Removing is soft (30 days, then pg_cron purges). Visitors never see removed or private poems; RLS enforces it.
- **Other server functions:** `username_available`, `change_username`, `delete_my_account` (security definer, cascades), `list_public_gardens(q, after…, lim)` for the searchable, paged garden list. Notes have `hidden` (the poet may update only that column) and `note_reports`; a trigger rate-limits notes and the page shows its message.

### Module order
The modules are the old script's sections, and `src/main.js` imports them in the same top-to-bottom order, so they run exactly as before. The numbered list below is that order. Two rules keep it working:
- **Imports only point backwards.** A module imports names from modules that run before it. If it needs something from a later module (usually a function called from an event handler), it uses `late.name` from `core/late.js`; the later module registers a getter with `provide({...})` at its top. A forward `import` would make the later module run first and break load order.
- **Shared variables change through setters.** `poems`, `SETTINGS`, `THEME` (settings/storage.js), `T`, `tween`, `seed`, `introA` (core/state.js), `shadowDirty`, `shadowClock`, `trailClock` are `let`s owned by one module. Other modules read them through live imports and change them with `setPoems`, `replaceSettings`, `setThemeName`, `setTime`, `setTween`, `setShadowDirty` and so on; an imported binding can't be assigned.

### Layout of the code (run order)

1. **Utilities and terrain.**
   - Utilities: `rng(seed)`, `hashStr`, `smooth`.
   - Terrain: `groundH(x,z)` (rolling ground, the pond dip at the origin, the river channel via `riverDist`, hills beyond r≈70).
   - Water and bridges: `WATER_Y`, `RIVER` points, `BRIDGES` with `bridgeH`.
2. **Storage and settings.**
   - Storage: `KEY`, `flag` (small localStorage helpers), `IDB` (IndexedDB for the user's own music files).
   - Settings: `DEFAULT_SETTINGS` / `cleanSettings` / `SETTINGS` / `THEME`, and `POST` (cinematic toggle).
3. **Poem → plant mapping.**
   - `plantTypeFor`: mood → plant type. love → twin flowers; joy → flower; sorrow → weeping cherry; anger → thorn bush; childhood → cherry with treehouse; dream → glowing mushrooms; reflection → cherry, or a big cherry when the poem is long; "this one matters" → the ancient sacred cherry.
   - `REGIONS` and `TYPE_REGION`: angular sectors around the pond (Meadow, Weeping Cherries, Cherry Grove, Moon Garden, Wild Garden, Old Hollow, Old Cherry).
4. **Renderer, scene and procedural textures.** Ground, grass, blossom, maple, wisteria, bark.
5. **Sky shader:** gradient, clouds, sun, moon, stars. Then lights and the shadow map.
6. **`windify(material, amp, mode)`:** injects wind sway into materials. Then shared geometry, `M()` (material cache), `part()`, `limb()`, and `Merge` (merges many parts into one draw call, carrying vertex colours and UVs).
7. **World layout.**
   - Ground with path wear, mountains, stepping-stone paths.
   - The `decor` registry: obstacles that poems avoid and that the player collides with.
   - The `REG` / `regBegin` / `regEnd` registry: scene objects grouped by feature key so Customize can hide them.
8. **Grass and growth.**
   - Grass: instanced tufts in 22 m chunks on render layer 2, so the water reflection skips it.
   - Sakura: `growSakura` builds every tree type, in cherry, maple or green styles and in autumn.
   - Plant builders: `BUILD.*`, `createPlant` / `removePlant`, `assignPosition` (deterministic from the poem id, avoids stones, river, decor and other poems).
9. **Water and garden features.**
   - Water: the pond and stream share one reflective shader. A planar reflection renders into `reflRT` with a clip plane.
   - Lilies and koi.
   - Bench and lantern (writing happens here), gate, stone lanterns, rocks, bridges, hedge.
   - Wisteria arbors: only the bench arbor and the entrance tunnel now.
   - Tulip beds and fields, the **Swing Garden** (`SWING_GARDEN` near the bench), garden lamps, Mount Fuji.
10. **Life and flowers.**
    - Animals: butterflies, sky flock, sparrows, ducks, rabbits (mostly white), sika deer that bow when clicked, peacocks that fan their tails. Each registers via `regAnimal` and gets a `cat` (land, air or water) for Customize.
    - Flower gardens (lilies, orchids, rose garden, hydrangeas), ground cover, riverbed.
11. **Particles and effects.** Mist, fireflies, seasonal drift, rain streaks (`rainU`, a `LineSegments` box that follows the camera on layer 2), falling petals or leaves, links between related poems, seed and burst effects.
12. **Music and input.**
    - `Music`: generative original piano (Web Audio). It can also play the user's own files, which are kept in IndexedDB and never uploaded. `makeRain` builds a looped noise rain sound on its own gain (`rainOut`), so reading doesn't duck it; mute silences it.
    - `SFX`: chirp, quack, thump, peacock.
    - State machine `state.mode`: intro, walk, focus (reading), writing, cinematic, swing. Camera tweens, input (WASD, drag-look, touch joystick), `pick()` raycasting.
13. **Reading and writing.** The reader panel, the pond's "reflections" of older poems, the editor, and the seed flight (`startSeed` / `updateSeed`). Swings: sit, pump with W or Space, stand up. **Reading while swinging** (`ui/swingReader.js`): R or the Read button opens a reader docked left (a bottom sheet on phones, `body.sr-open` lifts the swing pill above it); the swing keeps running, its buttons blur after a click so Space and the arrows stay with the swing, and `state.swingAuto` nudges the swing toward a gentle 0.45 rad sway. Themes: `setTheme`.
    **Your figure and third person** (`player/avatar.js`, `player/figure.js`, `settings/avatarEditor.js`): a faceless figure of simple shapes with joint groups; `animateAvatar(fig, pose, …)` eases joint angles toward a pose (walk/run by speed, idle, sit, write, swing, kneel, pond). `updateFigure(dt)` runs every frame after the mode updates: it places the figure for the current activity and, in third person (`state.thirdPerson`, V), drives an over-the-shoulder camera that pulls in before obstacles (decor circles and plant trunks or canopies, 2D ray tests). In first person the figure is hidden. The bench (`benchSeat()`) and the pond (`reflect()`, `state.pondSpot`) choose third-person framings. The figure config lives in localStorage (`garden-of-poems:avatar`) and `profiles.avatar` (written only if the column exists). A blob shadow stands in for the shadow map, so the figure never forces shadow redraws.
    **Help, panels and feedback (Phase 5):** the HUD is Write, Map, Sound, Customize, Gardens, ? and ⋯; the rarer controls (time, season, light, view, gate) are `.mrow` rows in ⋯ whose label follows their `data-tip`. `ui/guide.js` holds the three first steps (once, `seen-steps`) and the help sheet (? or H). `openPanel`/`closePanel` in `ui/reading.js` give every panel the same focus handling (in, trapped, returned) and close the settings-like ones on Esc or a click on the garden (`CLOSERS`); `body.panel-open` hides the joystick, corner map, hint and cue. `setSaveState()` (cloud.js) drives the quiet saving line. `settings/quality.js` (Auto/High/Medium/Low in ⋯) scales pixel ratio, grass instance counts, shadows, reflection frequency and post-processing; Auto samples frame times while walking and steps down when the median is over 22 ms. Writing keeps a draft in `garden-of-poems:draft`, counts words and lines, may suggest a mood from keywords, and a removed poem can be undone from the toast.
    **The map** (`ui/map.js`): M or the HUD button. `drawWorld()` draws from the real layout (`stones`, `RIVER`, `BRIDGES`, `TULIPS`, `swings`, `ROSE_GARDEN`, `sign`) and honours `featOn`; places and poems are HTML buttons over the canvas. Choosing one calls `glideTo()`: two camera tweens (lift and drift, then settle) to a free standing spot, then `openPoem` for poems. While open, `state.mode` is `'map'` (walking pauses). The corner map (`#minimap-btn`) redraws at about 9 fps from a cached world image; Customize can switch it off (`state.minimap`).
14. **Accounts:** `Cloud` (Supabase) handles auth, sync, the Gardens panel, visiting other gardens, and notes. `cloudInit()` skips Supabase entirely if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing or still contain `YOUR_`.
15. **Customize:** settings UI, applying settings, autumn veils, the **great arch** at the gate (`GATE`, blossom cards that follow the season, the garden's name on a plaque that `drawBoard()` paints) and the **sign board** beside it with name, byline, welcome line and links. You arrive at `SPAWN` (0, 49), a few steps outside the arch, so the arch, its name and the board are the first view.
16. **HUD wiring and startup.** Samples (12 original demo poems), init, intro screen, the frame loop and post-processing (`renderPost`: bloom, film grade, vignette, grain), then `cloudInit()`.

## Decisions and why

- **Battery (October 2026):** `core/power.js` decides each frame whether to draw: 60 fps while anything moves, 20 fps after 2.5 s of stillness (24 while reading), 8 fps unfocused, none while the map is open, at most 30 with reduced motion. (A 30 fps battery cap and a battery step-down to Medium were tried and removed: the owner saw the garden look worse.) Animations that must stay smooth set `power.growing` or register a busy tick (`core/things.js`). The water reflection uses an oblique near plane instead of clipping planes (half the shader programs). Measured with `--flow battery` (headless CPU %): standing 45 → 19, reading 24 → 12, map 24 → 2.
- **The poem card (October 2026):** the reader is an Instagram-style card: the poet and region on top, the poem on a paper page in a book (a cloth cover swings open; ← → turn pages over the spine; reduced motion skips both), then a heart, notes and the date. Hearts and notes appear only when the garden is public (visiting, or your own once open). Double tap or J hearts, K opens notes. `poem_likes` holds hearts; everyone sees counts through `poem_likes_for()`, only the poet sees who.
- **Suggested gardens:** `suggested_gardens()` scores public gardens by recent hearts and notes, freshness, size and shared moods; the Gardens panel shows three, and once a session a quiet toast offers the best one. Before the database update the page scores the public list itself.
- **Daylight (round 8 of the vision log):** a clear, bright morning. The sun carries the light (1.45, warm) and the sky only fills (0.5); haze starts at 55 m; a deeper blue sky; more colour by day and a lighter vignette. Before, sky light and sun were nearly equal and fog began at 30 m, which read as overcast and grey. Compare versions by building old commits in worktrees and shooting the same views (that is how this was found: the look had never been right, it was not a regression).
- **Who you are:** `cfg.kind` is girl, boy, cat or bird (`player/avatar.js`, `player/creatures.js`). Creatures share the figure contract (root facing -z, joints, eased poses) and `figureMetrics()` gives each kind its eye height, camera point and distance. The bird takes off on one press of Space and keeps flying by itself (`player.flying`, `player.cruise`); hold Space to climb, Q to sink, press again to land; nothing collides above 3.2 m; the cat pounces. A touch button (`#act-btn`) holds Space on phones.
- **Koi:** `water/koiModel.js` paints real varieties on a tapered body that bends in the vertex shader; the pond and the fountain use it. Tapping the fountain is "look into the fountain" (`ui/fountainView.js`, `state.mode = 'fountain'`): the camera leans in, the water stills and clears, the koi gather, and a coin can be tossed.
- **The top bar (round 10):** three groups: write and map; the sky (season, light, weather: each icon shows the current state, the tooltip says what a press does, `ui/icons.js`); music, customize, gardens, help, ⋯. Weather cycles clear → showers → rain; the ⋯ menu holds the rarer things, each with a line saying what it does.
- **Paper pages (round 11):** every box (all `.panel`s, the menu, the first steps, messages, the swing and fountain pills) uses the poem card's parchment, in every light; the type is a weight heavier throughout (Cormorant 500/600/700 loaded).
- **Three customize buttons:** You (A: `#youpanel`, the character), Your garden (C: `#custom`, sign, scenery, flowers, music) and the horizon (O) beside season, light and weather. Rows in both boxes share one label column.
- **Link boards (`world/linkBoards.js`):** each sign link gets a board right of the arrival path: "Find me on Instagram" in the platform's colour, a QR code (`qrcode-generator`), the handle; click or E opens it. Rebuilt with `drawBoard()`.
- **Edge borders (`plants/edgeBeds.js`):** five rows of mophead hydrangeas in six colours inside the hedge (leaf and floret cards, no balls); the outer lawn is green, not olive. Grass chunks have patch-sized bounds (they blinked out when their centre left the view).
- **Google and GitHub sign-in** use `signInWithOAuth` with `siteURL()`. They need the providers switched on in Supabase (and OAuth apps at Google and GitHub); until then the buttons say so kindly.
- **Sakura crowns are blossom cards only:** no solid filler meshes (they read as circles); a crown is about 46 cards per tip plus cards along the inner branches.
- **The writing bench** is a white cast-iron bench (canvas scrollwork with alphaTest) under a white arch with a "Sit here" plaque, in a mulch bed with leafy hydrangeas; the wisteria arbor that stood over it is gone.
- **The beach:** with the sea horizon, `shore.on` (terrain.js) lets you walk past the old edge onto the sand and wade in to about a metre (`beachH`, `seaDepth`, `SHORE_MAX_R`); wading is slower, rings spread at your feet, the surf grows louder (`world/beach.js`). Sandcastles, parasols with towels and chairs, shells, starfish, driftwood, dune grass, a jetty, a rowing boat and a buoy are shown only with the sea.
- **Things to touch:** the fountain (toss a coin; coins stay on this device), the shrine bell, the temple bell, koi that come to where you touch the pond, petals shaken from a tree you brush past. Each registers through `regThing()`; the walk cue offers it within its `near` circle.

- **Copyright:** music must stay original or user-supplied. The owner asked for a famous album's piano music; that was declined. Instead the app has an original generative piano plus "play my own files". Don't embed copyrighted songs, lyrics or recognisable melodies.
- **Every poem is a cherry tree (October 2026).** The owner asked that poems never grow as flowers or bushes. `plantTypeFor` now gives `oldtree` (matters), `willow` (a weeping cherry, for sorrow), or `orchard` / `bigtree` by length; the mood picks the region (`regionKeyFor`). Older poems with other plant types are re-placed once (`preparePoem`). The old builders (flower, twin, thorn, mushrooms, treehouse) remain only for reference.
- **Seasons (October 2026, round 9):** `SETTINGS.season` is `auto` (Feb–May spring, Jun–Sep monsoon, Oct–Jan autumn), `spring`, `monsoon` or `autumn`. Winter and summer were removed at the owner's request; `cleanSettings` maps old saved values (summer → monsoon, winter → autumn), and migration `20261018000000` does the same in the database. The monsoon is green trees and passing showers even when the weather is set to clear. Some `THEME === 'winter'` branches remain as dead code.
- **Light:** `SETTINGS.light` is `auto`, `day`, `sunset` or `night` (`state.dusk` beside `state.night`). Sunset: a violet-rose-orange sky gradient, the sun low beside Fuji, warm low light, pink clouds, alpenglow on Fuji and the Alps, a golden grade. The HUD light button cycles day → sunset → night.
- **Quality over battery (round 9):** `core/power.js` no longer rests frames (only the map pauses drawing); High is pixel ratio 2, 4096 shadows, a sharper reflection; Auto steps down only under ~25 fps. Don't reintroduce savings without asking.
- **Mountains:** the original hazed ranges. An alpine range was tried in round 9 and removed at the owner's request: don't bring it back.
- **Swings:** white pergola bench swings on the lawn (`world/swings.js`), coral slatted bench on chains, baskets, planters, string lights (`nightGlow`). The sitter faces +z; the backrest is at -z. "Keep swinging" (button or K) holds the current height.
- **The horizon:** `SETTINGS.view` is `fuji` or `sea`. Fuji was retuned toward the classic photo (clear air, broad snow cap). `world/temples.js` adds a vermilion five-storey pagoda, a hall, a torii and a smaller pagoda on the hills beyond the hedge, drawn without fog. `world/horizon.js` swaps the ground's outer ring between hills and a beach shape (no rebuild), lays a sand ring, hides the hedge, and shows a sea with its own distant haze plus a few far islands.
- **The figure is an original chibi style.** The owner pointed to a paid "cute stylized girl" model on Cults3D, but its licence (personal use, No AI, for 3D printing) rules out using or copying it. So `player/avatar.js` builds an original figure in the general style instead: a large head with a painted canvas face (big eyes, highlights, blush), bangs, buns, twintails and other hairstyles, a dress among the outfits, short limbs. `HEAD_Y` and `HIP_SIT` from avatar.js drive the camera and seating in figure.js.
- **Every tree is a poem.** The owner found decorative trees confusing to click, so non-poem trees were removed. Keep it that way, and make sure only interactive things look clickable (they glow on hover).
- **Autumn:** a friend pointed out that wisteria doesn't bloom in autumn. In the autumn theme, every wisteria veil (including the pink swing veils) swaps to hanging red and yellow leaf strands. Seasonal accuracy matters to the owner.
- **Swings:** they all live together in one Swing Garden with pink flower veils. It was originally far out west; it now sits beside the writing bench (`SWING_GARDEN = {x:-19, z:21}`), six swings in two rows facing the pond.
- **Wisteria arbors:** the extra standalone arbors were removed as "confusing poles". Only the bench arbor and the entrance wisteria tunnel remain.
- **"After Effects / Mira AI realism":** those tools can't run in a live web page. The answer was real-time post-processing (bloom, grading, vignette, grain), which users can switch off.
- **Moving off claude.ai:** a claude.ai artifact can't reach outside servers, which is why the app moved to Supabase plus static hosting.
- **Weather:** `SETTINGS.weather` is `clear`, `showers` or `rain`, saved with the garden so visitors see it. `state.rain` (0–1) eases toward `rainWanted()`; `atmosphere()` uses it to grey the sky and fog (`skyU.uRain`, `RAIN_D`/`RAIN_N`), dim the sun, ripple the water (`waterU.uRain`), and fade pollen and fireflies. Passing showers rain for about 2½ minutes in every 7, starting when chosen. The ⋯ menu has a quick "Let it rain" toggle.
- **Positions are deterministic:** they come from a hash of the poem id and are stored with the poem. A poem always lives in the same place; the garden is a landscape, not a random scatter.
- **Vite and plain ES modules, not Next.js:** the original brief asked for Next.js + TypeScript + React Three Fiber + Zustand. The app was built as one static `index.html`, then split mechanically into ES modules with Vite (October 2026), keeping its run order and behaviour exactly; screenshots before and after matched within run-to-run noise.

## Traps already found (read before editing)

1. **InstancedMesh + shared material + instanceColor:** if one InstancedMesh using a material calls `setColorAt` and another using the same material doesn't, three r128 compiles the program expecting `instanceColor`. The second mesh then crashes the renderer (`Cannot read properties of null (reading 'isInterleavedBufferAttribute')`). Always call `setColorAt` on every instanced mesh that shares a material such as `VC`.
2. **Load order (was TDZ ordering):** anything run at load (IIFEs, init calls) may only use names from modules that already ran. In the single file, `function` declarations were hoisted, so a load-time call to a function defined further down worked; across modules it doesn't. `late.fn` is `undefined` until the later module runs, which shows up as `U.fn is not a function` in the built bundle. Fix by moving the helper into an earlier module (this happened with `pointsMat`, now in renderer.js, and the autumn leaf palettes, now loaded before sakura.js).
3. **`windify` program cache:** `customProgramCacheKey` must vary with amplitude and mode, or every material shares one shader.
4. **Shadows are manual:** `renderer.shadowMap.autoUpdate = false`. Set `shadowDirty = true` after anything moves or appears.
5. **Water reflection:** a second render from a mirrored camera, clipped at the water plane. Grass and tulips sit on layer 2 so the reflection skips them, for performance. Anything heavy that doesn't need reflecting should go on layer 2 too.
6. **Performance is the main risk.** There is a lot here: about 23k grass tufts, thousands of instanced flowers, the reflection pass, shadows and post-processing. Real devices haven't been profiled yet. A quality setting (low, medium, high) is the obvious next step.
7. **Testing:** `npm run flow:swing`, `--flow avatar` (third person: editor, walk, bench, kneel, pond, swing) `--flow map` (open, hover, two clicks to a poem, glide to a place, hidden features, phone), `--flow ux` (first steps, help, Esc and focus, drafts, undo), `--flow audit` (every screen, axe-core, HUD reach, frame times) and `--flow quality` (per-frame triangles, draw calls and pixels at each level). The UX audit is `docs/ux-audit.md` (`--flow swing`) is the Phase 3 acceptance walk on desktop and a phone-sized touch screen (fresh browser context, so the sample garden button exists).
    `dev/screenshot.mjs` seeds `Math.random`, forces daylight, and sets the camera directly through `window.__garden`. On macOS headless Chrome uses the GPU (`--use-angle=metal`) and page screenshots work. On Linux CI there is no GPU, so WebGL is software and runs at a few fps; the smoke test asks for reduced motion so the entry tween is short.
8. **Live Supabase verified at the API level (2026-10-07):** sign-up and the profile and garden triggers, poem upsert and read, private-garden isolation, the public garden listing with its poem count, private poems hidden from visitors, and every note rule all passed against the live project. Sign-up through the page UI and the password-reset email flow have not been checked yet. PostgREST rejects a bulk upsert whose rows have different keys (`PGRST102`); the app's `toRow` always emits every column, so keep it that way.
9. **Supabase keys are baked in at build time.** Vite inlines `VITE_*` values when it builds, so changing `.env` needs a rebuild (or a restart of `npm run dev`). If the Gardens panel says accounts aren't connected, check `.env` and rebuild before debugging code.

10. **Docker Desktop on this kind of Mac:** image pulls failed until `/Applications/Docker.app/Contents/Resources/bin` was on PATH (`docker-credential-desktop`). A stuck `supabase start` once left a stale port binding and hung Docker until it was force-restarted; local Supabase now uses ports 553xx. Never run two `supabase start` at once.
11. **Types are generated:** after any migration, `npm run db:types` and `npm run typecheck`. `cloud.ts` types `late` and `state` explicitly because they come from JavaScript modules.
12. **`NOT VALID` constraints:** some validation checks only new writes on the live database until the owner validates them (docs/database.md, step 7). Local and CI databases start empty, so there they are fully enforced.
13. **`npm run e2e:local` builds `dist/` with the local Supabase keys.** Run `npm run build` (or `npm run check`) afterwards before using `dist/` for anything else. CI always builds its own.
14. **Sync signatures:** `sig()` covers the poem's content fields only, never the server's timestamps; including `updatedAt` would make every save look like a new change.
15. **Declare before an IIFE uses it, even inside one module:** `hedges` in decor.js had to move above the hedge-building IIFE (TDZ). Seasons and the horizon are applied through `applyVisibility()`, which runs `applyHorizon()` after the feature loop.
16. **`plants` is a Map:** iterate it with `.forEach` or `.values()`; `for (const pl of plants)` yields `[id, plant]` pairs (a walk-time crash this round).
17. **Frames are skipped on purpose (core/power.js):** reading the WebGL canvas back only works in a frame the garden drew; wait for `__garden.framesDrawn` to change (the smoke test does).
18. **Map labels:** `#map-marks button` sets a transform, so the `.side-*` rules must be scoped under `#map-marks` or every label centres on its point. `settleLabels()` places them; a label never clashes with its own dot.
19. **Things that block flower beds must load first:** `flowerGardens.js` places hydrangeas around `decor`, so modules adding obstacles (fountain, shrines) are imported before it.
22. **Two `.pop` classes:** `.pop` is the HUD's popover menus (fixed, top right). An animation class named `pop` on the heart carried the button under the page. Use another name (`beat`).
23. **r128's BufferGeometryUtils is an object:** `BufferGeometryUtils.mergeVertices(g)`, not a named import. Unwelded icosahedra shade faceted (one normal per face); weld them for smooth stone.
24. **Grass is planted first:** anything laid on the ground later (the fountain pool, the swing court, the shrine's gravel) must call `clearArea()` / `clearRect()` from grass.js, or tufts and wildflowers grow through it. Clover checks `decor` (collide > 1) itself.
26. **Never put a `//` comment in the middle of a line you build with string replacement:** it swallows everything after it on that line (a declaration, a closing brace). This bit three times; put comments on their own line.
25. **Cormorant reads small:** its x-height is low, so the root font size is 112.5%. Check panels at full size, not in a contact sheet, before judging type.
21. **Auto quality must only time full-rate frames:** `noteFrame()` measured the gap between drawn frames, so the deliberate 20 fps rest while standing still looked slow and Auto stepped the garden down to Low (no shadows, no colour grade, a third of the grass). It now skips frames unless `power.target` is 60. `--flow autoq` checks it.
20. **The carpentry kit turns yaw first:** `Kit` uses Euler order `YXZ`, so a rafter yawed to its side still pitches along its length.

## The owner's vision, round by round (keep adding to this)

What the owner has asked for, in their own words where possible, so a later session knows not only what was built but what they were reaching for. Add each new round at the bottom; when a later request reverses an earlier one, note it rather than deleting the earlier line.

**Standing wishes (true in every round)**
- Every tree is a poem, and every poem grows as a **big cherry blossom tree that changes with the seasons**. No plants or flowers as poems, no decorative trees that look clickable.
- **Quality comes first.** "Everything should be very very realistic and interactable." When battery work made the garden look worse, the answer was "bring back the original quality": savings must never be visible.
- **Nothing confusing or cluttered:** no unnecessary poles ("there's too many of these poles unnecessarily"), no overlapping words on the map ("it's too cluttered"), no confusing wisteria poles.
- **Readable from where you stand:** the gate's sign and its subtext should be big enough to read on arrival ("all of the subtext below the main name of the garden should be really bigger").
- **The first view matters:** at the start you should see the arch, the garden's name and the sign, with no empty-looking side ("the right part side space is visible too much").
- Seasonal accuracy (no wisteria in autumn; snow in winter; summer in full leaf).
- Test locally before anything goes live; screenshots before and after; ask before pushing, making things public, enabling Pages or changing the live database.

**Rounds**
1. Run it; set up Supabase step by step; make sign-up work.
2. "Swings are very far… bring them closer, remove the unnecessary wisteria poles", keeping the vision in this file.
3. "A feature for adding rain."
4. Six phases from the brief: Vite modules, accounts and sync, privacy and moderation, deploy to GitHub Pages, a UX audit, a database on migrations.
5. "Trees get planted like plants or flowers, they should only be big cherry blossom trees, changing as per season." An avatar "like a cute stylized girl character" (built as an original chibi; the reference model's licence ruled out copying it). "Add a beach view of the entire park if the user doesn't want Mount Fuji"; "fix the view of Mount Fuji like shown in the image and add Japanese pagodas and temples at the view."
6. Shorter grass ("when you walk it gets in the way"); battery life ("the battery is draining a lot", measure it properly); shortcut keys; "make the garden more interactive"; more pagodas and shrines "with accurate detail 3D"; a map without intersecting words; a bigger, fluffier, more beautiful arch with the garden's name, and a bigger sign with bigger lettering visible at spawn; public gardens "automatically best suggested for you"; a water fountain between the Wild Garden and the pond; the poem box "like an Instagram post", with "a book flip animation" and likes and comments when the garden is public.
7. After seeing round 6 live: there was "no like button on the post" (it needs the live database migration, and appears only in public gardens); "give it a feel of book flip of pages while changing the poems" (pages now turn whenever the poem changes); "I liked the previous morning/daylight version" and "since you did that performance testing the park doesn't render good" (Auto quality had been stepping down to Low; fixed); fewer poles; balance the right side at the start; the character (the parasol hid her head from behind; now a wagasa over the left shoulder); much bigger subtext on the sign; "help me test this in local first before merge".
8. With pictures: a **boy** avatar like their reference (messy black hair, black zip jacket, cargo shorts, white sneakers, red scarf); "an avatar if somebody wants to be a **cat** or a **bird**", and "the actions must reflect each avatar's physics in real life, like a bird can fly in the garden, and the view of cat roaming"; "a pink bow in the place of scarf". "In autumn the trees should be yellow and red" (a maple photo: red-orange crown lit with gold). Swings "a little broader", a longer seat, "more gaps between swings", and "a board above it like the board at the entrance and call it Swings". "The rendering looks so poor in daylight, this was not my vision, make really good UI/UX, think about UI/UX very thoroughly and carefully, fix everything you see unfinished from both designer and user perspective." Torii gates near the pagodas and shrines. "Make the fountain bigger and add realistic koi fishes in it so that when you tap the fountain water, you can see koi fishes crystal clear."
9. With a picture of a white pergola swing: grass under the swings, not bare land; "the swing looks basic", make it "fancy … with white wooden structure with sturdiness and sufficient thickness", "a little higher from the ground", and "an option of keep swinging at that pace". "Keep the bird in the air so there's no need to keep pressing the space bar." Daylight felt monotonous: two modes, **daylight and sunset ("orange and pink, keep gradient in the sky")**. Seasons are **spring, monsoon and autumn**: "remove the winter season". "Bigger multiple peacocks." "Remove the battery barrier and be free to render real good images … every element on the screen with perfection and realism." "The mountains in the back should be highlighted more, like the Alps." **This reverses round 6's battery request: quality now wins over battery.**
10. "Some trees get broken"; sakura "more pink and full of leaves, those circles in the trees look bad"; "the alps don't look good with Mount Fuji, keep the original mountains" (**reverses round 9's Alps**); "Let it rain" out of the ⋯ menu and the garden's options "at the top right with their icons"; the bench "white, designed, a bigger area for writing … a bigger white bench, and at the top write Sit here" (a white cast-iron bench photo); the beach "more beachy, be able to get in the water and feel the water, sand castles"; "you are a senior software engineer as well as a UI/UX designer: it should be easy and logical to find things on screen … be very mindful of words"; the writing box and the menu "artsy like the posts of these poems"
11. "Around the circular boundaries of the garden where there's barren land, add different colours of hydrangeas"; "change all the boxes and modals to the theme of the box on the right" (the parchment menu); the customize and character boxes "aligned properly", and "all the fonts must be bolder"; a top-bar button each for the horizon, for the character, and for the garden; "sign in with Google (Gmail), GitHub"; at the gate, on the right, "a board for each link with its QR code … the board must say what link it is for"

## What the owner wants next (open threads)

They said they want to "edit a lot of things in the garden". Expect many visual and layout tweaks; ask them to describe or screenshot what feels wrong. Open items after the October 2026 round (phases 1–6):

- **Custom SMTP** for confirmation and reset emails before inviting real people (Supabase's built-in mail sends only a few an hour).
- **Three.js upgrade:** r128 → current, as its own step: colour management (`outputColorSpace`, hex colours treated as sRGB), physically based light units, `WebGLMultisampleRenderTarget` → `samples`, and the shader chunks that `windify` and the water shader patch. Compare with `npm run shots` and `dev/compare.mjs`.
- **Migrate the live database** (docs/database.md): five migrations past the baseline, including `20261016000000` (hearts and suggestions). Until then the card leaves the heart out; the owner noticed. Ask before touching the live database.
- **The character:** their last note said only "the character"; the parasol was fixed from their screenshot, but ask what else they want of her.
- **Draw calls:** about 1,170 a frame at High (`--flow quality`), down from 1,400 after merging the temples. Merging more of the static scenery would help weaker devices more than any setting.
- **Realtime presence** (the Phase 4 stretch goal, not built): other signed-in visitors as figures, movement only.
- **Proposals in docs/ux-audit.md**, waiting for the owner's OK.
- **Realism:** better trees, grass, water and sky; glTF models and PBR textures if procedural shapes stop being enough.

## Working style that has worked well

- Build the thing, then show it. Take screenshots and check them before claiming a visual change works.
- Be honest about limits (realism, CORS/CSP, permissions) and give the realistic alternative in the same breath.
- Keep the poetic, quiet feel in all user-facing text: short, kind, never corporate. Labels are plain verbs ("Plant this poem", "Return to my garden").
- Never put secrets other than the public Supabase publishable key in the client.
