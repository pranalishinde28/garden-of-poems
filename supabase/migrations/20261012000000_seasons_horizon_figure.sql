-- Four seasons (and "follow the calendar"), a sea horizon, and the chibi figure's new choices.

-- gardens.theme held only spring or autumn; it may now hold any of the four seasons
alter table public.gardens drop constraint if exists gardens_theme_check;
alter table public.gardens add constraint gardens_theme_check check (theme in ('spring', 'summer', 'autumn', 'winter'));

create or replace function public.valid_settings(s jsonb)
returns boolean language plpgsql immutable as $$
declare l jsonb;
begin
  if s is null or s = '{}'::jsonb then return true; end if;
  if jsonb_typeof(s) <> 'object' then return false; end if;
  if not public.only_keys(s, array['season','view','light','weather','tree','blossom','music','fuji','mist','drift','name','desc','links','show']) then return false; end if;
  if s ? 'season'  and not (s->>'season'  = any(array['auto','spring','summer','autumn','winter'])) then return false; end if;
  if s ? 'view'    and not (s->>'view'    = any(array['fuji','sea'])) then return false; end if;
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

create or replace function public.valid_avatar(a jsonb)
returns boolean language plpgsql immutable as $$
begin
  if a is null then return true; end if;
  if jsonb_typeof(a) <> 'object' or not public.only_keys(a, array['skin','height','hairStyle','hairColor','outfit','cloth','accent','extra']) then return false; end if;
  if a ? 'hairStyle' and not (a->>'hairStyle' = any(array['short','bob','long','bun','tail','twintails'])) then return false; end if;
  if a ? 'outfit' and not (a->>'outfit' = any(array['casual','yukata','kimono','coat','dress'])) then return false; end if;
  if a ? 'extra' and not (a->>'extra' = any(array['none','scarf','hat','parasol'])) then return false; end if;
  if exists (select 1 from unnest(array['skin','hairColor','cloth','accent']) k where a ? k and (a->>k) !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
  if a ? 'height' and (jsonb_typeof(a->'height') <> 'number' or (a->>'height')::numeric not between 0.9 and 1.08) then return false; end if;
  return pg_column_size(a) < 1000;
end $$;
