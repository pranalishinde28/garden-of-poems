-- Phase 0 of the community plan: blocking, and a review screen for reports.
--
-- Blocking: a poet may block a person. The person they block can no longer leave notes or hearts on their poems,
-- and the notes that person has left in the poet's garden are hidden from everyone but the person themselves.
-- The poet also stops seeing that person's notes anywhere. Blocks are private: only the blocker sees them.
--
-- Review: a note reported by three different people is hidden at once, until it is looked at. Moderators (people
-- listed in public.moderators, added by hand in SQL) see every reported note in one queue and can hide it for good
-- or restore it. Nobody else can see the queue.

create table if not exists public.blocks (
  blocker uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "see your own blocks" on public.blocks;
create policy "see your own blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
drop policy if exists "block someone" on public.blocks;
create policy "block someone" on public.blocks for insert to authenticated with check (blocker = auth.uid());
drop policy if exists "unblock someone" on public.blocks;
create policy "unblock someone" on public.blocks for delete to authenticated using (blocker = auth.uid());
create or replace function public.blocked_by(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker = a and blocked = b);
$$;
revoke all on function public.blocked_by(uuid, uuid) from public;
grant execute on function public.blocked_by(uuid, uuid) to anon, authenticated;

-- notes: a blocked person cannot leave notes; their notes in the blocker's garden are hidden from others; you do
-- not see the notes of people you have blocked
drop policy if exists "leave notes" on public.notes;
create policy "leave notes" on public.notes for insert with check (
  author = auth.uid() and garden_owner <> auth.uid() and public.poem_visible(garden_owner, poem_id) and not public.blocked_by(garden_owner, auth.uid())
);
drop policy if exists "read notes" on public.notes;
create policy "read notes" on public.notes for select using (
  author = auth.uid()
  or ((garden_owner = auth.uid() or (not hidden and public.poem_visible(garden_owner, poem_id)))
      and not public.blocked_by(garden_owner, author)
      and (auth.uid() is null or not public.blocked_by(auth.uid(), author)))
);
-- hearts: a blocked person cannot heart the blocker's poems
drop policy if exists "heart a poem you can read" on public.poem_likes;
create policy "heart a poem you can read" on public.poem_likes for insert with check (
  liker = auth.uid() and public.poem_visible(garden_owner, poem_id) and not public.blocked_by(garden_owner, auth.uid())
);

-- three reports hide a note until it is reviewed
create or replace function public.note_reports_hide() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.note_reports where note_id = new.note_id) >= 3 then
    update public.notes set hidden = true where id = new.note_id;
  end if;
  return new;
end $$;
drop trigger if exists note_reports_hide on public.note_reports;
create trigger note_reports_hide after insert on public.note_reports for each row execute function public.note_reports_hide();
alter table public.note_reports add column if not exists reviewed boolean not null default false;

create table if not exists public.moderators (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.moderators enable row level security;
drop policy if exists "a moderator sees that they are one" on public.moderators;
create policy "a moderator sees that they are one" on public.moderators for select to authenticated using (user_id = auth.uid());

-- the queue: every reported note not yet reviewed, with how many reports and their reasons
create or replace function public.review_queue()
returns table (note_id uuid, text text, author_name text, poet_name text, poem_title text, reports bigint, reasons text[], hidden boolean, first_reported timestamptz)
language sql stable security definer set search_path = public as $$
  select n.id, n.text, coalesce(nullif(pa.display_name, ''), pa.username, 'someone'), coalesce(nullif(pg.display_name, ''), pg.username, 'someone'), p.title,
         count(r.id), array_remove(array_agg(r.reason), null), n.hidden, min(r.created_at)
  from public.note_reports r
  join public.notes n on n.id = r.note_id
  join public.poems p on p.owner = n.garden_owner and p.id = n.poem_id
  left join public.profiles pa on pa.id = n.author
  left join public.profiles pg on pg.id = n.garden_owner
  where not r.reviewed and exists (select 1 from public.moderators m where m.user_id = auth.uid())
  group by n.id, n.text, pa.display_name, pa.username, pg.display_name, pg.username, p.title, n.hidden
  order by count(r.id) desc, min(r.created_at);
$$;
-- a moderator's decision: hide the note for good, or restore it; either way its reports are marked reviewed
create or replace function public.review_note(p_note uuid, p_hide boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.moderators where user_id = auth.uid()) then raise exception 'only moderators review reports' using errcode = '42501'; end if;
  update public.notes set hidden = p_hide where id = p_note;
  update public.note_reports set reviewed = true where note_id = p_note;
end $$;
revoke all on function public.review_queue() from public, anon;
revoke all on function public.review_note(uuid, boolean) from public, anon;
grant execute on function public.review_queue() to authenticated;
grant execute on function public.review_note(uuid, boolean) to authenticated;
