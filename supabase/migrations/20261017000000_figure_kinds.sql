-- Your figure can be a girl, a boy, a cat or a bird: new keys (kind, coat, plumage) and new choices
-- (messy hair, a jacket with shorts, a pink bow).

create or replace function public.valid_avatar(a jsonb)
returns boolean language plpgsql immutable as $$
begin
  if a is null then return true; end if;
  if jsonb_typeof(a) <> 'object' or not public.only_keys(a, array['kind','skin','height','hairStyle','hairColor','outfit','cloth','accent','extra','coat','plumage']) then return false; end if;
  if a ? 'kind' and not (a->>'kind' = any(array['girl','boy','cat','bird'])) then return false; end if;
  if a ? 'hairStyle' and not (a->>'hairStyle' = any(array['short','bob','long','bun','tail','twintails','messy'])) then return false; end if;
  if a ? 'outfit' and not (a->>'outfit' = any(array['casual','yukata','kimono','coat','dress','jacket'])) then return false; end if;
  if a ? 'extra' and not (a->>'extra' = any(array['none','scarf','hat','parasol','bow'])) then return false; end if;
  if a ? 'coat' and not (a->>'coat' = any(array['siamese','tabby','black','white','grey'])) then return false; end if;
  if a ? 'plumage' and not (a->>'plumage' = any(array['cream','grey','blue'])) then return false; end if;
  if exists (select 1 from unnest(array['skin','hairColor','cloth','accent']) k where a ? k and (a->>k) !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
  if a ? 'height' and (jsonb_typeof(a->'height') <> 'number' or (a->>'height')::numeric not between 0.9 and 1.08) then return false; end if;
  return pg_column_size(a) < 1000;
end $$;
