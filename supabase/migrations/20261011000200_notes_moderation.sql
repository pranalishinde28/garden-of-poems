-- Kind notes, kept kind: rate limits, reports, and hiding without deleting.

-- ---------- rate limits: at most 20 notes per author per day, 3 per poem per hour ----------
create or replace function public.notes_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.notes where author = new.author and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have left many notes today. Please come back tomorrow.' using errcode = 'P0001', hint = 'rate_limit_day';
  end if;
  if (select count(*) from public.notes where author = new.author and garden_owner = new.garden_owner and poem_id = new.poem_id and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have left a few notes on this poem already. Give it a little while.' using errcode = 'P0001', hint = 'rate_limit_poem';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists notes_rate_limit on public.notes;
create trigger notes_rate_limit before insert on public.notes for each row execute function public.notes_rate_limit();
create index if not exists notes_author_time_idx on public.notes (author, created_at desc);

-- ---------- hiding: the poet can hide a note on their poem; hidden notes are seen only by the poet and its author ----------
alter table public.notes add column if not exists hidden boolean not null default false;

drop policy if exists "read notes" on public.notes;
create policy "read notes" on public.notes for select using (
  author = auth.uid() or garden_owner = auth.uid() or (not hidden and public.poem_visible(garden_owner, poem_id))
);
drop policy if exists "hide notes in my garden" on public.notes;
create policy "hide notes in my garden" on public.notes for update using (garden_owner = auth.uid()) with check (garden_owner = auth.uid());
-- the poet may change only `hidden`; everything else about a note stays as its author wrote it
create or replace function public.notes_only_hide()
returns trigger language plpgsql as $$
begin
  if (new.id, new.garden_owner, new.poem_id, new.author, new.text, new.created_at) is distinct from (old.id, old.garden_owner, old.poem_id, old.author, old.text, old.created_at) then
    raise exception 'Only a note''s visibility can change.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists notes_only_hide on public.notes;
create trigger notes_only_hide before update on public.notes for each row execute function public.notes_only_hide();
revoke update on public.notes from anon, authenticated;
grant update (hidden) on public.notes to authenticated;

-- ---------- reports: anyone signed in can report a note they can read; the poet sees reports in their garden ----------
create table if not exists public.note_reports (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  reporter   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason     text check (reason is null or char_length(reason) <= 280),
  created_at timestamptz not null default now(),
  unique (note_id, reporter)
);
create index if not exists note_reports_note_idx on public.note_reports (note_id);
alter table public.note_reports enable row level security;

drop policy if exists "report a readable note" on public.note_reports;
create policy "report a readable note" on public.note_reports for insert with check (
  reporter = auth.uid() and exists (select 1 from public.notes n where n.id = note_id and n.author <> auth.uid())
);
drop policy if exists "see my reports and reports in my garden" on public.note_reports;
create policy "see my reports and reports in my garden" on public.note_reports for select using (
  reporter = auth.uid() or exists (select 1 from public.notes n where n.id = note_id and n.garden_owner = auth.uid())
);
