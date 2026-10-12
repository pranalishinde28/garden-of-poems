-- Account management (username, delete everything) and a faster, searchable, paginated garden list.

-- ---------- usernames ----------
create or replace function public.username_available(name text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(name) ~ '^[a-z0-9_]{3,24}$' and not exists (select 1 from public.profiles where username = lower(name));
$$;
create or replace function public.change_username(new_name text)
returns text language plpgsql security invoker set search_path = public as $$
declare n text := lower(btrim(new_name));
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if n !~ '^[a-z0-9_]{3,24}$' then raise exception 'Usernames are 3 to 24 characters: lowercase letters, numbers and _.' using errcode = '22023'; end if;
  begin
    update public.profiles set username = n where id = auth.uid();
  exception when unique_violation then
    raise exception 'That username is taken. Try another.' using errcode = '23505';
  end;
  return n;
end $$;

-- ---------- delete my account and everything in it ----------
-- profiles, gardens, poems, notes and reports all cascade from auth.users
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.change_username(text), public.delete_my_account() to authenticated;

-- ---------- the public garden list: search and pages ----------
create extension if not exists pg_trgm;
create index if not exists gardens_name_trgm on public.gardens using gin (lower(name) gin_trgm_ops) where is_public;
create index if not exists profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_display_trgm on public.profiles using gin (lower(display_name) gin_trgm_ops);
create index if not exists notes_poem_time_idx on public.notes (garden_owner, poem_id, created_at);

-- newest first; pass the last row's updated_at and owner to get the next page
create or replace function public.list_public_gardens(q text default null, after_updated timestamptz default null, after_owner uuid default null, lim int default 20)
returns setof public.public_gardens language sql stable security invoker set search_path = public as $$
  select * from public.public_gardens g
  where (q is null or btrim(q) = '' or lower(g.name) like '%' || lower(btrim(q)) || '%' or g.username like '%' || lower(btrim(q)) || '%' or lower(g.display_name) like '%' || lower(btrim(q)) || '%')
    and (after_updated is null or (g.updated_at, g.owner) < (after_updated, after_owner))
  order by g.updated_at desc, g.owner desc
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;
grant execute on function public.list_public_gardens(text, timestamptz, uuid, int) to anon, authenticated;
