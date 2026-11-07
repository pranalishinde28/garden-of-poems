# Email: a real sender, and the weekly letter

Two things use email:

1. **Supabase Auth** sends sign-up confirmations and password resets. Its built-in sender manages only a few an
   hour, so it needs a real mail service (custom SMTP).
2. **The weekly letter** (`supabase/functions/weekly-digest`) writes once a week to each poet who has news: hearts,
   notes, visitors, new tenders, new poems in gardens they tend. Nothing new, no letter. A daily job runs it, and each
   poet hears at most once in six days.

Both use **Brevo** here: free, 300 emails a day, and no domain needed (you verify one sender address).

> **About sending from a Gmail address:** mail sent through Brevo "from" @gmail.com is allowed, but some inboxes
> file it under Promotions or Spam, because it isn't sent by Google. That's fine to start. The real fix is your own
> domain (for example gardenofpoems.com, about $10 a year). With a domain, verify it in Brevo (or switch to Resend,
> see the end), send from `letters@yourdomain`, and almost everything reaches the inbox.

Keep every key below out of the repository and out of `.env`. They only go into the Supabase dashboard or `supabase secrets`.

---

## A. Brevo (about 10 minutes)

1. Go to **brevo.com**, choose **Sign up free**, and create the account. It asks for a name, a company and an
   address: your own details are fine ("The Garden of Poems" as the company).
2. **Verify the sender address.** In the top-right menu, open **Senders, Domains & Dedicated IPs → Senders → Add a sender**.
   - From name: `The Garden of Poems`
   - From email: the Gmail address you want letters to come from
   - Brevo emails that address a code or link. Confirm it.
3. **SMTP key** (for Supabase Auth). Open **SMTP & API → SMTP**.
   - Note the **Login**, which looks like `8a1b2c001@smtp-brevo.com`.
   - Choose **Generate a new SMTP key**, name it `supabase-auth`, and copy it.
4. **API key** (for the weekly letter). Open **SMTP & API → API Keys → Generate a new API key**, name it
   `garden-letters`, and copy it (it starts with `xkeysib-`). This is a different key from the SMTP key.

If Brevo later says the account needs activating for transactional email, fill in any missing profile details. If
that isn't enough, its support chat activates it.

## B. Supabase Auth through Brevo (dashboard, 3 minutes)

1. **supabase.com → your project → Authentication → Emails → SMTP Settings → Enable custom SMTP.**
   - Sender email: the address you verified in A2
   - Sender name: `The Garden of Poems`
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Username: the **Login** from A3
   - Password: the **SMTP key** from A3
   - Minimum interval between emails: leave it as it is
   - Save.
2. **Authentication → Rate Limits → "Rate limit for sending emails"**: set it to **30 per hour**. It was capped at
   2 with the built-in sender.
3. **Test it:** on the live site, choose Sign in, then "Forgot your password?", and enter your own address. The email
   should arrive within a minute. Check Spam once, and mark it "Not spam" if it landed there.
4. *Optional:* email confirmation is currently **off**, so people are signed in at once. With real email working you
   can turn it on: **Authentication → Sign In / Providers → Email → Confirm email**. That way nobody can sign up with
   someone else's address, but it adds a step for every new poet. Your choice.

## C. The database update

The weekly letter needs its migration, along with the earlier ones still waiting. In the project folder:

```
npx supabase db push --linked
```

## D. The weekly letter's function (terminal, in the project folder, 5 minutes)

1. Make a secret that only the daily job will know, and keep it somewhere safe (you need it in D2 and E):
   ```
   openssl rand -hex 24
   ```
2. Give the function its settings. Replace the three values; the quotes matter:
   ```
   npx supabase secrets set DIGEST_SECRET=<the secret from D1> BREVO_API_KEY=<the API key from A4> MAIL_FROM="The Garden of Poems <your verified address>"
   ```
3. Deploy it:
   ```
   npx supabase functions deploy weekly-digest --no-verify-jwt
   ```
   (`--no-verify-jwt` is needed because the function checks its own secret instead of a signed-in user.)
4. **See your own letter without sending anything.** `<project-ref>` is the part of your Supabase URL before `.supabase.co`:
   ```
   curl -X POST "https://<project-ref>.supabase.co/functions/v1/weekly-digest?dry=1&only=<your email>" -H "Authorization: Bearer <the secret from D1>"
   ```
   It answers with the letter's subject and text. If it says `"quiet":1`, nothing happened in your garden in the last
   week, so no letter would be sent.
5. **Send it to yourself for real:** the same command without `dry=1&`. The answer should say `"sent":1`.

## E. Run it every day (Supabase dashboard → SQL Editor, 1 minute)

Paste this, replacing `<project-ref>` and `<the secret from D1>`, and run it:

```sql
select cron.schedule('weekly-letters', '0 9 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object('Authorization', 'Bearer <the secret from D1>'),
    timeout_milliseconds := 120000)
$$);
```

It runs at 09:00 UTC (14:30 in India) every day. Each poet gets at most one letter in six days, so a daily run spreads
the sending out and stays under Brevo's 300 a day (`MAX_SENDS`, default 250 a run).

- **Did it run?** `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`
- **What did the function say?** `select status_code, content from net._http_response order by created desc limit 5;`
- **Stop it:** `select cron.unschedule('weekly-letters');`

## How people stop the letters

- Every letter ends with **Stop these letters**. It opens the site with `?unsubscribe=<token>`, which stops them at
  once without signing in, and the letter carries a `List-Unsubscribe` header, so mail apps offer their own button too.
- Signed in, it's a checkbox in **Gardens → Your account**.

## Later: with your own domain

- Add the domain in **Brevo → Senders, Domains & Dedicated IPs → Domains**. Put the records it shows at your domain
  registrar, then use `letters@yourdomain` as the sender in B1 and in `MAIL_FROM`.
- Or use **Resend** (3,000 a month free). Verify the domain there, then:
  - SMTP host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key.
  - `npx supabase secrets set RESEND_API_KEY=<key>` and `npx supabase secrets unset BREVO_API_KEY`. The function
    uses whichever key is set, with Brevo first.

## Local testing

Local Supabase catches every email in Mailpit (http://127.0.0.1:55324), so nothing leaves your machine.

```
printf 'DIGEST_SECRET=local-digest-secret\nMAILPIT_URL=http://supabase_inbucket_garden-of-poems:8025\nSITE_URL=http://localhost:8081/\n' > /tmp/digest.env
npx supabase functions serve --env-file /tmp/digest.env --no-verify-jwt
curl -X POST "http://127.0.0.1:55321/functions/v1/weekly-digest?only=mira@grove.test" -H "Authorization: Bearer local-digest-secret"
```

`node dev/screenshot.mjs --flow digest --url http://localhost:8081/` checks the switch, sends a letter to Mailpit,
follows its stop link and confirms the letters stopped.
