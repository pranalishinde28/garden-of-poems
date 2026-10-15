# The Garden of Poems

A walkable 3D garden where every poem grows into a cherry tree. Each person signs in to their own garden, keeps it private or opens it to visitors, and can wander other people's public gardens, leave hearts and kind notes, and find gardens suggested for them.

The app is a static site built with Vite and Three.js, with a Supabase database for accounts and storage. Without Supabase keys it still runs, saving one garden on the device.

## 1. Create the database (about 10 minutes)

1. Create a free project at supabase.com.
2. From this folder, apply the migrations (each command opens a browser or asks for your database password):
   ```sh
   npx supabase login
   npx supabase link --project-ref <your project ref>
   npx supabase db push
   ```
   They create the tables, the row-level security rules, the validation, and the daily clean-up of removed poems (pg_cron; enable it under Database → Extensions if the push asks for it).
3. In **Authentication → URL Configuration**, set **Site URL** to the address where you will host the app and add `<that address>/**` under **Redirect URLs**. Confirmation and password-reset emails link back here.
4. Optional: in **Authentication → Providers → Email**, turn off "Confirm email" if you want people to start writing straight after signing up. Supabase's built-in email sends only a few messages an hour; for real use, set up custom SMTP.

Already running the earlier single-file version with `schema.sql` pasted by hand? Follow **docs/database.md → Moving your live database onto migrations** instead of step 2. Local development, tests and schema changes are in the same file.

## 2. Connect the app

You need Node.js 20 or newer.

```sh
npm install
cp .env.example .env
```

Open **Project Settings → API** in Supabase and put the **Project URL** and the **publishable** (or **anon public**) key into `.env`:

```sh
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

That key is meant to be public; the row-level security rules in the schema decide who can read or change what. Never put the secret (service_role) key in `.env`. Without these values the app still runs, keeping one garden on the device.

## 3. Run, test and build

| Command | What it does |
|---|---|
| `npm run dev` | the garden at http://localhost:8080, reloading as you edit |
| `npm run build` | a static site in `dist/` |
| `npm run preview` | serves `dist/` at http://localhost:8080 |
| `npm run check` | builds, then walks the garden in headless Chrome and fails on any page error |
| `npm run shots` | screenshots of fixed viewpoints into `dev/shots/` (after `npm run build`) |
| `npm run typecheck` | type-checks the TypeScript cloud module against the database types |
| `npm run db:test` | row-level security and validation tests against local Supabase (see docs/database.md) |
| `npm run e2e:local` | the whole app against local Supabase: accounts, sync, conflicts, notes |

Compare two sets of screenshots with `node dev/compare.mjs dev/shots intro pond`, which expects `before-*.png` and `after-*.png` pairs.

## 4. Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` runs on every push to `main`. It installs, runs `npm run check`, builds with your Supabase values, and publishes `dist/` to `https://<user>.github.io/<repo>/`. Pull requests run the check too, without deploying.

One-time setup:

1. **Secrets.** In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL`: your Project URL
   - `VITE_SUPABASE_ANON_KEY`: your publishable (anon) key

   Or from a terminal: `gh secret set VITE_SUPABASE_URL` and `gh secret set VITE_SUPABASE_ANON_KEY`, pasting each value when asked. These keys end up in the public site anyway; keeping them as secrets just keeps them out of the code.
2. **Pages.** **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Supabase.** In **Authentication → URL Configuration**:
   - **Site URL:** `https://<user>.github.io/<repo>/`
   - **Redirect URLs:** add `https://<user>.github.io/<repo>/**`, and keep `http://localhost:8080/**` for local work.

   Confirmation and password-reset emails link back to the site's base address, so it must be on that list.
4. Push to `main`, or run the workflow by hand from the **Actions** tab. The address appears on the workflow run and under **Settings → Pages**.

The base path comes from the repository name (`GARDEN_BASE` in the workflow). Elsewhere, build with `GARDEN_BASE=/that-path/ npm run build`, or leave it unset for a site at the root of its domain, and publish `dist/`.

## Customizing a garden

The sliders button at the top opens **Customize**. Everything there is saved with the garden (on the device for guests, in the account once signed in), and visitors see the same choices:

- **The sign at the gate:** garden name, a welcome line, and up to six links (socials, portfolio). Visitors click the sign to open them. Only `https://` and `http://` links are accepted.
- **Scenery:** season (follow the calendar, or spring, summer, autumn, winter), the horizon (Mount Fuji or the sea), light (follow the clock, always day, always night), weather (clear, passing showers, or rain), Mount Fuji, mist, and drifting pollen, leaves or snow.
- **Poem trees:** cherry blossom (pink or white), red maple, or green leaves.
- **What grows and lives here:** wisteria, tulips, roses, hydrangeas, lilies, orchids, lamps, the swing garden, and each group of animals can be switched on or off.
- **Music:** soft piano, your own music files, or silence. Your own files stay on your device and are never uploaded.

For a quick change of weather, the **⋯** menu has **Let it rain** and **Let the sky clear**. Rain greys the sky, ripples the pond and plays a soft rain sound (silenced with the music button).

In autumn, wisteria gives way to hanging veils of red and yellow leaves, including the pink veils over the swings.

## Keys

Walk with W A S D or the arrows, drag to look, E (or a click) for whatever glows. M the map, N write, V see yourself, B back to the gate, C customize, G public gardens, U music, L moonlight, P rain, Y next season, T walk through time, F full screen, ? help. Reading: ← → turn the page, J heart, K notes. On a swing: W or Space to swing, R to read.

## How privacy works

- **New gardens are private.** Only the owner can read their poems.
- **"Make my garden public"** lets anyone, signed in or not, walk through it and read its poems.
- **Poems marked "Keep this poem private"** stay hidden even in a public garden. This is enforced by the database, not just the page.
- **Hearts:** only signed-in visitors can leave one, one per poem, only on poems they can read and never on their own. Everyone sees how many; only the poet sees who.
- **Notes:** only signed-in visitors can leave them, only on poems they can read, and never on their own poems. The poet sees every note left in their garden, and can remove notes from their own poems.
- **Garden links:** each public garden has a shareable link, `?garden=username`, that opens straight into it.

## Tables

| Table | Holds |
|---|---|
| `profiles` | display name, username and your figure (`avatar`), created automatically at sign-up |
| `gardens` | one per person: name, welcome line, season, settings, public or private |
| `poems` | each poem, its mood, plant type and fixed position; `deleted_at` keeps a removed poem for 30 days |
| `notes` | kind notes left beside a poem; the poet can hide one |
| `poem_likes` | hearts on poems, one per person per poem |
| `note_reports` | reports of unkind notes |
| `public_gardens` (view) | the list visitors browse, with poem counts (searched and paged by `list_public_gardens()`) |

Poems written before signing in are moved into the account the first time that person signs in on the same device. Saving goes through `save_poem()`, which notices when a poem changed somewhere else and asks which version to keep. See docs/database.md.
