-- Run this once if you created the database with the earlier schema.sql.
-- It adds per-garden customization (scenery, features, trees, music, sign links).
alter table public.gardens add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.gardens drop constraint if exists gardens_settings_size;
alter table public.gardens add constraint gardens_settings_size check (pg_column_size(settings) < 16000);

create or replace view public.public_gardens with (security_invoker = true) as
select g.owner, g.name, g.description, g.theme, g.updated_at,
       pr.username, pr.display_name,
       (select count(*) from public.poems p where p.owner = g.owner and not p.private) as poem_count,
       g.settings
from public.gardens g
join public.profiles pr on pr.id = g.owner
where g.is_public;

grant select on public.public_gardens to anon, authenticated;
