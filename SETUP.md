# LJ Web: Backend Setup Guide

This folder is the whole thing: the static site (goes to GitHub Pages) and
the backend source (goes to Supabase) live together so you only have one
folder to manage.

**As of now, nothing on the live site uses this backend at all.**
Contact Us is a Typeform embed, appointment booking is a Calendly embed
(both handled entirely on those services' own infrastructure), and the
`/admin` dashboard that used to read the Supabase tables has been
removed. Everything below is archival: kept in place in case a custom-
built form comes back for the new industry/role automation catalog, or
you want to bring Contact Us, booking, or an admin view back in-house
later. If none of that is on your roadmap, you can ignore this guide
(and the `supabase/` folder) entirely, nothing currently depends on it.

**Stack:** Supabase (Postgres database + the small server-side functions
that receive form submissions) and Resend (sends the email
notifications). Both have free tiers with no credit card required.
Nothing here uses AI, every function is plain, deterministic code: take
the submitted fields, save a row, send an email.

You'll do the account-creation and key-copying steps yourself (I can't sign
up for services on your behalf), everything else is already written. This
should take about 20–30 minutes end to end.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is
   the fastest option since your site is already on GitHub).
2. Click **New Project**. Pick any name (e.g. `lj-web`), a strong database
   password (save it somewhere, you likely won't need it again, but keep
   it), and the region closest to you or your customers.
3. Wait ~2 minutes for it to provision.

## 2. Create the database tables

1. In your new project, open **SQL Editor** (left sidebar) → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this folder,
   copy the whole file, paste it into the SQL editor, and click **Run**.
3. You should see three new tables under **Table Editor**:
   `contact_submissions`, `product_leads`, `appointments`.

This also turns on Row Level Security so that only a signed-in Supabase
user can read the data, and nobody can write to the tables directly;
writes only happen through the server-side functions in step 5. With no
`/admin` page in this repo anymore, the simplest way to look at the data
is Supabase's own **Table Editor** (you're signed in as the project
owner there already, no extra login needed).

## 3. (Optional) Create a login for a custom admin view

Skip this unless you rebuild an `/admin`-style page that needs its own
sign-in separate from the Supabase project owner login above.

