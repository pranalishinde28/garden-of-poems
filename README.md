# The Garden of Poems

A walkable 3D garden where every poem grows into a plant. Each person signs in to their own garden, keeps it private or opens it to visitors, and can wander other people's public gardens and leave them kind notes.

The app is static files: `index.html`, `config.js`, and a Supabase database for accounts and storage. Without Supabase keys it still runs, saving one garden on the device.

## 1. Create the database (about 5 minutes)

1. Create a free project at supabase.com.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and press **Run**.
3. In **Authentication → URL Configuration**, set **Site URL** to the address where you will host the app (for example `https://garden-of-poems.vercel.app`) and add the same address under **Redirect URLs**. Confirmation and password-reset emails link back here.
4. Optional: in **Authentication → Providers → Email**, turn off "Confirm email" if you want people to start writing straight after signing up.

Already set up the database with an earlier version? Run `supabase/upgrade-1-customize.sql` once to add customization.

## 2. Connect the app

Open **Project Settings → API** and copy the **Project URL** and the **anon public** key into `config.js`:

```js
window.GARDEN_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...'
};
```

The anon key is meant to be public. The row-level security rules in the schema decide who can read or change what.

## 3. Host it

Any static host works: drag the folder onto Netlify Drop, run `npx vercel` inside it, or push it to GitHub Pages. To try it locally, run `npx serve .` and open the address it prints (opening the file directly will not let the sign-in emails link back).

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
