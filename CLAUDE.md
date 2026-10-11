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
index.html                  the whole app: HTML, CSS and one large <script> (≈3,750 lines)
config.js                   Supabase URL + publishable key (filled in, live project)
README.md                   setup and hosting guide for humans
supabase/schema.sql         full database schema with row-level security
supabase/upgrade-1-customize.sql   adds gardens.settings to older databases
```
There is no build step. Three.js r128 and supabase-js 2.45.4 load as UMD scripts from CDNs (cdnjs, jsdelivr). Everything else is inline. Open via a local static server, not `file://`, or Supabase auth redirects break.

The `dev/` test helpers from the claude.ai conversation (`dev/mock-supabase.js`, `dev/screenshot.py`) were not carried over into this folder. Recreate them if headless screenshot tests are needed (see trap 7).

### Running locally
- Serve on **http://localhost:8080**; that is the Site URL and Redirect URL configured in Supabase.
- Use a server that sends `Cache-Control: no-store` (or hard-reload with Cmd+Shift+R). Python's plain `http.server` lets Chrome cache `config.js`, and a stale copy makes the app say "Accounts are not connected yet" even though keys are set. A minimal no-cache server is a `SimpleHTTPRequestHandler` subclass whose `end_headers` adds that header.
- If a local Python lacks CA certificates, run HTTPS scripts with `SSL_CERT_FILE=/etc/ssl/cert.pem`.

### Supabase (live)
- A live project exists. Its URL and publishable key are in `.env` locally and in the deploy secrets; its ID and settings are in `CLAUDE.local.md`.
- Check **Authentication → Sign In / Providers** and **URL Configuration** before launch; the current values are in `CLAUDE.local.md`.
- The client uses the new-style **publishable key** (`sb_publishable_...`) in `config.js`; it works with supabase-js 2.45.4. Never put the secret / service_role key in the client.
- When the app is hosted somewhere, update Site URL and Redirect URLs in Authentication → URL Configuration.

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
- **Sync:** `savePoems()` writes localStorage then calls `queueSync()`. That diffs against `Cloud.last` and upserts or deletes only the changed rows.

### Layout of the main script (top to bottom)
Order matters because of `const` temporal-dead-zone rules (see traps).

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
13. **Reading and writing.** The reader panel, the pond's "reflections" of older poems, the editor, and the seed flight (`startSeed` / `updateSeed`). Swings: sit, pump with W or Space, stand up. Themes: `setTheme`.
14. **Accounts:** `Cloud` (Supabase) handles auth, sync, the Gardens panel, visiting other gardens, and notes. `cloudInit()` skips Supabase entirely if the config is missing or still contains `YOUR_`.
15. **Customize:** settings UI, applying settings, autumn veils, and the **sign board** at the gate with name, byline, welcome line and links.
16. **HUD wiring and startup.** Samples (12 original demo poems), init, intro screen, the frame loop and post-processing (`renderPost`: bloom, film grade, vignette, grain), then `cloudInit()`.

## Decisions and why

- **Copyright:** music must stay original or user-supplied. The owner asked for a famous album's piano music; that was declined. Instead the app has an original generative piano plus "play my own files". Don't embed copyrighted songs, lyrics or recognisable melodies.
- **Every tree is a poem.** The owner found decorative trees confusing to click, so non-poem trees were removed. Keep it that way, and make sure only interactive things look clickable (they glow on hover).
- **Autumn:** a friend pointed out that wisteria doesn't bloom in autumn. In the autumn theme, every wisteria veil (including the pink swing veils) swaps to hanging red and yellow leaf strands. Seasonal accuracy matters to the owner.
- **Swings:** they all live together in one Swing Garden with pink flower veils. It was originally far out west; it now sits beside the writing bench (`SWING_GARDEN = {x:-19, z:21}`), six swings in two rows facing the pond.
- **Wisteria arbors:** the extra standalone arbors were removed as "confusing poles". Only the bench arbor and the entrance wisteria tunnel remain.
- **"After Effects / Mira AI realism":** those tools can't run in a live web page. The answer was real-time post-processing (bloom, grading, vignette, grain), which users can switch off.
- **Moving off claude.ai:** a claude.ai artifact can't reach outside servers, which is why the app moved to Supabase plus static hosting.
- **Weather:** `SETTINGS.weather` is `clear`, `showers` or `rain`, saved with the garden so visitors see it. `state.rain` (0–1) eases toward `rainWanted()`; `atmosphere()` uses it to grey the sky and fog (`skyU.uRain`, `RAIN_D`/`RAIN_N`), dim the sun, ripple the water (`waterU.uRain`), and fade pollen and fireflies. Passing showers rain for about 2½ minutes in every 7, starting when chosen. The ⋯ menu has a quick "Let it rain" toggle.
- **Positions are deterministic:** they come from a hash of the poem id and are stored with the poem. A poem always lives in the same place; the garden is a landscape, not a random scatter.
- **Single file for now:** the original brief asked for Next.js + TypeScript + React Three Fiber + Zustand. The app was built as one static `index.html` instead; migrating is planned only once the design settles (see open threads).

