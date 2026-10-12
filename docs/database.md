# The database

Supabase Postgres, changed only through migrations in `supabase/migrations/`. Privacy is enforced by row-level security (RLS) in the database, never only in the page, and is covered by tests that run in CI.

## What is in it

| Migration | Adds |
|---|---|
| `20261011000000_baseline.sql` | The original schema: profiles, gardens, poems, notes, the `public_gardens` view, RLS, sign-up trigger |
| `20261011000100_validation.sql` | JSON shape checks for `gardens.settings` and the new `profiles.avatar`, allowed values for moods, plant types and positions, trimmed non-empty titles (a trigger trims them), length limits |
| `20261011000200_notes_moderation.sql` | Rate limits (20 notes per author per day, 3 per poem per hour), `notes.hidden` (the poet can hide a note without deleting it), `note_reports` |
| `20261011000300_sync_and_soft_delete.sql` | The server owns `updated_at`; `poems.deleted_at` (recently removed, 30 days, then a daily pg_cron purge); `save_poem()`, `remove_poem()`, `restore_poem()` |
| `20261011000400_accounts_and_search.sql` | `username_available()`, `change_username()`, `delete_my_account()`, trigram indexes and `list_public_gardens()` (search plus pages) |

`supabase/schema.sql` is a generated snapshot of the result (`npm run db:snapshot`). Don't edit it.

### How saving works now
The page keeps a small queue per person in localStorage (`garden-of-poems:sync:<user id>`):
- **Saving:** every poem goes through `save_poem(p, base)`. `base` is the server's `updated_at` that this device last saw for that poem. If the server copy is newer, nothing is written and the page asks which version to keep (this device's, the other one, or both as two poems).
- **Removing:** removing a poem sets `deleted_at`. Saving can't bring back a poem that was removed elsewhere (`status: deleted`). Undo, or "Bring it back" in Gardens → Recently removed, calls `restore_poem()` first.
- **Failures:** failed sends stay in the queue and retry after 2 s, 4 s, 8 s … up to a minute, and at once when the browser comes back online.

## Working locally

You need Docker Desktop running.

```sh
npx supabase start        # first run downloads the images (several minutes)
npm run db:test           # the RLS and validation tests (pgTAP, supabase/tests/)
npm run e2e:local         # builds against local Supabase and walks accounts, sync, conflicts, notes
npx supabase stop
```

- **Ports:** local Supabase uses ports 55320–55329 (`supabase/config.toml`), so it doesn't clash with other projects. Studio is at http://127.0.0.1:55323 and the API at http://127.0.0.1:55321.
- **Pointing the app at local Supabase:** to run the app against it, put the `API_URL` and `PUBLISHABLE_KEY` from `npx supabase status` into `.env`, and switch back to the live values afterwards.
- **If image pulls fail with `docker-credential-desktop: executable file not found`:** run `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` first.

### Changing the schema
1. `npx supabase migration new what_it_does`, then write SQL in the new file.
2. `npx supabase db reset`, which rebuilds the local database from all migrations.
3. Add or adjust tests in `supabase/tests/`, then `npm run db:test`.
4. `npm run db:types`, which regenerates `src/cloud/database.types.ts`. Then `npm run typecheck`.
5. `npm run db:snapshot`.

## Moving your live database onto migrations

Your live project already has the baseline (you ran `schema.sql` by hand), so the plan is: tell Supabase the baseline is applied, then push the four new migrations.

**The order doesn't matter.** The page notices a database still on the original schema (no `deleted_at`, no `save_poem()`) and saves the old way: upsert, delete, last write wins. It also leaves out what needs the update (recently removed, hiding and reporting notes, deleting an account) with a short note. Once you migrate, the new behaviour starts at the next sign-in, without a redeploy. `LEGACY=1 node dev/cloud-e2e.mjs` against a local database reset to the baseline (`npx supabase db reset --version 20261011000000`) tests that mode.

1. **Back up first.** Dashboard → Database → Backups (free plans keep daily backups), or after step 2: `npx supabase db dump --linked > backup-before-migrations.sql`.
2. **Link the project** (each command opens a browser or asks for something only you have):
   ```sh
   npx supabase login                                    # opens the browser for an access token
   npx supabase link --project-ref <your project ref>    # asks for the database password
   ```
3. **Check that the live schema matches the baseline.** `npx supabase db diff --linked --schema public` should report only cosmetic differences against a database with the baseline applied. If it shows tables or policies you don't recognise, stop and look before going on.
4. **Mark the baseline as already applied:**
   ```sh
   npx supabase migration repair --status applied 20261011000000
   ```
5. **Check pg_cron:** Dashboard → Database → Extensions → enable **pg_cron** if it isn't already. The migration also runs `create extension if not exists pg_cron`, which is enough on most projects.
6. **Push the new migrations:** `npx supabase db push`. It lists what it will apply and asks for confirmation.
7. **Validate the older rows.** A few checks were added as `NOT VALID`, so they apply to every new write but don't reject existing rows. In the SQL editor, see if anything would fail:
   ```sql
   select owner from gardens where not public.valid_settings(settings);
   select owner, id from poems where mood is not null and mood not in ('love','joy','sorrow','anger','childhood','dream','reflection');
   select id from notes where text <> btrim(text) or text = '';
   ```
   If those return nothing, make the checks full:
   ```sql
   alter table gardens validate constraint gardens_settings_valid;
   alter table gardens validate constraint gardens_name_trim;
   alter table poems validate constraint poems_mood_known;
   alter table poems validate constraint poems_plant_known;
   alter table poems validate constraint poems_position_shape;
   alter table notes validate constraint notes_text_trim;
   ```
8. **Merge and deploy the app** (the GitHub workflow does it on push to `main`).

From then on, a schema change is a new migration, `npx supabase db push`, then the app.

## Tests in CI
`.github/workflows/deploy.yml` has a `database` job: `supabase db start` (Postgres only, all migrations from scratch) and then `supabase test db`. The deploy waits for it. The full end-to-end test (`npm run e2e:local`) needs the whole local stack, so it runs on your machine, not in CI.
