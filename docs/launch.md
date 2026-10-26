# Getting ready for real visitors

Five things that need your accounts. Each says where to click and what to paste. The app is already
built for all of them: nothing else needs a code change.

**Your project:** `ofzxijjlfbiojbsubozu` · **Site:** https://pranalishinde28.github.io/garden-of-poems/
**Sign-in callback (for Google and GitHub):** `https://ofzxijjlfbiojbsubozu.supabase.co/auth/v1/callback`

## 1. Update the live database (about 5 minutes)

Hearts, the cat and bird, the monsoon and sunset, recently removed poems, hiding notes and deleting an
account all need this. Nothing in the garden is lost.

1. Back up first: Supabase dashboard → Database → Backups (free plans keep a daily one).
2. In a terminal in the project folder:
   ```
   npx supabase login
   npx supabase link --project-ref ofzxijjlfbiojbsubozu
   npx supabase migration repair --status applied 20261011000000
   npx supabase db push
   ```
   `link` asks for your database password (Dashboard → Project Settings → Database). `db push` lists the
   eight migrations it will add and asks you to confirm.
3. Sign out and back in on the site. The page notices the update by itself; no redeploy is needed.

## 2. A real email sender (SMTP)

Supabase's own sender manages only a few emails an hour, so sign-up and password-reset emails stall.

- **No domain of your own: Brevo** (free, 300 emails a day). Sign up at brevo.com, verify your sender
  address, then Settings → SMTP & API → generate an SMTP key.
  Host `smtp-relay.brevo.com`, port `587`, user = your Brevo SMTP login, password = the SMTP key.
- **With a domain: Resend** (free, 3,000 a month). Add and verify your domain, create an API key.
  Host `smtp.resend.com`, port `465`, user `resend`, password = the API key. (Without a verified domain,
  Resend only sends to your own address.)

Then Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP, paste the values, sender
name "The Garden of Poems", and a sender address on that service. Send yourself a password reset to test.

## 3. A CAPTCHA on sign-in and sign-up (hCaptcha)

1. Sign up at hcaptcha.com, add a site with the hostname `pranalishinde28.github.io`.
2. Copy the **site key** (public) and your account's **secret key**.
3. Supabase → Authentication → Attack Protection → enable CAPTCHA, provider hCaptcha, paste the secret.
4. GitHub repo → Settings → Secrets and variables → Actions → **Variables** → New:
   `VITE_HCAPTCHA_SITEKEY` = the site key. Then re-run the deploy (or push anything).
   Do 3 and 4 together: with only one of them, sign-in fails.
   (For local work, put the same line in `.env`.)

## 4. Sign in with Google

1. console.cloud.google.com → create a project → APIs & Services → OAuth consent screen (External; app
   name "The Garden of Poems"; your email) → Credentials → Create credentials → OAuth client ID → Web.
2. Authorised redirect URI: the callback above. Copy the client ID and secret.
3. Supabase → Authentication → Sign In / Providers → Google → enable, paste both, save.

## 5. Sign in with GitHub

1. github.com → Settings → Developer settings → OAuth Apps → New OAuth App.
   Homepage `https://pranalishinde28.github.io/garden-of-poems/`, callback = the callback above.
2. Generate a client secret; copy the client ID and secret.
3. Supabase → Authentication → Sign In / Providers → GitHub → enable, paste both, save.

Also check Authentication → URL Configuration: Site URL is the site above, and it is listed under
Redirect URLs (it already is).

## Slower devices

Auto quality now keeps watching while you walk: two slow stretches (under about 30 frames a second), or
one very slow one, step it down a level, and phones, tablets and computers with few cores or little
memory start at Medium. Tested with the CPU slowed six times on a 1280×720 screen (`--flow lowend`):
High ran at about 10 fps; Auto settled on Low near 30. A real low-end graphics chip can't be simulated
here; the same frame-time check covers it, but try the site on an older phone if you have one.
