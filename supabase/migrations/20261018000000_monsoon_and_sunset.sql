-- The owner's three seasons (spring, the monsoon, autumn; no winter) and a sunset light.

-- gardens saved with the old seasons move to the nearest new one
update public.gardens set theme = case theme when 'summer' then 'monsoon' when 'winter' then 'autumn' else theme end where theme in ('summer','winter');
update public.gardens set settings = jsonb_set(settings, '{season}', to_jsonb(case settings->>'season' when 'summer' then 'monsoon' else 'autumn' end))
  where settings->>'season' in ('summer','winter');
alter table public.gardens drop constraint if exists gardens_theme_check;
alter table public.gardens add constraint gardens_theme_check check (theme in ('spring', 'monsoon', 'autumn'));

create or replace function public.valid_settings(s jsonb)
returns boolean language plpgsql immutable as $$
declare l jsonb;
begin
  if s is null or s = '{}'::jsonb then return true; end if;
  if jsonb_typeof(s) <> 'object' then return false; end if;
  if not public.only_keys(s, array['season','view','light','weather','tree','blossom','music','fuji','mist','drift','name','desc','links','show']) then return false; end if;
  if s ? 'season'  and not (s->>'season'  = any(array['auto','spring','monsoon','autumn'])) then return false; end if;
  if s ? 'view'    and not (s->>'view'    = any(array['fuji','sea'])) then return false; end if;
  if s ? 'light'   and not (s->>'light'   = any(array['auto','day','sunset','night'])) then return false; end if;
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

