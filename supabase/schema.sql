-- ============================================================
-- The Garden of Poems: database schema for Supabase
-- Run this once in Supabase → SQL Editor → New query → Run.
-- ============================================================

create extension if not exists pgcrypto;

-- People ------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

-- One garden per person: its settings and whether it is public
create table if not exists public.gardens (
  owner       uuid primary key references public.profiles(id) on delete cascade,
  name        text not null default 'A quiet garden' check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 280),
  theme       text not null default 'spring' check (theme in ('spring', 'autumn')),
  is_public   boolean not null default false,
  settings    jsonb not null default '{}'::jsonb check (pg_column_size(settings) < 16000),
  updated_at  timestamptz not null default now()
);

-- Poems (the id is chosen by the app, unique per owner)
create table if not exists public.poems (
  owner      uuid not null references public.profiles(id) on delete cascade,
  id         text not null check (char_length(id) between 1 and 64),
  title      text not null check (char_length(title) between 1 and 120),
  content    text not null check (char_length(content) between 1 and 10000),
  mood       text,
  theme      text check (char_length(theme) <= 60),
  important  boolean not null default false,
  private    boolean not null default false,
  plant_type text,
  position   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

-- Kind notes visitors leave beside a poem
create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  garden_owner uuid not null,
  poem_id      text not null,
  author       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 280),
  created_at   timestamptz not null default now(),
  foreign key (garden_owner, poem_id) references public.poems(owner, id) on delete cascade
);
create index if not exists notes_poem_idx on public.notes (garden_owner, poem_id);
create index if not exists gardens_public_idx on public.gardens (is_public, updated_at desc);

alter table public.profiles enable row level security;
alter table public.gardens  enable row level security;
alter table public.poems    enable row level security;
alter table public.notes    enable row level security;

-- Is this poem readable by the person asking? (own poem, or a non-private poem in a public garden)
create or replace function public.poem_visible(p_owner uuid, p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.poems p join public.gardens g on g.owner = p.owner
    where p.owner = p_owner and p.id = p_id
      and (p.owner = auth.uid() or (g.is_public and not p.private))
  );
$$;

-- Profiles: names are visible to everyone; you edit only your own
drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles for select using (true);
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Gardens: public ones are readable by anyone, private ones only by their owner
drop policy if exists "read public or own garden" on public.gardens;
create policy "read public or own garden" on public.gardens for select using (is_public or owner = auth.uid());
drop policy if exists "edit own garden" on public.gardens;
create policy "edit own garden" on public.gardens for update using (owner = auth.uid()) with check (owner = auth.uid());

-- Poems: owners do everything; others read only non-private poems in public gardens
drop policy if exists "read own or public poems" on public.poems;
create policy "read own or public poems" on public.poems for select using (
  owner = auth.uid()
  or (not private and exists (select 1 from public.gardens g where g.owner = poems.owner and g.is_public))
);
drop policy if exists "insert own poems" on public.poems;
create policy "insert own poems" on public.poems for insert with check (owner = auth.uid());
drop policy if exists "update own poems" on public.poems;
create policy "update own poems" on public.poems for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "delete own poems" on public.poems;
create policy "delete own poems" on public.poems for delete using (owner = auth.uid());

-- Notes: readable by the poet, the note's author, and anyone who can read the poem.
-- Signed-in visitors may leave notes on poems they can read (not on their own).
drop policy if exists "read notes" on public.notes;
create policy "read notes" on public.notes for select using (
  author = auth.uid() or garden_owner = auth.uid() or public.poem_visible(garden_owner, poem_id)
);
drop policy if exists "leave notes" on public.notes;
create policy "leave notes" on public.notes for insert with check (
  author = auth.uid() and garden_owner <> auth.uid() and public.poem_visible(garden_owner, poem_id)
);
drop policy if exists "remove notes" on public.notes;
create policy "remove notes" on public.notes for delete using (author = auth.uid() or garden_owner = auth.uid());

-- Every new account gets a profile and a private garden
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    nullif(lower(new.raw_user_meta_data->>'username'), ''),
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)), 60)
  );
  insert into public.gardens (owner) values (new.id);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep a garden's "last tended" time current when its poems change
create or replace function public.touch_garden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.gardens set updated_at = now() where owner = coalesce(new.owner, old.owner);
  return null;
end;
$$;
drop trigger if exists poems_touch_garden on public.poems;
create trigger poems_touch_garden after insert or update or delete on public.poems
  for each row execute function public.touch_garden();

-- The list of public gardens people can visit, with how many poems each shares
create or replace view public.public_gardens with (security_invoker = true) as
select g.owner, g.name, g.description, g.theme, g.updated_at,
       pr.username, pr.display_name,
       (select count(*) from public.poems p where p.owner = g.owner and not p.private) as poem_count,
       g.settings
from public.gardens g
join public.profiles pr on pr.id = g.owner
where g.is_public;

grant select on public.public_gardens to anon, authenticated;