1. Go to **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a password. Check **Auto Confirm User** (so you
   don't need to click an email link) and click **Create user**.
3. That's it, this account can now read all three tables through Row
   Level Security. Create additional users the same way if more than one
   person needs access.

## 4. Get a Resend API key (for email notifications)

1. Go to [resend.com](https://resend.com) and sign up (free tier: 3,000
   emails/month, 100/day, plenty for form notifications).
2. Go to **API Keys** → **Create API Key**. Give it any name, full access
   is fine. Copy the key (starts with `re_`), you won't be able to see it
   again.
3. You do **not** need to verify ljwebmanagement.com's DNS for this to
   work, Resend's shared sending domain (`onboarding@resend.dev`) can
   send *to* your inbox immediately. If you want the notification emails
   to look like they came from your own domain later, you can verify it
   in Resend's dashboard and update `FROM_EMAIL` in step 5, optional, not
   required to get this working today.

## 5. Deploy the server-side functions

These are the four small functions in `supabase/functions/`:
`submit-contact`, `submit-product-lead`, `submit-appointment`, and
`get-availability`. None of them call any AI, each one just validates
the input, writes a row, and (for submissions) sends an email via Resend.
(None are currently called by any live page, see the note at the top of
this doc.)

1. Install the Supabase CLI (pick one):
   ```bash
   npm install -g supabase
   # or on macOS: brew install supabase/tap/supabase
   ```
2. From inside this folder, log in and link it to your project:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```
   Your project ref is in the Supabase dashboard URL:
   `supabase.com/dashboard/project/YOUR-PROJECT-REF`.
3. Set the secrets the functions need (get `SERVICE_ROLE_KEY` from
   **Project Settings → API → service_role key**, keep this one private,
   it bypasses Row Level Security):
   ```bash
   supabase secrets set \
     SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY \
     RESEND_API_KEY=re_your_resend_key \
     NOTIFY_EMAIL=info@ljwebmanagement.com
   ```
4. Deploy all four functions. `--no-verify-jwt` is needed because these
   are public forms, anonymous visitors call them without a Supabase
   login (spam is instead handled by the honeypot field + server-side
   validation already built into each function):
   ```bash
   supabase functions deploy submit-contact --no-verify-jwt
   supabase functions deploy submit-product-lead --no-verify-jwt
   supabase functions deploy submit-appointment --no-verify-jwt
   supabase functions deploy get-availability --no-verify-jwt
   ```
5. Your functions are now live at:
   `https://YOUR-PROJECT-REF.functions.supabase.co/submit-contact` (etc).

## 6. Plug your project's keys into the site

There's nothing to edit here right now, the `/admin` page that used to
need `SUPABASE_URL` and `SUPABASE_ANON_KEY` has been removed. Your
**Project URL** and **anon public key** are on **Project Settings → API**
in the Supabase dashboard whenever you need them for something new.

(If you bring back a custom-built form that posts to one of the functions
above, it'll need a `SUPABASE_FUNCTIONS_BASE` constant pointed at
`https://YOUR-PROJECT-REF.functions.supabase.co`, see
`supabase/functions/` for the shape each one expects.)

The anon key is safe to have visible in the page source, it can only do
what your Row Level Security policies allow (read nothing unless signed
in), so this isn't a secret the way the service-role key is.

## 7. Push to GitHub and turn on Pages

From inside this folder:

```bash
git init
git add .
git commit -m "Initial site with working forms"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source → Deploy from a
branch → `main` / `/ (root)`**. If you're using a custom domain
(ljwebmanagement.com), add it in the same Pages settings screen and follow
GitHub's DNS instructions.

The `supabase/` folder and this `SETUP.md` travel with the rest of the
site in the same repo for convenience, GitHub Pages only serves files it
recognizes as a website (HTML/CSS/JS/images), so `.ts` function source and
this doc don't turn into public pages, they just sit in the repo. They
*are* visible if your repo is public, though (source code, not secrets;
your actual keys live in Supabase's secret store from step 5, never in
this repo). If you'd rather keep the backend source private, put this
whole folder in a private GitHub repo, or move `supabase/` out into its
own separate private repo before pushing, either works, nothing else in
this guide changes.

## 8. Test it

1. Visit `/contactus` and confirm the Typeform embed loads and accepts a
   submission, that flow lives entirely on Typeform's side, so there's
   nothing to check in Supabase for it.
2. Visit `/appointment` and confirm the Calendly embed loads and lets you
   pick a slot, same as Contact Us, this is entirely on Calendly's side
   now (availability, confirmation email, timezone handling, double-
   booking prevention), nothing to check in Supabase.
3. The old `/pre-made-automations/<page>` product pages have been removed
   (the catalog is being rebuilt by industry/role), if a custom
   Supabase-backed lead form comes back for those, this is the point
   where you'd test it: submit it and confirm a row appears in
   `product_leads` and an email arrives at info@ljwebmanagement.com.
4. There's no `/admin` page to check anymore, if you want to look at
   `contact_submissions`, `product_leads`, or `appointments` directly
   (all empty right now, since nothing feeds them), use Supabase's own
   Table Editor instead.

---

## What changed from the old site

- **Contact Us** and the **24 product pages** originally had forms that
  posted to Odoo's `/website/form/` endpoint, which doesn't exist once
  you're on GitHub Pages, those were rebuilt to post to Supabase
  functions instead (`submit-contact`, `submit-product-lead`). Contact Us
  has since moved again, to a Typeform embed, so `submit-contact` is no
  longer called by any live page; the product pages were removed pending
  a rebuild by industry/role.
- **The old `/appointment` pages** (Odoo's native booking flow, with cards
  like "Initial Consultation" linking to `/appointment/quick-chat-4` and
  similar) pointed at a backend that was already gone, that whole flow
  was first replaced by a custom Supabase-backed booking widget, then
  replaced again by a Calendly embed, both at the same `/appointment`
  URL, so any existing links to it (the "Book a Consultation" buttons
  across the site) keep working unchanged.
- The Pricing page's "Book a Consultation" button also had a typo
  (`/appointments`, plural, a dead link even on the original site) fixed
  to point at the real `/appointment` page.
- **Google Analytics/Tag Manager** tracking (`gtag.js`, ID `G-R423J2Q3EK`)
  and the **`/admin`** dashboard have both been removed. With Contact Us,
  booking, and the old product-lead forms all off the Supabase backend
  already, `/admin` had nothing left to display.

## Notes on what's *not* included

- **Rate limiting / spam** on the dormant Supabase functions is handled
  with a honeypot field (invisible to real visitors, silently rejects
  bots that fill it) plus server-side validation, but there's no CAPTCHA
  or IP throttling. Not relevant right now since nothing calls them, but
  worth knowing if you revive one of these flows.
