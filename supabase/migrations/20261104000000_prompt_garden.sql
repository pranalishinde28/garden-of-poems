-- The daily prompt's shared grove. Each day (UTC) there is one prompt (chosen in the app from its list); a poet who
-- answers it may plant a copy of the poem in that day's Prompt Garden, which everyone can walk, including visitors
-- without an account. Sharing there is a choice made per poem, so the copy is kept here (title, text, mood and the
-- name to show), independent of whether the poet's own garden is public. A poet may plant at most three answers a
-- day, only for today or yesterday, and may take any of them back. Three reports from different people hide one
-- until it is looked at.
create table if not exists public.prompt_answers (
  day date not null,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  poem_id text not null check (char_length(poem_id) between 1 and 64),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(body) between 1 and 10000),
  mood text not null default 'reflection' check (char_length(mood) <= 24),
  by_name text not null default '' check (char_length(by_name) <= 80),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (day, owner, poem_id)
);
create index if not exists prompt_answers_day on public.prompt_answers (day, created_at);
alter table public.prompt_answers enable row level security;

drop policy if exists "anyone may walk the grove" on public.prompt_answers;
create policy "anyone may walk the grove" on public.prompt_answers for select using (not hidden or owner = auth.uid());
drop policy if exists "plant your own answers" on public.prompt_answers;
create policy "plant your own answers" on public.prompt_answers for insert to authenticated with check (owner = auth.uid() and not hidden);
drop policy if exists "take back your own answers" on public.prompt_answers;
create policy "take back your own answers" on public.prompt_answers for delete to authenticated using (owner = auth.uid());

create or replace function public.prompt_answers_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.day < (now() at time zone 'utc')::date - 1 or new.day > (now() at time zone 'utc')::date + 1 then
    raise exception 'answers grow in today''s grove' using errcode = 'P0001';
  end if;
  if (select count(*) from public.prompt_answers where owner = new.owner and day = new.day) >= 3 then
    raise exception 'three answers a day is plenty' using errcode = 'P0001';
  end if;
  new.hidden := false; new.created_at := now();
  return new;
end $$;
drop trigger if exists prompt_answers_guard on public.prompt_answers;
create trigger prompt_answers_guard before insert on public.prompt_answers for each row execute function public.prompt_answers_guard();

-- reports: one per person per answer; the third hides it
create table if not exists public.prompt_reports (
  day date not null,
  owner uuid not null,
  poem_id text not null,
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 280),
  created_at timestamptz not null default now(),
  primary key (day, owner, poem_id, reporter),
  foreign key (day, owner, poem_id) references public.prompt_answers (day, owner, poem_id) on delete cascade
);
alter table public.prompt_reports enable row level security;
drop policy if exists "report what you have read" on public.prompt_reports;
create policy "report what you have read" on public.prompt_reports for insert to authenticated with check (reporter = auth.uid() and owner <> auth.uid());
drop policy if exists "see your own reports" on public.prompt_reports;
create policy "see your own reports" on public.prompt_reports for select to authenticated using (reporter = auth.uid());

create or replace function public.prompt_reports_hide() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.prompt_reports where day = new.day and owner = new.owner and poem_id = new.poem_id) >= 3 then
    update public.prompt_answers set hidden = true where day = new.day and owner = new.owner and poem_id = new.poem_id;
  end if;
  return new;
end $$;
drop trigger if exists prompt_reports_hide on public.prompt_reports;
create trigger prompt_reports_hide after insert on public.prompt_reports for each row execute function public.prompt_reports_hide();

-- the grove's archive: the days that have answers, newest first, with how many
create or replace function public.prompt_days(lim int default 60)
returns table (day date, answers bigint) language sql stable security invoker set search_path = public as $$
  select a.day, count(*) from public.prompt_answers a where not a.hidden group by a.day order by a.day desc limit least(greatest(lim, 1), 365);
$$;
revoke all on function public.prompt_days(int) from public;
grant execute on function public.prompt_days(int) to anon, authenticated;