## Traps already found (read before editing)

1. **InstancedMesh + shared material + instanceColor:** if one InstancedMesh using a material calls `setColorAt` and another using the same material doesn't, three r128 compiles the program expecting `instanceColor`. The second mesh then crashes the renderer (`Cannot read properties of null (reading 'isInterleavedBufferAttribute')`). Always call `setColorAt` on every instanced mesh that shares a material such as `VC`.
2. **TDZ ordering:** the script is one scope with many `const`s. Anything run at load (IIFEs, init calls) must only touch names declared above it. A previous bug: `POST` was used by menu wiring before its declaration. `function` declarations are hoisted; `const` arrow functions are not.
3. **`windify` program cache:** `customProgramCacheKey` must vary with amplitude and mode, or every material shares one shader.
4. **Shadows are manual:** `renderer.shadowMap.autoUpdate = false`. Set `shadowDirty = true` after anything moves or appears.
5. **Water reflection:** a second render from a mirrored camera, clipped at the water plane. Grass and tulips sit on layer 2 so the reflection skips them, for performance. Anything heavy that doesn't need reflecting should go on layer 2 too.
6. **Performance is the main risk.** There is a lot here: about 23k grass tufts, thousands of instanced flowers, the reflection pass, shadows and post-processing. Real devices haven't been profiled yet. A quality setting (low, medium, high) is the obvious next step.
7. **Testing:** headless Chromium uses software WebGL at about 1–2 fps. A screenshot harness has to raise the frame-time cap in a temporary copy so tweens finish. Grab frames with `canvas.toDataURL` inside `requestAnimationFrame`; Playwright's page screenshot can time out while the GPU is busy.
8. **Live Supabase verified at the API level (2026-10-07):** sign-up and the profile and garden triggers, poem upsert and read, private-garden isolation, the public garden listing with its poem count, private poems hidden from visitors, and every note rule all passed against the live project. Sign-up through the page UI and the password-reset email flow have not been checked yet. PostgREST rejects a bulk upsert whose rows have different keys (`PGRST102`); the app's `toRow` always emits every column, so keep it that way.
9. **Stale `config.js`:** see "Running locally". If the Gardens panel says accounts aren't connected, check the served file and hard-reload before debugging code.

## What the owner wants next (open threads)

They said they want to "edit a lot of things in the garden". Expect many visual and layout tweaks; ask them to describe or screenshot what feels wrong. Likely directions:

- **Realism:** better trees, grass, water and sky. Consider glTF models and PBR textures, or a move to a modern Three.js (r160+), whose physically based lighting and tone mapping are much better than r128's.
- **Code structure:** split the single file into ES modules with Vite, for example `world/`, `plants/`, `animals/`, `ui/`, `cloud/`, `settings/`. The original brief named Next.js + TypeScript + React Three Fiber + Zustand; a move there is reasonable once the design settles.
- **Performance:** quality presets, chunked culling, fewer reflection objects, and a mobile path.
- **Community:** moderation for notes (report or hide), rate limits (a Supabase edge function or a check constraint per author per day), and a nicer public garden directory.
- **Customization:** more options, such as poem tree species per mood, more flower types, path layouts, placing features by hand, and snow (rain is done).
- **Hosting:** not deployed yet. Any static host works (`npx vercel`, Netlify Drop, GitHub Pages); remember the Supabase URL settings afterwards.

## Working style that has worked well

- Build the thing, then show it. Take screenshots and check them before claiming a visual change works.
- Be honest about limits (realism, CORS/CSP, permissions) and give the realistic alternative in the same breath.
- Keep the poetic, quiet feel in all user-facing text: short, kind, never corporate. Labels are plain verbs ("Plant this poem", "Return to my garden").
- Never put secrets other than the public Supabase publishable key in the client.
