-- Row-level security and validation tests, run with: npx supabase test db
-- Three people: Ada owns a garden, Bo visits, Cy visits too. Each block signs in as someone
-- (set role + JWT claims) and checks what they can and cannot see or change.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------- setup (as the database owner) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'ada@example.test', '{"username":"ada","display_name":"Ada"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bo@example.test',  '{"username":"bob","display_name":"Bo"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'cy@example.test',  '{"username":"cyd","display_name":"Cy"}');

select is((select count(*) from public.profiles where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2')), 2::bigint, 'sign-up creates a profile');
select is((select is_public from public.gardens where owner = '00000000-0000-0000-0000-0000000000a1'), false, 'new gardens are private');

insert into public.poems (owner, id, title, content, private) values
  ('00000000-0000-0000-0000-0000000000a1', 'open', 'Open', 'a poem anyone may read once the garden is public', false),
  ('00000000-0000-0000-0000-0000000000a1', 'secret', 'Secret', 'a poem kept private', true);

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

-- ---------- a private garden is the owner's alone ----------
select pg_temp.as_anon();
select is((select count(*) from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'anonymous: no poems from a private garden');
select is((select count(*) from public.gardens where owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'anonymous: a private garden is not listed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'another person: no poems from a private garden');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'), 2::bigint, 'the owner reads all their poems');

-- ---------- a public garden hides private poems ----------
update public.gardens set is_public = true where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_anon();
select results_eq($$select id from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'$$, $$values ('open')$$, 'anonymous: only the non-private poem in a public garden');
select is((select poem_count from public.public_gardens where username = 'ada'), 1::bigint, 'the public list counts only shared poems');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select results_eq($$select id from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'$$, $$values ('open')$$, 'visitor: the private poem stays hidden');

-- ---------- nobody writes in someone else's garden ----------
select throws_ok($$insert into public.poems (owner, id, title, content) values ('00000000-0000-0000-0000-0000000000a1', 'mine', 'Mine', 'x')$$, '42501', null, 'visitor cannot plant a poem in another garden');
update public.poems set title = 'Changed' where owner = '00000000-0000-0000-0000-0000000000a1';
delete from public.poems where owner = '00000000-0000-0000-0000-0000000000a1';
update public.gardens set name = 'Taken' where owner = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Taken' where id = '00000000-0000-0000-0000-0000000000a1';
select throws_ok($$insert into public.gardens (owner) values ('00000000-0000-0000-0000-0000000000c3')$$, '42501', null, 'nobody can create a garden for someone else');
reset role;
select is((select title from public.poems where id = 'open'), 'Open', 'visitor could not change another''s poem');
select is((select count(*) from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'), 2::bigint, 'visitor could not delete another''s poems');
select is((select name from public.gardens where owner = '00000000-0000-0000-0000-0000000000a1'), 'A quiet garden', 'visitor could not rename another''s garden');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Ada', 'visitor could not change another''s profile');

-- ---------- notes: only on readable poems, never on your own ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$insert into public.notes (garden_owner, poem_id, text) values ('00000000-0000-0000-0000-0000000000a1', 'open', 'This stayed with me.')$$, 'visitor leaves a note on a readable poem');
select throws_ok($$insert into public.notes (garden_owner, poem_id, text) values ('00000000-0000-0000-0000-0000000000a1', 'secret', 'peek')$$, '42501', null, 'no notes on a private poem');
select throws_ok($$insert into public.notes (garden_owner, poem_id, text, author) values ('00000000-0000-0000-0000-0000000000a1', 'open', 'as someone else', '00000000-0000-0000-0000-0000000000c3')$$, '42501', null, 'no notes in someone else''s name');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$insert into public.notes (garden_owner, poem_id, text) values ('00000000-0000-0000-0000-0000000000a1', 'open', 'to myself')$$, '42501', null, 'no notes on your own poem');
select pg_temp.as_anon();
select throws_ok($$insert into public.notes (garden_owner, poem_id, text) values ('00000000-0000-0000-0000-0000000000a1', 'open', 'anon')$$, '42501', null, 'anonymous visitors cannot leave notes');
select is((select count(*) from public.notes where poem_id = 'open'), 1::bigint, 'anonymous visitors can read notes on a public poem');

-- ---------- notes: rate limits ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into public.notes (garden_owner, poem_id, text) values ('00000000-0000-0000-0000-0000000000a1', 'open', 'second'), ('00000000-0000-0000-0000-0000000000a1', 'open', 'third');
select throws_like($$insert into public.notes (garden_owner, poem_id, text) values ('00000000-0000-0000-0000-0000000000a1', 'open', 'fourth')$$, '%a few notes on this poem%', 'at most 3 notes per poem per hour');

-- ---------- notes: the poet hides; others cannot change notes ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into public.notes (garden_owner, poem_id, text) values ('00000000-0000-0000-0000-0000000000a1', 'open', 'from Cy');
update public.notes set hidden = true where text = 'This stayed with me.';
select throws_ok($$update public.notes set text = 'rewritten' where text = 'from Cy'$$, '42501', null, 'an author cannot rewrite a note (only hidden can change)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$insert into public.note_reports (note_id, reason) select id, 'unkind' from public.notes where text = 'from Cy'$$, 'a visitor can report a note they can read');
select throws_ok($$insert into public.note_reports (note_id) select id from public.notes where text = 'second'$$, '42501', null, 'you cannot report your own note');
reset role;
select is((select hidden from public.notes where text = 'This stayed with me.'), false, 'a visitor cannot hide notes in someone else''s garden');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
update public.notes set hidden = true where text = 'second';
select throws_ok($$update public.notes set text = 'edited by the poet' where text = 'third'$$, '42501', null, 'the poet can hide but not edit a note');
select is((select count(*) from public.note_reports), 1::bigint, 'the poet sees reports on notes in their garden');
select pg_temp.as_anon();
select is((select count(*) from public.notes where text = 'second'), 0::bigint, 'hidden notes are hidden from visitors');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.notes where text = 'second'), 1::bigint, 'the author still sees their hidden note');

-- ---------- removing, restoring, and sync conflicts ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((select (save_poem('{"id":"open","title":"Open","content":"edited elsewhere"}'::jsonb, '2000-01-01'::timestamptz))->>'status'), 'conflict', 'saving over newer work reports a conflict');
select is((select (save_poem('{"id":"new","title":"  Fresh  ","content":"new"}'::jsonb, null))->>'status'), 'saved', 'a new poem saves');
select is((select title from public.poems where id = 'new'), 'Fresh', 'titles are trimmed');
select lives_ok($$select remove_poem('open')$$, 'the owner removes a poem');
select is((select (save_poem('{"id":"open","title":"Open","content":"back again"}'::jsonb, now()))->>'status'), 'deleted', 'a removed poem does not come back through a save');
select isnt((select deleted_at from public.poems where id = 'open'), null, 'the owner still sees it in recently removed');
select pg_temp.as_anon();
select is((select count(*) from public.poems where id = 'open'), 0::bigint, 'visitors do not see removed poems');
select is((select count(*) from public.notes where poem_id = 'open' and not hidden), 0::bigint, 'notes on a removed poem are hidden too');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((select (restore_poem('open')).id), 'open', 'the owner restores it within 30 days');

-- ---------- hearts: one each, on readable poems, never your own; counts for all, names for the poet ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$insert into public.poem_likes (garden_owner, poem_id, liker) values ('00000000-0000-0000-0000-0000000000a1', 'open', '00000000-0000-0000-0000-0000000000b2')$$, 'a visitor hearts a readable poem');
select throws_ok($$insert into public.poem_likes (garden_owner, poem_id, liker) values ('00000000-0000-0000-0000-0000000000a1', 'open', '00000000-0000-0000-0000-0000000000b2')$$, '23505', null, 'one heart per person per poem');
select throws_ok($$insert into public.poem_likes (garden_owner, poem_id, liker) values ('00000000-0000-0000-0000-0000000000a1', 'secret', '00000000-0000-0000-0000-0000000000b2')$$, '42501', null, 'no hearts on a private poem');
select throws_ok($$insert into public.poem_likes (garden_owner, poem_id, liker) values ('00000000-0000-0000-0000-0000000000a1', 'open', '00000000-0000-0000-0000-0000000000c3')$$, '42501', null, 'no hearts in someone else''s name');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into public.poem_likes (garden_owner, poem_id, liker) values ('00000000-0000-0000-0000-0000000000a1', 'open', '00000000-0000-0000-0000-0000000000c3');
select is((select likes from poem_likes_for('00000000-0000-0000-0000-0000000000a1') where poem_id = 'open'), 2, 'the count covers everyone''s hearts');
select is((select mine from poem_likes_for('00000000-0000-0000-0000-0000000000a1') where poem_id = 'open'), true, 'and says whether one is yours');
select is((select count(*) from public.poem_likes), 1::bigint, 'a visitor sees only their own hearts in the table');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$insert into public.poem_likes (garden_owner, poem_id, liker) values ('00000000-0000-0000-0000-0000000000a1', 'open', '00000000-0000-0000-0000-0000000000a1')$$, 'a poet may heart their own poem');
select lives_ok($$delete from public.poem_likes where garden_owner = auth.uid() and liker = auth.uid()$$, 'and take that heart back');
select is((select count(*) from public.poem_likes where garden_owner = auth.uid()), 2::bigint, 'the poet sees who hearted their poems');
select pg_temp.as_anon();
select is((select likes from poem_likes_for('00000000-0000-0000-0000-0000000000a1') where poem_id = 'open'), 2, 'anonymous visitors see the count');
select throws_ok($$select count(*) from public.poem_likes$$, '42501', null, 'but not who');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select lives_ok($$delete from public.poem_likes where poem_id = 'open'$$, 'take back your heart');
select is((select likes from poem_likes_for('00000000-0000-0000-0000-0000000000a1') where poem_id = 'open'), 1, 'and the count drops');

-- ---------- gardens suggested for you ----------
select is((select count(*) from suggested_gardens(3) where owner = '00000000-0000-0000-0000-0000000000a1'), 1::bigint, 'a public garden is suggested');
select isnt((select reason from suggested_gardens(3) where owner = '00000000-0000-0000-0000-0000000000a1'), null, 'with a reason');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from suggested_gardens(3) where owner = auth.uid()), 0::bigint, 'never your own garden');
reset role;
update public.gardens set is_public = false where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is((select count(*) from suggested_gardens(3) where owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'never a private garden');
reset role;
update public.gardens set is_public = true where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_anon();
select lives_ok($$select * from suggested_gardens(3)$$, 'anonymous visitors get suggestions too');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');

-- ---------- validation ----------
select throws_ok($$update public.gardens set settings = '{"links":[{"label":"x","url":"javascript:alert(1)"}]}' where owner = auth.uid()$$, '23514', null, 'links must be http(s)');
select throws_ok($$update public.gardens set settings = '{"season":"harmattan"}' where owner = auth.uid()$$, '23514', null, 'settings use known values');
select lives_ok($$update public.gardens set settings = '{"season":"monsoon","view":"sea","light":"sunset"}', theme = 'monsoon' where owner = auth.uid()$$, 'the monsoon, the sea horizon and a sunset save');
select throws_ok($$update public.gardens set settings = '{"season":"winter"}' where owner = auth.uid()$$, '23514', null, 'winter is no longer a season here');
select throws_ok($$update public.gardens set settings = '{"view":"the moon"}' where owner = auth.uid()$$, '23514', null, 'the horizon is fuji or sea');
select lives_ok($$update public.profiles set avatar = '{"outfit":"dress","hairStyle":"twintails","skin":"#f3cfb5"}' where id = auth.uid()$$, 'the chibi figure''s dress and twintails save');
select lives_ok($$update public.gardens set settings = '{"season":"autumn","links":[{"label":"site","url":"https://example.com"}],"show":{"swings":false}}' where owner = auth.uid()$$, 'valid settings save');
select throws_ok($$update public.profiles set avatar = '{"outfit":"spacesuit"}' where id = auth.uid()$$, '23514', null, 'the avatar uses known values');
select lives_ok($$update public.profiles set avatar = '{"kind":"boy","hairStyle":"messy","outfit":"jacket","extra":"scarf","accent":"#c62f2a"}' where id = auth.uid()$$, 'a boy in a jacket with messy hair saves');
select lives_ok($$update public.profiles set avatar = '{"kind":"cat","coat":"siamese"}' where id = auth.uid()$$, 'a siamese cat saves');
select lives_ok($$update public.profiles set avatar = '{"kind":"bird","plumage":"cream"}' where id = auth.uid()$$, 'a cream bird saves');
select lives_ok($$update public.profiles set avatar = '{"kind":"girl","extra":"bow"}' where id = auth.uid()$$, 'a pink bow saves');
select throws_ok($$update public.profiles set avatar = '{"kind":"dragon"}' where id = auth.uid()$$, '23514', null, 'the figure is a girl, a boy, a cat or a bird');
select throws_ok($$update public.profiles set avatar = '{"kind":"cat","coat":"plaid"}' where id = auth.uid()$$, '23514', null, 'cats come in known coats');
select lives_ok($$update public.profiles set avatar = '{"outfit":"kimono","skin":"#d9a77f","height":1.02}' where id = auth.uid()$$, 'a valid avatar saves');
select throws_ok($$insert into public.poems (owner, id, title, content, mood) values (auth.uid(), 'odd', 'Odd', 'x', 'furious')$$, '23514', null, 'moods are known values');

-- ---------- private links: a private garden opened for whoever holds the link ----------
reset role;
update public.gardens set is_public = false where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select create_share('For my sister')$$, 'the poet makes a private link');
select is((select count(*) from public.garden_shares), 1::bigint, 'the poet sees their own link');
select is((select char_length(token) from public.garden_shares limit 1), 24, 'a link is 24 random characters');
reset role;
create temp table t_share as select token from public.garden_shares where owner = '00000000-0000-0000-0000-0000000000a1';
grant select on t_share to anon, authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.garden_shares), 0::bigint, 'nobody else can list a poet''s links');
select throws_ok($$insert into public.garden_shares (owner) values ('00000000-0000-0000-0000-0000000000b2')$$, '42501', null, 'links are made only through create_share');
select pg_temp.as_anon();
select is(shared_garden('not-a-real-link-at-all00'), null, 'a made-up link opens nothing');
select is((select shared_garden(token)->>'name' from t_share), 'A quiet garden', 'the link opens the private garden''s sign');
select is((select jsonb_path_exists(shared_garden(token)->'poems', '$[*] ? (@.id == "secret")') from t_share), false, 'the link never shows a private poem');
select is((select count(*) from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'the link does not open the poems table itself');
reset role;
select is((select jsonb_array_length(shared_garden(token)->'poems') from t_share), (select count(*)::int from public.poems where owner = '00000000-0000-0000-0000-0000000000a1' and not private and deleted_at is null), 'and it shows every poem that is not private');
update public.garden_shares set opened = 0;
select pg_temp.as_anon();
select shared_garden(token) from t_share;
select shared_garden(token) from t_share;
select throws_ok($$select create_share('x')$$, '42501', null, 'anonymous visitors cannot make links');
reset role;
select is((select opened from public.garden_shares where owner = '00000000-0000-0000-0000-0000000000a1'), 2, 'each opening is counted');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
delete from public.garden_shares;
select pg_temp.as_anon();
select is((select shared_garden(token) from t_share), null, 'a withdrawn link opens nothing');

-- ---------- visitor counts: anonymous, public or shared gardens only, never your own walks ----------
reset role;
select pg_temp.as_anon();
select lives_ok($$select record_visit('00000000-0000-0000-0000-0000000000a1', 'browser-key-one')$$, 'a visit to a private garden without a link is ignored, quietly');
reset role;
select is((select count(*) from public.garden_visits where garden_owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'so nothing was counted');
update public.gardens set is_public = true where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_anon();
select record_visit('00000000-0000-0000-0000-0000000000a1', 'browser-key-one');
select record_visit('00000000-0000-0000-0000-0000000000a1', 'browser-key-one');
select record_visit('00000000-0000-0000-0000-0000000000a1', 'browser-key-two');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select record_visit('00000000-0000-0000-0000-0000000000a1', 'ignored-for-accounts');
select record_visit('00000000-0000-0000-0000-0000000000a1', 'another-key-same-person');
select is((select count(*) from public.garden_visits), 0::bigint, 'nobody reads the visit rows directly');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select record_visit('00000000-0000-0000-0000-0000000000a1', 'my-own-walk-key');
select results_eq($$select today, week, month, total, people from my_visits()$$, $$values (3::bigint, 3::bigint, 3::bigint, 3::bigint, 3::bigint)$$, 'the poet sees three visitors today: two browsers and one account, counted once each, and not their own walk');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select results_eq($$select total from my_visits()$$, $$values (0::bigint)$$, 'others see only their own garden''s visits');
select pg_temp.as_anon();
select throws_ok($$select * from my_visits()$$, '42501', null, 'anonymous visitors see no counts');

-- ---------- the waitlist ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$insert into public.waitlist (person, wish) values ('00000000-0000-0000-0000-0000000000b2', 'patron')$$, 'a person joins the patrons'' list');
select throws_ok($$insert into public.waitlist (person, wish) values ('00000000-0000-0000-0000-0000000000c3', 'book')$$, '42501', null, 'not in someone else''s name');
select throws_ok($$insert into public.waitlist (person, wish) values ('00000000-0000-0000-0000-0000000000b2', 'yacht')$$, '23514', null, 'only known wishes');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is((select count(*) from public.waitlist), 0::bigint, 'nobody sees another person''s wishes');
reset role;

-- ---------- the library: your books, and a public garden's shared books ----------
reset role;
update public.gardens set is_public = false where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$insert into public.books (id, title, author, body) values ('b1', 'My First Book', 'Ada', 'Once, in a garden…')$$, 'a poet writes a book');
select lives_ok($$insert into public.books (id, title, body, private) values ('b2', 'Diary', 'only mine', true)$$, 'and a private one');
select throws_ok($$insert into public.books (owner, id, title, body) values ('00000000-0000-0000-0000-0000000000b2', 'x', 'Forged', 'x')$$, '42501', null, 'not in someone else''s name');
select throws_ok($$insert into public.books (id, title, body) values ('b3', '   ', 'x')$$, '23514', null, 'a book needs a title');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.books where owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'a private garden''s books stay hidden');
reset role;
update public.gardens set is_public = true where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_anon();
select results_eq($$select id from public.books where owner = '00000000-0000-0000-0000-0000000000a1'$$, $$values ('b1')$$, 'a public garden shows its books, never a private one');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
update public.books set title = 'Taken' where owner = '00000000-0000-0000-0000-0000000000a1';
delete from public.books where owner = '00000000-0000-0000-0000-0000000000a1';
reset role;
select is((select title from public.books where id = 'b1'), 'My First Book', 'nobody else changes or removes a book');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$update public.books set body = 'Once, in a garden, a tree grew.' where id = 'b1'$$, 'the writer revises it');
select lives_ok($$delete from public.books where id = 'b2'$$, 'and takes one off the shelf');
reset role;

