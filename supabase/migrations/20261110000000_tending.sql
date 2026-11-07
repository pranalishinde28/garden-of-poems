-- Phase 1b of the community plan: tending gardens (following, without a feed).
--
-- A poet may tend any public garden but their own. Tending is private to the one who tends: nobody sees who tends
-- whom, only the poet learns how many people tend their garden. Each tend remembers when the tender last walked
-- that garden (last_seen), so the app can light a lantern by their gate when it has new poems. A garden that goes
-- private drops out of the list (the row stays, and comes back if it opens again). Someone the poet has blocked
-- cannot begin tending their garden.
create table if not exists public.tends (
  tender uuid not null default auth.uid() references auth.users (id) on delete cascade,
  garden_owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (tender, garden_owner),
  check (tender <> garden_owner)
);
create index if not exists tends_garden on public.tends (garden_owner, created_at);
alter table public.tends enable row level security;
drop policy if exists "see what you tend" on public.tends;
create policy "see what you tend" on public.tends for select to authenticated using (tender = auth.uid());
drop policy if exists "tend a public garden" on public.tends;
create policy "tend a public garden" on public.tends for insert to authenticated with check (
  tender = auth.uid()
  and exists (select 1 from public.gardens g where g.owner = garden_owner and g.is_public)
  and not public.blocked_by(garden_owner, auth.uid())
);
drop policy if exists "stop tending" on public.tends;
create policy "stop tending" on public.tends for delete to authenticated using (tender = auth.uid());

-- at most 200 gardens each, and the times are always the server's
create or replace function public.tends_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.tends where tender = new.tender) >= 200 then
    raise exception 'two hundred gardens is a lot to tend' using errcode = 'P0001';
  end if;
  new.created_at := now(); new.last_seen := now();
  return new;
end $$;
drop trigger if exists tends_guard on public.tends;
create trigger tends_guard before insert on public.tends for each row execute function public.tends_guard();

drop function if exists public.tended_gardens();
-- the gardens you tend that are public now, with how many poems have grown there since you last walked it
create or replace function public.tended_gardens()
returns table (owner uuid, username text, name text, description text, display_name text, theme text, settings jsonb,
               is_public boolean, fresh bigint, newest text, newest_at timestamptz, last_seen timestamptz, tended_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.owner, pr.username, g.name, g.description, pr.display_name, g.theme, g.settings, g.is_public,
         (select count(*) from public.poems p where p.owner = t.garden_owner and not p.private and p.deleted_at is null and p.created_at > t.last_seen),
         (select p.title from public.poems p where p.owner = t.garden_owner and not p.private and p.deleted_at is null and p.created_at > t.last_seen order by p.created_at desc limit 1),
         (select max(p.created_at) from public.poems p where p.owner = t.garden_owner and not p.private and p.deleted_at is null and p.created_at > t.last_seen),
         t.last_seen, t.created_at
  from public.tends t
  join public.gardens g on g.owner = t.garden_owner and g.is_public
  left join public.profiles pr on pr.id = t.garden_owner
  where t.tender = auth.uid()
  order by 9 desc, t.created_at desc;
$$;
-- you walked a garden you tend: its lantern dims until something new grows
create or replace function public.tended_seen(p_owner uuid) returns void language sql security definer set search_path = public as $$
  update public.tends set last_seen = now() where tender = auth.uid() and garden_owner = p_owner;
$$;
-- how many people tend your garden (never who)
create or replace function public.my_tenders() returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.tends where garden_owner = auth.uid() and not public.blocked_by(auth.uid(), tender);
$$;
revoke all on function public.tended_gardens() from public, anon;
revoke all on function public.tended_seen(uuid) from public, anon;
revoke all on function public.my_tenders() from public, anon;
grant execute on function public.tended_gardens() to authenticated;
grant execute on function public.tended_seen(uuid) to authenticated;
grant execute on function public.my_tenders() to authenticated;

-- "since you were last here" also says how many people began tending your garden
create or replace function public.whats_new(since timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  hearts as (
    select l.poem_id, p.title, count(*) as n,
           (array_agg(coalesce(nullif(pr.display_name, ''), pr.username, 'someone') order by l.created_at desc))[1:3] as names
    from public.poem_likes l
    join public.poems p on p.owner = l.garden_owner and p.id = l.poem_id
    left join public.profiles pr on pr.id = l.liker
    where l.garden_owner = (select id from me) and l.liker <> (select id from me) and l.created_at > since
    group by l.poem_id, p.title order by count(*) desc limit 6),
  notes as (
    select n.poem_id, p.title, coalesce(nullif(pr.display_name, ''), pr.username, 'someone') as name, n.text, n.created_at
    from public.notes n
    join public.poems p on p.owner = n.garden_owner and p.id = n.poem_id
    left join public.profiles pr on pr.id = n.author
    where n.garden_owner = (select id from me) and n.author <> (select id from me) and not n.hidden and n.created_at > since
    order by n.created_at desc limit 8)
  select case when (select id from me) is null then null else jsonb_build_object(
    'hearts', coalesce((select jsonb_agg(jsonb_build_object('poem_id', poem_id, 'title', title, 'n', n, 'names', to_jsonb(names))) from hearts), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('poem_id', poem_id, 'title', title, 'name', name, 'text', text, 'at', created_at)) from notes), '[]'::jsonb),
    -- visits are counted by the day, so they are news only when you were last here on an earlier day
    'visitors', case when (since at time zone 'utc')::date < (now() at time zone 'utc')::date then (select count(distinct visitor) from public.garden_visits where garden_owner = (select id from me) and day > (since at time zone 'utc')::date) else 0 end,
    'tenders', (select count(*) from public.tends where garden_owner = (select id from me) and created_at > since and not public.blocked_by((select id from me), tender))
  ) end;
$$;
revoke all on function public.whats_new(timestamptz) from public, anon;
grant execute on function public.whats_new(timestamptz) to authenticated;
