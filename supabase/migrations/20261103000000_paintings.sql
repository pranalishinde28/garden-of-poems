-- The Hall of Paintings in the secret world: paintings people hang there. The picture itself lives in Storage
-- (bucket paintings, at <owner>/<id>.jpg, at most 3 MB, images only); this table says what it is. Like books and
-- poems: a painting is its painter's; visitors see the paintings of a public garden, never a private one. 60 each.
create table if not exists public.paintings (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  artist text not null default '' check (char_length(artist) <= 80),
  note text not null default '' check (char_length(note) <= 600),
  path text not null check (char_length(path) <= 200),
  width int not null default 0 check (width between 0 and 10000),
  height int not null default 0 check (height between 0 and 10000),
  private boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner, id),
  check (path = owner::text || '/' || id || '.jpg')
);
alter table public.paintings enable row level security;
drop policy if exists "see your paintings, or the shared paintings of a public garden" on public.paintings;
create policy "see your paintings, or the shared paintings of a public garden" on public.paintings for select
  using (owner = auth.uid() or (not private and exists (select 1 from public.gardens g where g.owner = paintings.owner and g.is_public)));
drop policy if exists "hang your own paintings" on public.paintings;
create policy "hang your own paintings" on public.paintings for insert with check (owner = auth.uid());
drop policy if exists "change your own paintings" on public.paintings;
create policy "change your own paintings" on public.paintings for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "take down your own paintings" on public.paintings;
create policy "take down your own paintings" on public.paintings for delete using (owner = auth.uid());

create or replace function public.paintings_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.paintings where owner = new.owner) >= 60 then
    raise exception 'a wall holds at most 60 paintings' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists paintings_guard on public.paintings;
create trigger paintings_guard before insert on public.paintings for each row execute function public.paintings_guard();

-- the pictures: a private bucket; you write only in your own folder; others read a picture only when its painting is
-- visible to them (the table's own rule decides)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paintings', 'paintings', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "paintings: put your own" on storage.objects;
create policy "paintings: put your own" on storage.objects for insert to authenticated
  with check (bucket_id = 'paintings' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "paintings: replace your own" on storage.objects;
create policy "paintings: replace your own" on storage.objects for update to authenticated
  using (bucket_id = 'paintings' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "paintings: remove your own" on storage.objects;
create policy "paintings: remove your own" on storage.objects for delete to authenticated
  using (bucket_id = 'paintings' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "paintings: see what you may see" on storage.objects;
create policy "paintings: see what you may see" on storage.objects for select
  using (bucket_id = 'paintings' and ((storage.foldername(name))[1] = auth.uid()::text
         or exists (select 1 from public.paintings p where p.path = storage.objects.name)));
