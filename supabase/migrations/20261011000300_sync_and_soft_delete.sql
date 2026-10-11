-- Robust sync: the server owns updated_at, removing a poem keeps it for 30 days ("recently removed"),
-- and saving goes through save_poem(), which reports conflicts instead of overwriting newer work and
-- never brings back a poem that was removed elsewhere.

alter table public.poems add column if not exists deleted_at timestamptz;
create index if not exists poems_owner_live_idx on public.poems (owner, created_at) where deleted_at is null;
create index if not exists poems_removed_idx on public.poems (deleted_at) where deleted_at is not null;

-- ---------- the server's clock ----------
create or replace function public.touch_poem()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := least(coalesce(new.created_at, now()), now() + interval '1 day'); end if;
  return new;
end $$;
drop trigger if exists poems_touch on public.poems;
create trigger poems_touch before insert or update on public.poems for each row execute function public.touch_poem();

-- ---------- removed poems are hidden from everyone but their poet ----------
create or replace function public.poem_visible(p_owner uuid, p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.poems p join public.gardens g on g.owner = p.owner
    where p.owner = p_owner and p.id = p_id and p.deleted_at is null
      and (p.owner = auth.uid() or (g.is_public and not p.private))
  );
$$;
drop policy if exists "read own or public poems" on public.poems;
create policy "read own or public poems" on public.poems for select using (
  owner = auth.uid()
  or (not private and deleted_at is null and exists (select 1 from public.gardens g where g.owner = poems.owner and g.is_public))
);
create or replace view public.public_gardens with (security_invoker = true) as
select g.owner, g.name, g.description, g.theme, g.updated_at,
       pr.username, pr.display_name,
       (select count(*) from public.poems p where p.owner = g.owner and not p.private and p.deleted_at is null) as poem_count,
       g.settings
from public.gardens g
join public.profiles pr on pr.id = g.owner
where g.is_public;
grant select on public.public_gardens to anon, authenticated;

-- ---------- saving, removing, restoring ----------
-- base is the updated_at this device last saw for the poem (null for a poem it has never synced).
-- Returns {status: saved | conflict | deleted, row}; on conflict or deleted nothing is written.
create or replace function public.save_poem(p jsonb, base timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid(); cur public.poems; res public.poems;
begin
  if uid is null then raise exception 'Sign in to save poems.' using errcode = '42501'; end if;
  select * into cur from public.poems where owner = uid and id = p->>'id' for update;
  if found then
    if cur.deleted_at is not null then
      return jsonb_build_object('status', 'deleted', 'row', to_jsonb(cur));
    end if;
    if (base is not null and cur.updated_at > base)
       or (base is null and (cur.title, cur.content) is distinct from (p->>'title', p->>'content')) then
      return jsonb_build_object('status', 'conflict', 'row', to_jsonb(cur));
    end if;
    update public.poems set title = p->>'title', content = p->>'content', mood = p->>'mood', theme = p->>'theme',
      important = coalesce((p->>'important')::boolean, false), private = coalesce((p->>'private')::boolean, false),
      plant_type = p->>'plant_type', position = p->'position'
    where owner = uid and id = p->>'id' returning * into res;
  else
    insert into public.poems (owner, id, title, content, mood, theme, important, private, plant_type, position, created_at)
    values (uid, p->>'id', p->>'title', p->>'content', p->>'mood', p->>'theme', coalesce((p->>'important')::boolean, false),
      coalesce((p->>'private')::boolean, false), p->>'plant_type', p->'position', coalesce((p->>'created_at')::timestamptz, now()))
    returning * into res;
  end if;
  return jsonb_build_object('status', 'saved', 'row', to_jsonb(res));
end $$;

create or replace function public.remove_poem(poem_id text)
returns public.poems language sql security invoker set search_path = public as $$
  update public.poems set deleted_at = coalesce(deleted_at, now()) where owner = auth.uid() and id = poem_id returning *;
$$;
create or replace function public.restore_poem(poem_id text)
returns public.poems language sql security invoker set search_path = public as $$
  update public.poems set deleted_at = null where owner = auth.uid() and id = poem_id and deleted_at > now() - interval '30 days' returning *;
$$;
revoke execute on function public.save_poem(jsonb, timestamptz), public.remove_poem(text), public.restore_poem(text) from public, anon;
grant execute on function public.save_poem(jsonb, timestamptz), public.remove_poem(text), public.restore_poem(text) to authenticated;

-- ---------- after 30 days, removed poems (and their notes) are gone for good ----------
create extension if not exists pg_cron;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'purge-removed-poems') then perform cron.unschedule('purge-removed-poems'); end if;
  perform cron.schedule('purge-removed-poems', '17 3 * * *', $job$delete from public.poems where deleted_at < now() - interval '30 days'$job$);
end $$;
