-- The weekly letter (community plan, Phase 0): once a week, a short email to each poet who has something to hear
-- about: hearts and notes on their poems, visitors, people who began tending their garden, and new poems in the
-- gardens they tend. Nothing new, no letter. On by default; turned off in the Gardens panel, or by the link at the
-- foot of every letter (a private token, so no sign-in is needed to stop it).
--
-- The letters are written and sent by the edge function supabase/functions/weekly-digest, run once a day by pg_cron
-- through pg_net (each poet hears at most once in six days, so a daily run spreads the sending out and stays under
-- the email service's daily limit). The functions that read emails and letters are for the service role only.
create table if not exists public.digest_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly boolean not null default true,
  token uuid not null unique default gen_random_uuid(),
  last_sent timestamptz
);
-- no policies: only through the functions below
alter table public.digest_prefs enable row level security;

create or replace function public.my_digest() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select weekly from public.digest_prefs where user_id = auth.uid()), true);
$$;
create or replace function public.set_digest(p_on boolean) returns boolean language sql security definer set search_path = public as $$
  insert into public.digest_prefs (user_id, weekly) values (auth.uid(), p_on)
  on conflict (user_id) do update set weekly = excluded.weekly
  returning weekly;
$$;
-- the link in every letter: anyone holding the token may stop that person's letters (and nothing else)
create or replace function public.digest_unsubscribe(p_token uuid) returns boolean language sql security definer set search_path = public as $$
  with u as (update public.digest_prefs set weekly = false where token = p_token returning 1)
  select exists (select 1 from u);
$$;
revoke all on function public.my_digest() from public, anon;
revoke all on function public.set_digest(boolean) from public, anon;
revoke all on function public.digest_unsubscribe(uuid) from public;
grant execute on function public.my_digest() to authenticated;
grant execute on function public.set_digest(boolean) to authenticated;
grant execute on function public.digest_unsubscribe(uuid) to anon, authenticated;

-- what one poet's letter would say about the time since p_since
create or replace function public.digest_letter(p_uid uuid, p_since timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  with likes as (
    select l.poem_id, p.title from public.poem_likes l
    join public.poems p on p.owner = l.garden_owner and p.id = l.poem_id and p.deleted_at is null
    where l.garden_owner = p_uid and l.liker <> p_uid and l.created_at > p_since and not public.blocked_by(p_uid, l.liker)),
  loved as (select title, count(*) as n from likes group by poem_id, title order by count(*) desc, title limit 3),
  said as (
    select p.title, coalesce(nullif(pr.display_name, ''), pr.username, 'someone') as name, n.text, n.created_at
    from public.notes n
    join public.poems p on p.owner = n.garden_owner and p.id = n.poem_id and p.deleted_at is null
    left join public.profiles pr on pr.id = n.author
    where n.garden_owner = p_uid and n.author <> p_uid and not n.hidden and n.created_at > p_since and not public.blocked_by(p_uid, n.author)),
  tended as (
    select g.name, coalesce(nullif(pr.display_name, ''), pr.username, 'a poet') as poet, pr.username, count(*) as n,
           (array_agg(p.title order by p.created_at desc))[1:3] as titles
    from public.tends t
    join public.gardens g on g.owner = t.garden_owner and g.is_public
    join public.poems p on p.owner = t.garden_owner and not p.private and p.deleted_at is null and p.created_at > p_since
    left join public.profiles pr on pr.id = t.garden_owner
    where t.tender = p_uid
    group by g.name, pr.display_name, pr.username order by count(*) desc limit 5)
  select jsonb_build_object(
    'hearts', (select count(*) from likes),
    'loved', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'n', n)) from loved), '[]'::jsonb),
    'notes', (select count(*) from said),
    'said', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'name', name, 'text', text) order by created_at desc) from (select * from said order by created_at desc limit 3) s), '[]'::jsonb),
    'visitors', (select count(distinct visitor) from public.garden_visits where garden_owner = p_uid and day > (p_since at time zone 'utc')::date),
    'tenders', (select count(*) from public.tends where garden_owner = p_uid and created_at > p_since and not public.blocked_by(p_uid, tender)),
    'tended', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'poet', poet, 'username', username, 'n', n, 'titles', to_jsonb(titles))) from tended), '[]'::jsonb)
  );
$$;

-- the next poets due a letter (none in the last six days, letters on, a confirmed address), oldest first, each with
-- what their letter would say; p_only picks one address instead (a test send, which ignores the six days)
create or replace function public.digest_batch(p_lim int default 50, p_only text default null)
returns table (user_id uuid, email text, name text, username text, token uuid, since timestamptz, letter jsonb)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.digest_prefs (user_id) select u.id from auth.users u
  where u.email is not null and (p_only is null or lower(u.email) = lower(p_only)) on conflict do nothing;
  return query
  select u.id, u.email::text, coalesce(nullif(pr.display_name, ''), pr.username, '')::text, pr.username::text, d.token,
         coalesce(d.last_sent, now() - interval '7 days'),
         public.digest_letter(u.id, coalesce(d.last_sent, now() - interval '7 days'))
  from public.digest_prefs d
  join auth.users u on u.id = d.user_id
  left join public.profiles pr on pr.id = u.id
  where d.weekly and u.email is not null and u.email_confirmed_at is not null
    and (case when p_only is null then (d.last_sent is null or d.last_sent < now() - interval '6 days') else lower(u.email) = lower(p_only) end)
  order by d.last_sent nulls first, u.created_at
  limit least(greatest(p_lim, 1), 500);
end $$;
-- mark poets as written to (or looked at and found nothing new), so the next run moves on
create or replace function public.digest_sent(p_ids uuid[]) returns void language sql security definer set search_path = public as $$
  update public.digest_prefs set last_sent = now() where user_id = any (p_ids);
$$;
revoke all on function public.digest_letter(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.digest_batch(int, text) from public, anon, authenticated;
revoke all on function public.digest_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.digest_letter(uuid, timestamptz) to service_role;
grant execute on function public.digest_batch(int, text) to service_role;
grant execute on function public.digest_sent(uuid[]) to service_role;

-- pg_net lets pg_cron call the edge function; the daily job itself is created by the owner with the project's
-- address and the function's secret (docs/email.md), so neither is kept in this repository
create extension if not exists pg_net;
