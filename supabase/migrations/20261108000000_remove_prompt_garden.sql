-- The Prompt Garden is removed (asked after round 66): its answers, reports and archive go, and "since you were
-- last here" no longer counts the day's answers. (The two earlier migrations stay as they were, since the live
-- database may already have them.)
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
    'visitors', case when (since at time zone 'utc')::date < (now() at time zone 'utc')::date then (select count(distinct visitor) from public.garden_visits where garden_owner = (select id from me) and day > (since at time zone 'utc')::date) else 0 end
  ) end;
$$;
revoke all on function public.whats_new(timestamptz) from public, anon;
grant execute on function public.whats_new(timestamptz) to authenticated;

drop function if exists public.prompt_days(int);
drop table if exists public.prompt_reports;
drop table if exists public.prompt_answers;
drop function if exists public.prompt_answers_guard();
drop function if exists public.prompt_reports_hide();
