-- Generated snapshot of the public schema after all migrations (npm run db:snapshot).
-- Do not edit: change the database with a new file in supabase/migrations/.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."change_username"("new_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
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
end $_$;


ALTER FUNCTION "public"."change_username"("new_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_my_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end $$;


ALTER FUNCTION "public"."delete_my_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."valid_avatar"("a" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
begin
  if a is null then return true; end if;
  if jsonb_typeof(a) <> 'object' or not public.only_keys(a, array['skin','height','hairStyle','hairColor','outfit','cloth','accent','extra']) then return false; end if;
  if a ? 'hairStyle' and not (a->>'hairStyle' = any(array['short','bob','long','bun','tail','twintails'])) then return false; end if;
  if a ? 'outfit' and not (a->>'outfit' = any(array['casual','yukata','kimono','coat','dress'])) then return false; end if;
  if a ? 'extra' and not (a->>'extra' = any(array['none','scarf','hat','parasol'])) then return false; end if;
  if exists (select 1 from unnest(array['skin','hairColor','cloth','accent']) k where a ? k and (a->>k) !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
  if a ? 'height' and (jsonb_typeof(a->'height') <> 'number' or (a->>'height')::numeric not between 0.9 and 1.08) then return false; end if;
  return pg_column_size(a) < 1000;
end $_$;


ALTER FUNCTION "public"."valid_avatar"("a" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."gardens" (
    "owner" "uuid" NOT NULL,
    "name" "text" DEFAULT 'A quiet garden'::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "theme" "text" DEFAULT 'spring'::"text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gardens_description_check" CHECK (("char_length"("description") <= 280)),
    CONSTRAINT "gardens_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 60))),
    CONSTRAINT "gardens_settings_check" CHECK (("pg_column_size"("settings") < 16000)),
    CONSTRAINT "gardens_theme_check" CHECK (("theme" = ANY (ARRAY['spring'::"text", 'summer'::"text", 'autumn'::"text", 'winter'::"text"])))
);


ALTER TABLE "public"."gardens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poems" (
    "owner" "uuid" NOT NULL,
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "mood" "text",
    "theme" "text",
    "important" boolean DEFAULT false NOT NULL,
    "private" boolean DEFAULT false NOT NULL,
    "plant_type" "text",
    "position" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "poems_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 10000))),
    CONSTRAINT "poems_id_check" CHECK ((("char_length"("id") >= 1) AND ("char_length"("id") <= 64))),
    CONSTRAINT "poems_theme_check" CHECK (("char_length"("theme") <= 60)),
    CONSTRAINT "poems_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120))),
    CONSTRAINT "poems_title_trim" CHECK ((("title" = "btrim"("title")) AND ("title" <> ''::"text")))
);


ALTER TABLE "public"."poems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar" "jsonb",
    CONSTRAINT "profiles_avatar_valid" CHECK ("public"."valid_avatar"("avatar")),
    CONSTRAINT "profiles_display_name_check" CHECK (("char_length"("display_name") <= 60)),
    CONSTRAINT "profiles_display_name_trim" CHECK ((("display_name" IS NULL) OR ("display_name" = "btrim"("display_name")))),
    CONSTRAINT "profiles_username_check" CHECK (("username" ~ '^[a-z0-9_]{3,24}$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_gardens" WITH ("security_invoker"='true') AS
 SELECT "g"."owner",
    "g"."name",
    "g"."description",
    "g"."theme",
    "g"."updated_at",
    "pr"."username",
    "pr"."display_name",
    ( SELECT "count"(*) AS "count"
           FROM "public"."poems" "p"
          WHERE (("p"."owner" = "g"."owner") AND (NOT "p"."private") AND ("p"."deleted_at" IS NULL))) AS "poem_count",
    "g"."settings"
   FROM ("public"."gardens" "g"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "g"."owner")))
  WHERE "g"."is_public";


ALTER VIEW "public"."public_gardens" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_public_gardens"("q" "text" DEFAULT NULL::"text", "after_updated" timestamp with time zone DEFAULT NULL::timestamp with time zone, "after_owner" "uuid" DEFAULT NULL::"uuid", "lim" integer DEFAULT 20) RETURNS SETOF "public"."public_gardens"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select * from public.public_gardens g
  where (q is null or btrim(q) = '' or lower(g.name) like '%' || lower(btrim(q)) || '%' or g.username like '%' || lower(btrim(q)) || '%' or lower(g.display_name) like '%' || lower(btrim(q)) || '%')
    and (after_updated is null or (g.updated_at, g.owner) < (after_updated, after_owner))
  order by g.updated_at desc, g.owner desc
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;


ALTER FUNCTION "public"."list_public_gardens"("q" "text", "after_updated" timestamp with time zone, "after_owner" "uuid", "lim" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notes_only_hide"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (new.id, new.garden_owner, new.poem_id, new.author, new.text, new.created_at) is distinct from (old.id, old.garden_owner, old.poem_id, old.author, old.text, old.created_at) then
    raise exception 'Only a note''s visibility can change.' using errcode = '42501';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."notes_only_hide"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notes_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (select count(*) from public.notes where author = new.author and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have left many notes today. Please come back tomorrow.' using errcode = 'P0001', hint = 'rate_limit_day';
  end if;
  if (select count(*) from public.notes where author = new.author and garden_owner = new.garden_owner and poem_id = new.poem_id and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have left a few notes on this poem already. Give it a little while.' using errcode = 'P0001', hint = 'rate_limit_poem';
  end if;
  new.created_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."notes_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."only_keys"("obj" "jsonb", "allowed" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(bool_and(k = any(allowed)), true) from jsonb_object_keys(obj) as k;
$$;


ALTER FUNCTION "public"."only_keys"("obj" "jsonb", "allowed" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poem_visible"("p_owner" "uuid", "p_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.poems p join public.gardens g on g.owner = p.owner
    where p.owner = p_owner and p.id = p_id and p.deleted_at is null
      and (p.owner = auth.uid() or (g.is_public and not p.private))
  );
$$;


ALTER FUNCTION "public"."poem_visible"("p_owner" "uuid", "p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_poem"("poem_id" "text") RETURNS "public"."poems"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  update public.poems set deleted_at = coalesce(deleted_at, now()) where owner = auth.uid() and id = poem_id returning *;
$$;


ALTER FUNCTION "public"."remove_poem"("poem_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_poem"("poem_id" "text") RETURNS "public"."poems"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  update public.poems set deleted_at = null where owner = auth.uid() and id = poem_id and deleted_at > now() - interval '30 days' returning *;
$$;


ALTER FUNCTION "public"."restore_poem"("poem_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_poem"("p" "jsonb", "base" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare uid uuid := auth.uid(); cur public.poems; res public.poems;
begin
  if uid is null then raise exception 'Sign in to save poems.' using errcode = '42501'; end if;
  select * into cur from public.poems where owner = uid and id = p->>'id' for update;
  if found then
    if cur.deleted_at is not null then
      return jsonb_build_object('status', 'deleted', 'row', to_jsonb(cur));
    end if;
    if (base is not null and cur.updated_at > base)
       or (base is null and (cur.title, cur.content) is distinct from (p->>'title', p->>'content')) then
      return jsonb_build_object('status', 'conflict', 'row', to_jsonb(cur));
    end if;
    update public.poems set title = p->>'title', content = p->>'content', mood = p->>'mood', theme = p->>'theme',
      important = coalesce((p->>'important')::boolean, false), private = coalesce((p->>'private')::boolean, false),
      plant_type = p->>'plant_type', position = p->'position'
    where owner = uid and id = p->>'id' returning * into res;
  else
    insert into public.poems (owner, id, title, content, mood, theme, important, private, plant_type, position, created_at)
    values (uid, p->>'id', p->>'title', p->>'content', p->>'mood', p->>'theme', coalesce((p->>'important')::boolean, false),
      coalesce((p->>'private')::boolean, false), p->>'plant_type', p->'position', coalesce((p->>'created_at')::timestamptz, now()))
    returning * into res;
  end if;
  return jsonb_build_object('status', 'saved', 'row', to_jsonb(res));
end $$;


ALTER FUNCTION "public"."save_poem"("p" "jsonb", "base" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tidy_poem"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.title := btrim(new.title);
  if new.title = '' then new.title := 'Untitled'; end if;
  new.theme := nullif(btrim(coalesce(new.theme, '')), '');
  return new;
end $$;


ALTER FUNCTION "public"."tidy_poem"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_garden"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.gardens set updated_at = now() where owner = coalesce(new.owner, old.owner);
  return null;
end;
$$;


ALTER FUNCTION "public"."touch_garden"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_poem"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := least(coalesce(new.created_at, now()), now() + interval '1 day'); end if;
  return new;
end $$;


ALTER FUNCTION "public"."touch_poem"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."username_available"("name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  select lower(name) ~ '^[a-z0-9_]{3,24}$' and not exists (select 1 from public.profiles where username = lower(name));
$_$;


ALTER FUNCTION "public"."username_available"("name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."valid_settings"("s" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
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
end $_$;


ALTER FUNCTION "public"."valid_settings"("s" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note_id" "uuid" NOT NULL,
    "reporter" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "note_reports_reason_check" CHECK ((("reason" IS NULL) OR ("char_length"("reason") <= 280)))
);


ALTER TABLE "public"."note_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "garden_owner" "uuid" NOT NULL,
    "poem_id" "text" NOT NULL,
    "author" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hidden" boolean DEFAULT false NOT NULL,
    CONSTRAINT "notes_text_check" CHECK ((("char_length"("text") >= 1) AND ("char_length"("text") <= 280)))
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


ALTER TABLE "public"."gardens"
    ADD CONSTRAINT "gardens_name_trim" CHECK ((("name" = "btrim"("name")) AND ("name" <> ''::"text"))) NOT VALID;



ALTER TABLE ONLY "public"."gardens"
    ADD CONSTRAINT "gardens_pkey" PRIMARY KEY ("owner");



ALTER TABLE "public"."gardens"
    ADD CONSTRAINT "gardens_settings_valid" CHECK ("public"."valid_settings"("settings")) NOT VALID;



ALTER TABLE ONLY "public"."note_reports"
    ADD CONSTRAINT "note_reports_note_id_reporter_key" UNIQUE ("note_id", "reporter");



ALTER TABLE ONLY "public"."note_reports"
    ADD CONSTRAINT "note_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."notes"
    ADD CONSTRAINT "notes_text_trim" CHECK ((("text" = "btrim"("text")) AND ("text" <> ''::"text"))) NOT VALID;



ALTER TABLE "public"."poems"
    ADD CONSTRAINT "poems_mood_known" CHECK ((("mood" IS NULL) OR ("mood" = ANY (ARRAY['love'::"text", 'joy'::"text", 'sorrow'::"text", 'anger'::"text", 'childhood'::"text", 'dream'::"text", 'reflection'::"text"])))) NOT VALID;



ALTER TABLE ONLY "public"."poems"
    ADD CONSTRAINT "poems_pkey" PRIMARY KEY ("owner", "id");



ALTER TABLE "public"."poems"
    ADD CONSTRAINT "poems_plant_known" CHECK ((("plant_type" IS NULL) OR ("plant_type" = ANY (ARRAY['flower'::"text", 'twin'::"text", 'willow'::"text", 'orchard'::"text", 'bigtree'::"text", 'mushrooms'::"text", 'thorn'::"text", 'treehouse'::"text", 'oldtree'::"text"])))) NOT VALID;



ALTER TABLE "public"."poems"
    ADD CONSTRAINT "poems_position_shape" CHECK ((("position" IS NULL) OR (("jsonb_typeof"("position") = 'object'::"text") AND "public"."only_keys"("position", ARRAY['x'::"text", 'y'::"text", 'z'::"text"]) AND ("jsonb_typeof"(("position" -> 'x'::"text")) = 'number'::"text") AND ("jsonb_typeof"(("position" -> 'z'::"text")) = 'number'::"text") AND ("abs"((("position" ->> 'x'::"text"))::numeric) < (200)::numeric) AND ("abs"((("position" ->> 'z'::"text"))::numeric) < (200)::numeric)))) NOT VALID;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



CREATE INDEX "gardens_name_trgm" ON "public"."gardens" USING "gin" ("lower"("name") "public"."gin_trgm_ops") WHERE "is_public";



CREATE INDEX "gardens_public_idx" ON "public"."gardens" USING "btree" ("is_public", "updated_at" DESC);



CREATE INDEX "note_reports_note_idx" ON "public"."note_reports" USING "btree" ("note_id");



CREATE INDEX "notes_author_time_idx" ON "public"."notes" USING "btree" ("author", "created_at" DESC);



CREATE INDEX "notes_poem_idx" ON "public"."notes" USING "btree" ("garden_owner", "poem_id");



CREATE INDEX "notes_poem_time_idx" ON "public"."notes" USING "btree" ("garden_owner", "poem_id", "created_at");



CREATE INDEX "poems_owner_live_idx" ON "public"."poems" USING "btree" ("owner", "created_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "poems_removed_idx" ON "public"."poems" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "profiles_display_trgm" ON "public"."profiles" USING "gin" ("lower"("display_name") "public"."gin_trgm_ops");



CREATE INDEX "profiles_username_trgm" ON "public"."profiles" USING "gin" ("username" "public"."gin_trgm_ops");



CREATE OR REPLACE TRIGGER "notes_only_hide" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."notes_only_hide"();



CREATE OR REPLACE TRIGGER "notes_rate_limit" BEFORE INSERT ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."notes_rate_limit"();



CREATE OR REPLACE TRIGGER "poems_tidy" BEFORE INSERT OR UPDATE ON "public"."poems" FOR EACH ROW EXECUTE FUNCTION "public"."tidy_poem"();



CREATE OR REPLACE TRIGGER "poems_touch" BEFORE INSERT OR UPDATE ON "public"."poems" FOR EACH ROW EXECUTE FUNCTION "public"."touch_poem"();



CREATE OR REPLACE TRIGGER "poems_touch_garden" AFTER INSERT OR DELETE OR UPDATE ON "public"."poems" FOR EACH ROW EXECUTE FUNCTION "public"."touch_garden"();



ALTER TABLE ONLY "public"."gardens"
    ADD CONSTRAINT "gardens_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_reports"
    ADD CONSTRAINT "note_reports_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_reports"
    ADD CONSTRAINT "note_reports_reporter_fkey" FOREIGN KEY ("reporter") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_author_fkey" FOREIGN KEY ("author") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_garden_owner_poem_id_fkey" FOREIGN KEY ("garden_owner", "poem_id") REFERENCES "public"."poems"("owner", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poems"
    ADD CONSTRAINT "poems_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "delete own poems" ON "public"."poems" FOR DELETE USING (("owner" = "auth"."uid"()));



CREATE POLICY "edit own garden" ON "public"."gardens" FOR UPDATE USING (("owner" = "auth"."uid"())) WITH CHECK (("owner" = "auth"."uid"()));



CREATE POLICY "edit own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."gardens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hide notes in my garden" ON "public"."notes" FOR UPDATE USING (("garden_owner" = "auth"."uid"())) WITH CHECK (("garden_owner" = "auth"."uid"()));



CREATE POLICY "insert own poems" ON "public"."poems" FOR INSERT WITH CHECK (("owner" = "auth"."uid"()));



CREATE POLICY "leave notes" ON "public"."notes" FOR INSERT WITH CHECK ((("author" = "auth"."uid"()) AND ("garden_owner" <> "auth"."uid"()) AND "public"."poem_visible"("garden_owner", "poem_id")));



ALTER TABLE "public"."note_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles are readable" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "read notes" ON "public"."notes" FOR SELECT USING ((("author" = "auth"."uid"()) OR ("garden_owner" = "auth"."uid"()) OR ((NOT "hidden") AND "public"."poem_visible"("garden_owner", "poem_id"))));



CREATE POLICY "read own or public poems" ON "public"."poems" FOR SELECT USING ((("owner" = "auth"."uid"()) OR ((NOT "private") AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."gardens" "g"
  WHERE (("g"."owner" = "poems"."owner") AND "g"."is_public"))))));



CREATE POLICY "read public or own garden" ON "public"."gardens" FOR SELECT USING (("is_public" OR ("owner" = "auth"."uid"())));



CREATE POLICY "remove notes" ON "public"."notes" FOR DELETE USING ((("author" = "auth"."uid"()) OR ("garden_owner" = "auth"."uid"())));



CREATE POLICY "report a readable note" ON "public"."note_reports" FOR INSERT WITH CHECK ((("reporter" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."notes" "n"
  WHERE (("n"."id" = "note_reports"."note_id") AND ("n"."author" <> "auth"."uid"()))))));



CREATE POLICY "see my reports and reports in my garden" ON "public"."note_reports" FOR SELECT USING ((("reporter" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."notes" "n"
  WHERE (("n"."id" = "note_reports"."note_id") AND ("n"."garden_owner" = "auth"."uid"()))))));



CREATE POLICY "update own poems" ON "public"."poems" FOR UPDATE USING (("owner" = "auth"."uid"())) WITH CHECK (("owner" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."change_username"("new_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."change_username"("new_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_username"("new_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_my_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_my_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_my_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."valid_avatar"("a" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."valid_avatar"("a" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."valid_avatar"("a" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."gardens" TO "anon";
GRANT ALL ON TABLE "public"."gardens" TO "authenticated";
GRANT ALL ON TABLE "public"."gardens" TO "service_role";



GRANT ALL ON TABLE "public"."poems" TO "anon";
GRANT ALL ON TABLE "public"."poems" TO "authenticated";
GRANT ALL ON TABLE "public"."poems" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."public_gardens" TO "anon";
GRANT ALL ON TABLE "public"."public_gardens" TO "authenticated";
GRANT ALL ON TABLE "public"."public_gardens" TO "service_role";



GRANT ALL ON FUNCTION "public"."list_public_gardens"("q" "text", "after_updated" timestamp with time zone, "after_owner" "uuid", "lim" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_public_gardens"("q" "text", "after_updated" timestamp with time zone, "after_owner" "uuid", "lim" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_public_gardens"("q" "text", "after_updated" timestamp with time zone, "after_owner" "uuid", "lim" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."notes_only_hide"() TO "anon";
GRANT ALL ON FUNCTION "public"."notes_only_hide"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notes_only_hide"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notes_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."notes_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notes_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."only_keys"("obj" "jsonb", "allowed" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."only_keys"("obj" "jsonb", "allowed" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."only_keys"("obj" "jsonb", "allowed" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."poem_visible"("p_owner" "uuid", "p_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poem_visible"("p_owner" "uuid", "p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poem_visible"("p_owner" "uuid", "p_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_poem"("poem_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_poem"("poem_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_poem"("poem_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_poem"("poem_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_poem"("poem_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_poem"("poem_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_poem"("p" "jsonb", "base" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_poem"("p" "jsonb", "base" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_poem"("p" "jsonb", "base" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tidy_poem"() TO "anon";
GRANT ALL ON FUNCTION "public"."tidy_poem"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tidy_poem"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_garden"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_garden"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_garden"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_poem"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_poem"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_poem"() TO "service_role";



GRANT ALL ON FUNCTION "public"."username_available"("name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."username_available"("name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."username_available"("name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."valid_settings"("s" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."valid_settings"("s" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."valid_settings"("s" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."note_reports" TO "anon";
GRANT ALL ON TABLE "public"."note_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."note_reports" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT UPDATE("hidden") ON TABLE "public"."notes" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







