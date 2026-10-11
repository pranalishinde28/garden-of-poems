# The Garden of Poems

A walkable 3D garden where every poem grows into a plant. Each person signs in to their own garden, keeps it private or opens it to visitors, and can wander other people's public gardens and leave them kind notes.

The app is a static site built with Vite and Three.js, with a Supabase database for accounts and storage. Without Supabase keys it still runs, saving one garden on the device.

## 1. Create the database (about 5 minutes)

1. Create a free project at supabase.com.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and press **Run**.
3. In **Authentication → URL Configuration**, set **Site URL** to the address where you will host the app (for example `https://garden-of-poems.vercel.app`) and add the same address under **Redirect URLs**. Confirmation and password-reset emails link back here.
4. Optional: in **Authentication → Providers → Email**, turn off "Confirm email" if you want people to start writing straight after signing up.

Already set up the database with an earlier version? Run `supabase/upgrade-1-customize.sql` once to add customization.

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

Compare two sets of screenshots with `node dev/compare.mjs dev/shots intro pond`, which expects `before-*.png` and `after-*.png` pairs.

## 4. Host it

Any static host works: build, then publish `dist/` (Netlify, Vercel, GitHub Pages). If the site lives under a sub-path, build with `GARDEN_BASE=/that-path/ npm run build`. Then add the site's address under **Authentication → URL Configuration** in Supabase (Site URL and Redirect URLs), so confirmation and password-reset emails link back to it.

## Customizing a garden

The sliders button at the top opens **Customize**. Everything there is saved with the garden (on the device for guests, in the account once signed in), and visitors see the same choices:

- **The sign at the gate:** garden name, a welcome line, and up to six links (socials, portfolio). Visitors click the sign to open them. Only `https://` and `http://` links are accepted.
- **Scenery:** season (spring or autumn), light (follow the clock, always day, always night), weather (clear, passing showers, or rain), Mount Fuji, mist, and drifting pollen, leaves or snow.
- **Poem trees:** cherry blossom (pink or white), red maple, or green leaves.
- **What grows and lives here:** wisteria, tulips, roses, hydrangeas, lilies, orchids, lamps, the swing garden, and each group of animals can be switched on or off.
- **Music:** soft piano, your own music files, or silence. Your own files stay on your device and are never uploaded.

For a quick change of weather, the **⋯** menu has **Let it rain** and **Let the sky clear**. Rain greys the sky, ripples the pond and plays a soft rain sound (silenced with the music button).

In autumn, wisteria gives way to hanging veils of red and yellow leaves, including the pink veils over the swings.

## How privacy works

- **New gardens are private.** Only the owner can read their poems.
- **"Make my garden public"** lets anyone, signed in or not, walk through it and read its poems.
- **Poems marked "Keep this poem private"** stay hidden even in a public garden. This is enforced by the database, not just the page.
- **Notes:** only signed-in visitors can leave them, only on poems they can read, and never on their own poems. The poet sees every note left in their garden, and can remove notes from their own poems.
- **Garden links:** each public garden has a shareable link, `?garden=username`, that opens straight into it.

## Tables

| Table | Holds |
|---|---|
| `profiles` | display name and username, created automatically at sign-up |
| `gardens` | one per person: name, welcome line, season, public or private |
| `poems` | each poem, its mood, plant type and fixed position in the garden |
| `notes` | kind notes left beside a poem |
| `public_gardens` (view) | the list visitors browse, with poem counts |

Poems written before signing in are moved into the account the first time that person signs in on the same device.
