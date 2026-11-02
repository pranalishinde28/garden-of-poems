-- The library in the secret world: books people write and keep on their own shelf.
-- A book is its writer's. Visitors may read the books of a public garden, except the ones kept private,
-- just as with poems. At most 200 books each.
create table if not exists public.books (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  author text not null default '' check (char_length(author) <= 80),
  body text not null check (char_length(body) between 1 and 200000),
  private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
alter table public.books enable row level security;

drop policy if exists "read your books, or the shared books of a public garden" on public.books;
create policy "read your books, or the shared books of a public garden" on public.books for select
  using (owner = auth.uid() or (not private and exists (select 1 from public.gardens g where g.owner = books.owner and g.is_public)));
drop policy if exists "write your own books" on public.books;
create policy "write your own books" on public.books for insert with check (owner = auth.uid());
drop policy if exists "change your own books" on public.books;
create policy "change your own books" on public.books for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "remove your own books" on public.books;
create policy "remove your own books" on public.books for delete using (owner = auth.uid());

create or replace function public.books_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.books where owner = new.owner) >= 200 then
    raise exception 'a shelf holds at most 200 books' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists books_guard on public.books;
create trigger books_guard before insert or update on public.books for each row execute function public.books_guard();
