-- Poets may heart their own poems (the owner asked for it). Their own hearts count on the card like anyone's,
-- but not toward suggesting their garden to others.
drop policy if exists "heart a poem you can read, not your own" on public.poem_likes;
drop policy if exists "heart a poem you can read" on public.poem_likes;
create policy "heart a poem you can read" on public.poem_likes for insert
  with check (liker = auth.uid() and public.poem_visible(garden_owner, poem_id));

create or replace function public.suggested_gardens(lim int default 3)
returns table (owner uuid, name text, description text, theme text, updated_at timestamptz, username text,
               display_name text, poem_count bigint, settings jsonb, reason text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct p.mood from public.poems p where p.owner = auth.uid() and p.deleted_at is null and p.mood is not null
  ), cand as (
    select g.*,
      (select count(*) from public.poem_likes l where l.garden_owner = g.owner and l.liker <> g.owner and l.created_at > now() - interval '30 days') as likes30,
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
