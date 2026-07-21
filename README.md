# LJ Web — MrPress Automation Site

Static site for MrPress Automation, built to host on **GitHub Pages** with
a **Supabase** backend for form submissions and appointment booking.

- **Deploy the site:** push this whole folder to a GitHub repo and turn on
  Pages (Settings → Pages → Deploy from a branch → `main` / root).
- **Set up the backend:** see [`SETUP.md`](SETUP.md) — creating your free
  Supabase + Resend accounts, running the database schema, deploying the
  server-side functions, and dropping your project keys into the site.
  Forms won't actually submit anywhere until you do this.

## What's in here

| Path | What it is |
|---|---|
| `index.html`, `how-it-works/`, `automations/`, `contactus/`, etc. | The site pages |
| `appointment/` | The appointment booking widget (name, phone, email, date/time — 8am–5pm Central, weekdays only) |
| `admin/` | Password-protected dashboard to view Contact Us, product page leads, and appointment submissions |
| `assets/lj-forms.js` | Shared script that wires up the Contact Us and product-page forms |
| `supabase/` | Backend source: database schema (`schema.sql`) and the four server-side functions that receive form submissions and send email notifications |
| `SETUP.md` | Step-by-step backend setup guide |

## Local preview

No build step — it's plain HTML/CSS/JS. Serve it with anything static, e.g.:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Forms will show a network error until
you've completed `SETUP.md` and filled in your Supabase project keys.