-- ---------- the Hall of Paintings: your paintings, and a public garden's shared ones ----------
reset role;
update public.gardens set is_public = false where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$insert into public.paintings (id, title, artist, path) values ('p1', 'Dawn', 'Ada', '00000000-0000-0000-0000-0000000000a1/p1.jpg')$$, 'a painter hangs a painting');
select lives_ok($$insert into public.paintings (id, title, path, private) values ('p2', 'Sketch', '00000000-0000-0000-0000-0000000000a1/p2.jpg', true)$$, 'and a private one');
select throws_ok($$insert into public.paintings (id, title, path) values ('p3', 'Elsewhere', 'someone/p3.jpg')$$, '23514', null, 'a picture lives only in its painter''s own folder');
select throws_ok($$insert into public.paintings (owner, id, title, path) values ('00000000-0000-0000-0000-0000000000b2', 'x', 'Forged', '00000000-0000-0000-0000-0000000000b2/x.jpg')$$, '42501', null, 'not in someone else''s name');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.paintings where owner = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'a private garden''s paintings stay hidden');
reset role;
update public.gardens set is_public = true where owner = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.as_anon();
select results_eq($$select id from public.paintings where owner = '00000000-0000-0000-0000-0000000000a1'$$, $$values ('p1')$$, 'a public garden shows its paintings, never a private one');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
delete from public.paintings where owner = '00000000-0000-0000-0000-0000000000a1';
reset role;
select is((select count(*) from public.paintings where owner = '00000000-0000-0000-0000-0000000000a1'), 2::bigint, 'nobody else takes them down');
select ok(exists (select 1 from storage.buckets where id = 'paintings' and not public), 'the pictures are kept in a private bucket');
-- ---------- since you were last here: only your own garden's news, only for you ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select ok((select (whats_new('-infinity')->'hearts'->0->>'poem_id') = 'open'), 'a poet sees hearts on their poems');
select ok((select (whats_new('-infinity')->'hearts'->0->'names'->>0) = 'Bo'), 'and who gave them');
select is((select jsonb_typeof(whats_new('-infinity')->'notes')), 'array', 'and the notes left');
select is((select jsonb_array_length(whats_new(now() + interval '1 day')->'hearts')), 0, 'nothing is new since the future');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select jsonb_array_length(whats_new('-infinity')->'hearts')), 0, 'one poet never sees another''s news');
select pg_temp.as_anon();
select throws_ok($$select whats_new(now())$$, '42501', null, 'visitors without an account have no news to see');
-- the accounts tests below run as Ada, as the library's block left them
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');

-- ---------- accounts ----------
select is(username_available('bob'), false, 'a taken username is not available');
select is(username_available('ada_two'), true, 'a free username is available');
select throws_like($$select change_username('bob')$$, '%taken%', 'cannot take someone else''s username');
select is(change_username('ada_two'), 'ada_two', 'change your own username');
select pg_temp.as_anon();
select throws_ok($$select delete_my_account()$$, '42501', null, 'anonymous visitors cannot delete accounts');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$select delete_my_account()$$, 'a person deletes their own account');
reset role;
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 0::bigint, 'their profile is gone');
select is((select count(*) from public.notes where author = '00000000-0000-0000-0000-0000000000b2'), 0::bigint, 'and their notes with it');
select is((select count(*) from public.poems where owner = '00000000-0000-0000-0000-0000000000a1'), 3::bigint, 'other people''s gardens are untouched');

select * from finish();
rollback;
