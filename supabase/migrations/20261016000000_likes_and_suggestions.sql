-- Hearts on poems, and public gardens suggested for you.

-- ---------- hearts ----------
-- One heart per person per poem, only on poems the person can read, never on their own.
-- The table shows you your own hearts and, to the poet, the hearts on their poems; everyone else
-- sees only counts, through poem_likes_for().
create table if not exists public.poem_likes (
  garden_owner uuid not null,
  poem_id text not null,
  liker uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (garden_owner, poem_id, liker),
  foreign key (garden_owner, poem_id) references public.poems (owner, id) on delete cascade
);
create index if not exists poem_likes_liker_idx on public.poem_likes (liker);
create index if not exists poem_likes_recent_idx on public.poem_likes (garden_owner, created_at);
alter table public.poem_likes enable row level security;

drop policy if exists "read your hearts, or the hearts on your poems" on public.poem_likes;
create policy "read your hearts, or the hearts on your poems" on public.poem_likes for select
  using (liker = auth.uid() or garden_owner = auth.uid());
drop policy if exists "heart a poem you can read, not your own" on public.poem_likes;
create policy "heart a poem you can read, not your own" on public.poem_likes for insert
  with check (liker = auth.uid() and garden_owner <> auth.uid() and public.poem_visible(garden_owner, poem_id));
drop policy if exists "take back your own heart" on public.poem_likes;
create policy "take back your own heart" on public.poem_likes for delete
  using (liker = auth.uid());
revoke all on public.poem_likes from anon;
grant select, insert, delete on public.poem_likes to authenticated;

-- the count for each poem in one garden, for the poems the caller may read, and whether one heart is theirs
create or replace function public.poem_likes_for(p_owner uuid)
returns table (poem_id text, likes integer, mine boolean)
language sql stable security definer set search_path = public as $$
  select l.poem_id, count(*)::int, coalesce(bool_or(l.liker = auth.uid()), false)
  from public.poem_likes l
  where l.garden_owner = p_owner and public.poem_visible(p_owner, l.poem_id)
  group by l.poem_id;
$$;
revoke execute on function public.poem_likes_for(uuid) from public;
grant execute on function public.poem_likes_for(uuid) to anon, authenticated;

-- ---------- gardens suggested for you ----------
-- A small score. A garden rises when it is loved and tended lately, and more when its poems share
-- your moods. Never your own garden, never a private one. reason says why, in a few words.
create or replace function public.suggested_gardens(lim int default 3)
returns table (owner uuid, name text, description text, theme text, updated_at timestamptz, username text,
               display_name text, poem_count bigint, settings jsonb, reason text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct p.mood from public.poems p where p.owner = auth.uid() and p.deleted_at is null and p.mood is not null
  ), cand as (
    select g.*,
      (select count(*) from public.poem_likes l where l.garden_owner = g.owner and l.created_at > now() - interval '30 days') as likes30,
      (select count(*) from public.notes n where n.garden_owner = g.owner and not n.hidden and n.created_at > now() - interval '30 days') as notes30,
      (select count(*) from public.poems p where p.owner = g.owner and not p.private and p.deleted_at is null and p.mood in (select mood from mine)) as shared
    from public.public_gardens g
    where g.poem_count > 0 and g.owner is distinct from auth.uid()
  )
  select c.owner, c.name, c.description, c.theme, c.updated_at, c.username, c.display_name, c.poem_count, c.settings,
    case when c.shared >= 2 and c.shared::float / greatest(c.poem_count, 1) >= 0.3 then 'Moods close to yours'
         when c.likes30 + c.notes30 >= 3 then 'Much loved this month'
         when c.updated_at > now() - interval '7 days' then 'Newly tended'
         else 'A garden worth a walk' end
  from cand c
  order by ln(1 + c.poem_count) + 1.5 * ln(1 + c.likes30) + 1.2 * ln(1 + c.notes30)
         + 2.0 * exp(-extract(epoch from now() - c.updated_at) / 86400.0 / 14.0)
         + 2.5 * (c.shared::float / greatest(c.poem_count, 1)) desc,
         c.updated_at desc
  limit least(greatest(coalesce(lim, 3), 1), 12);
$$;
revoke execute on function public.suggested_gardens(int) from public;
grant execute on function public.suggested_gardens(int) to anon, authenticated;
