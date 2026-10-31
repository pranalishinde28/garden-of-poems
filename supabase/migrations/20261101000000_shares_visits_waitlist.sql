-- Private links, visitor counts and a waitlist for patrons and printed books.

-- ---------- private links ----------
-- A poet may share their garden with chosen people by a link, even while the garden is private. Whoever
-- holds the link may walk through it and read the poems not marked private (a private poem stays the
-- poet's alone, as in a public garden). The poet sees their links, names them for themselves, sees how
-- often each was opened, and withdraws one by deleting it. Nobody else can list or guess them: the
-- token is 24 random characters, and the table is readable only by its owner.
create table if not exists public.garden_shares (
  token text primary key default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  owner uuid not null references auth.users (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 60),
  opened integer not null default 0,
  last_opened timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists garden_shares_owner_idx on public.garden_shares (owner);
alter table public.garden_shares enable row level security;

drop policy if exists "see your own links" on public.garden_shares;
create policy "see your own links" on public.garden_shares for select using (owner = auth.uid());
drop policy if exists "withdraw your own links" on public.garden_shares;
create policy "withdraw your own links" on public.garden_shares for delete using (owner = auth.uid());
drop policy if exists "rename your own links" on public.garden_shares;
create policy "rename your own links" on public.garden_shares for update using (owner = auth.uid()) with check (owner = auth.uid());
-- no insert policy: links are made through create_share(), which caps how many one poet may have

create or replace function public.create_share(p_label text default '')
returns public.garden_shares
language plpgsql security definer set search_path = public as $$
declare r public.garden_shares;
begin
  if auth.uid() is null then raise exception 'sign in to share your garden' using errcode = '42501'; end if;
  if (select count(*) from public.garden_shares where owner = auth.uid()) >= 20 then
    raise exception 'a garden may have at most 20 private links; withdraw one first' using errcode = 'P0001';
  end if;
  insert into public.garden_shares (owner, label) values (auth.uid(), left(coalesce(trim(p_label), ''), 60)) returning * into r;
  return r;
end $$;
revoke execute on function public.create_share(text) from public, anon;
grant execute on function public.create_share(text) to authenticated;

-- open a garden by its link: the garden's sign and settings and its readable poems, or null for a link
-- that does not exist (or was withdrawn). Counts the opening.
create or replace function public.shared_garden(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.garden_shares; g jsonb; ps jsonb;
begin
  select * into s from public.garden_shares where token = p_token;
  if not found then return null; end if;
  if s.owner is distinct from auth.uid() then update public.garden_shares set opened = opened + 1, last_opened = now() where token = p_token; end if;
  select jsonb_build_object('owner', g0.owner, 'name', g0.name, 'description', g0.description, 'theme', g0.theme, 'settings', g0.settings,
                            'username', pr.username, 'display_name', pr.display_name, 'is_public', g0.is_public)
    into g from public.gardens g0 join public.profiles pr on pr.id = g0.owner where g0.owner = s.owner;
  select coalesce(jsonb_agg(to_jsonb(p) - 'owner' order by p.created_at), '[]'::jsonb) into ps
    from (select * from public.poems where owner = s.owner and not private and deleted_at is null order by created_at limit 300) p;
  return g || jsonb_build_object('poems', ps);
end $$;
revoke execute on function public.shared_garden(text) from public;
grant execute on function public.shared_garden(text) to anon, authenticated;

-- ---------- visitor counts ----------
-- One row per visitor per garden per day. A visitor is their account if signed in, otherwise a random
-- key their browser keeps; no names, emails or addresses are stored. Only public gardens and gardens
-- opened by a valid link are counted, and never the poet's own walks. The rows are readable by nobody
-- directly; the poet sees totals through my_visits().
create table if not exists public.garden_visits (
  garden_owner uuid not null references auth.users (id) on delete cascade,
  visitor text not null check (char_length(visitor) between 8 and 80),
  day date not null default current_date,
  primary key (garden_owner, day, visitor)
);
alter table public.garden_visits enable row level security;

create or replace function public.record_visit(p_owner uuid, p_visitor text, p_token text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if p_owner is null or p_owner = auth.uid() then return; end if;
  if not exists (select 1 from public.gardens where owner = p_owner and is_public)
     and not exists (select 1 from public.garden_shares where token = p_token and owner = p_owner) then return; end if;
  who := case when auth.uid() is not null then 'u:' || auth.uid()::text else 'a:' || left(coalesce(p_visitor, ''), 64) end;
  if char_length(who) < 10 then return; end if;
  -- a quiet ceiling against anyone inflating a garden's numbers
  if (select count(*) from public.garden_visits where garden_owner = p_owner and day = current_date) >= 5000 then return; end if;
  insert into public.garden_visits (garden_owner, visitor) values (p_owner, who) on conflict do nothing;
end $$;
revoke execute on function public.record_visit(uuid, text, text) from public;
grant execute on function public.record_visit(uuid, text, text) to anon, authenticated;

create or replace function public.my_visits()
returns table (today bigint, week bigint, month bigint, total bigint, people bigint)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where day = current_date),
         count(*) filter (where day > current_date - 7),
         count(*) filter (where day > current_date - 30),
         count(*),
         count(distinct visitor)
  from public.garden_visits where garden_owner = auth.uid();
$$;
revoke execute on function public.my_visits() from public, anon;
grant execute on function public.my_visits() to authenticated;

-- ---------- the waitlist: patrons of the garden, and printed books ----------
create table if not exists public.waitlist (
  person uuid not null references auth.users (id) on delete cascade,
  wish text not null check (wish in ('patron', 'book')),
  created_at timestamptz not null default now(),
  primary key (person, wish)
);
alter table public.waitlist enable row level security;
drop policy if exists "see your own wishes" on public.waitlist;
create policy "see your own wishes" on public.waitlist for select using (person = auth.uid());
drop policy if exists "add your own wish" on public.waitlist;
create policy "add your own wish" on public.waitlist for insert with check (person = auth.uid());
drop policy if exists "take back your own wish" on public.waitlist;
create policy "take back your own wish" on public.waitlist for delete using (person = auth.uid());
