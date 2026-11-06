-- "Since you were last here": one call, on arriving in your own garden, for what has happened since a moment you
-- give (the app remembers when you were last here): hearts on your poems and who gave them, notes left on them,
-- how many people walked your garden, and how many answers grew in today's Prompt Garden. Only about your own
-- garden, and only for a signed-in poet; the names are the display names people show everyone anyway.
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
    'grove', (select count(*) from public.prompt_answers where day = (now() at time zone 'utc')::date and not hidden and owner <> (select id from me))
  ) end;
$$;
revoke all on function public.whats_new(timestamptz) from public, anon;
grant execute on function public.whats_new(timestamptz) to authenticated;
