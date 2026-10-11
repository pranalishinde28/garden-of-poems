-- Validation in the database: the page cleans what it sends, but the database is the last word.
-- JSON shapes for gardens.settings and the new profiles.avatar, allowed values, length limits,
-- and trimmed, non-empty titles.

-- ---------- helpers ----------
-- true when every key of obj is in allowed
create or replace function public.only_keys(obj jsonb, allowed text[])
returns boolean language sql immutable as $$
  select coalesce(bool_and(k = any(allowed)), true) from jsonb_object_keys(obj) as k;
$$;

-- garden settings, as written by settings/storage.js cleanSettings()
create or replace function public.valid_settings(s jsonb)
returns boolean language plpgsql immutable as $$
declare l jsonb;
begin
  if s is null or s = '{}'::jsonb then return true; end if;
  if jsonb_typeof(s) <> 'object' then return false; end if;
  if not public.only_keys(s, array['season','light','weather','tree','blossom','music','fuji','mist','drift','name','desc','links','show']) then return false; end if;
  if s ? 'season'  and not (s->>'season'  = any(array['spring','autumn'])) then return false; end if;
  if s ? 'light'   and not (s->>'light'   = any(array['auto','day','night'])) then return false; end if;
  if s ? 'weather' and not (s->>'weather' = any(array['clear','showers','rain'])) then return false; end if;
  if s ? 'tree'    and not (s->>'tree'    = any(array['sakura','maple','green'])) then return false; end if;
  if s ? 'blossom' and not (s->>'blossom' = any(array['pink','white'])) then return false; end if;
  if s ? 'music'   and not (s->>'music'   = any(array['piano','own','off'])) then return false; end if;
  if (s ? 'fuji' and jsonb_typeof(s->'fuji') <> 'boolean') or (s ? 'mist' and jsonb_typeof(s->'mist') <> 'boolean') or (s ? 'drift' and jsonb_typeof(s->'drift') <> 'boolean') then return false; end if;
  if s ? 'name' and (jsonb_typeof(s->'name') <> 'string' or char_length(s->>'name') > 60) then return false; end if;
  if s ? 'desc' and (jsonb_typeof(s->'desc') <> 'string' or char_length(s->>'desc') > 280) then return false; end if;
  if s ? 'show' then
    if jsonb_typeof(s->'show') <> 'object' or not public.only_keys(s->'show', array['wisteria','tulips','roses','hydrangeas','lilies','orchids','lamps','swings','land','air','water']) then return false; end if;
    if exists (select 1 from jsonb_each(s->'show') e where jsonb_typeof(e.value) <> 'boolean') then return false; end if;
  end if;
  if s ? 'links' then
    if jsonb_typeof(s->'links') <> 'array' or jsonb_array_length(s->'links') > 6 then return false; end if;
    for l in select * from jsonb_array_elements(s->'links') loop
      if jsonb_typeof(l) <> 'object' or not public.only_keys(l, array['label','url']) then return false; end if;
      if char_length(coalesce(l->>'label','')) > 40 or char_length(coalesce(l->>'url','')) > 200 then return false; end if;
      if (l->>'url') !~* '^https?://[^\s<>"]+$' then return false; end if;
    end loop;
  end if;
  return pg_column_size(s) < 16000;
end $$;

-- the walker's figure, as written by player/avatar.js cleanAvatar()
create or replace function public.valid_avatar(a jsonb)
returns boolean language plpgsql immutable as $$
begin
  if a is null then return true; end if;
  if jsonb_typeof(a) <> 'object' or not public.only_keys(a, array['skin','height','hairStyle','hairColor','outfit','cloth','accent','extra']) then return false; end if;
  if a ? 'hairStyle' and not (a->>'hairStyle' = any(array['short','bob','long','bun','tail'])) then return false; end if;
  if a ? 'outfit' and not (a->>'outfit' = any(array['casual','yukata','kimono','coat'])) then return false; end if;
  if a ? 'extra' and not (a->>'extra' = any(array['none','scarf','hat','parasol'])) then return false; end if;
  if exists (select 1 from unnest(array['skin','hairColor','cloth','accent']) k where a ? k and (a->>k) !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
  if a ? 'height' and (jsonb_typeof(a->'height') <> 'number' or (a->>'height')::numeric not between 0.9 and 1.08) then return false; end if;
  return pg_column_size(a) < 1000;
end $$;

-- ---------- profiles ----------
alter table public.profiles add column if not exists avatar jsonb;
alter table public.profiles drop constraint if exists profiles_avatar_valid;
alter table public.profiles add constraint profiles_avatar_valid check (public.valid_avatar(avatar));
alter table public.profiles drop constraint if exists profiles_display_name_trim;
alter table public.profiles add constraint profiles_display_name_trim check (display_name is null or display_name = btrim(display_name));

-- ---------- gardens ----------
-- NOT VALID: checked for every new write; older rows are checked by the migration guide's step before VALIDATE
alter table public.gardens drop constraint if exists gardens_settings_valid;
alter table public.gardens add constraint gardens_settings_valid check (public.valid_settings(settings)) not valid;
alter table public.gardens drop constraint if exists gardens_name_trim;
alter table public.gardens add constraint gardens_name_trim check (name = btrim(name) and name <> '') not valid;

-- ---------- poems ----------
-- trim titles and themes on the way in, so the checks below never surprise anyone
create or replace function public.tidy_poem()
returns trigger language plpgsql as $$
begin
  new.title := btrim(new.title);
  if new.title = '' then new.title := 'Untitled'; end if;
  new.theme := nullif(btrim(coalesce(new.theme, '')), '');
  return new;
end $$;
drop trigger if exists poems_tidy on public.poems;
create trigger poems_tidy before insert or update on public.poems for each row execute function public.tidy_poem();
update public.poems set title = btrim(title) where title <> btrim(title);
update public.poems set title = 'Untitled' where title = '';

alter table public.poems drop constraint if exists poems_title_trim;
alter table public.poems add constraint poems_title_trim check (title = btrim(title) and title <> '');
alter table public.poems drop constraint if exists poems_mood_known;
alter table public.poems add constraint poems_mood_known check (mood is null or mood in ('love','joy','sorrow','anger','childhood','dream','reflection')) not valid;
alter table public.poems drop constraint if exists poems_plant_known;
alter table public.poems add constraint poems_plant_known check (plant_type is null or plant_type in ('flower','twin','willow','orchard','bigtree','mushrooms','thorn','treehouse','oldtree')) not valid;
alter table public.poems drop constraint if exists poems_position_shape;
alter table public.poems add constraint poems_position_shape check (
  position is null or (jsonb_typeof(position) = 'object' and public.only_keys(position, array['x','y','z'])
    and jsonb_typeof(position->'x') = 'number' and jsonb_typeof(position->'z') = 'number'
    and abs((position->>'x')::numeric) < 200 and abs((position->>'z')::numeric) < 200)) not valid;

-- ---------- notes ----------
alter table public.notes drop constraint if exists notes_text_trim;
alter table public.notes add constraint notes_text_trim check (text = btrim(text) and text <> '') not valid;
