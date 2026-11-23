# JAXPORT Trade Show Participation Scorecard

A named, multi-user evaluation app for deciding whether JAXPORT should **Exhibit + Sales**, send **Sales Only**, or **Skip** a trade show, and for checking the whole show schedule against the budget and staff time. Built for Vercel and Supabase.

## What is included

**Assessing shows**
- Weighted 100-point **Event Opportunity** and **Exhibit Value** scores. Each criterion is rated 1–5 or **Unknown**; Unknown is left out of the score, and each score shows how much of its weight was rated ("% rated").
- Draft saving and final submission. The team comparison unlocks only after an evaluator submits their own assessment (administrators can always see it).
- Named scores, recommendation counts, score spread and criterion-level differences.
- **AI drafts:** a first-pass assessment per show, visible to everyone, that doesn't count toward team results.
- **Baseline report:** compares the AI's recommendations with what JAXPORT actually did at past shows.
- **How scoring works** page, built from the live criteria and weights.

**Results**
- Pre-show **goals** (meetings and contacts) and post-show results, shown as goal vs. actual.
- Cost per contact, booth capacity used, **soft-dollar ROI** (against an average field sales call) and **hard-dollar ROI** (against the potential revenue value of leads).

**Dashboard**
- Card and sortable **table** views, search, filters (kept in the page address so a view can be bookmarked), a column picker, cost totals and a **CSV download** of the filtered list.

**Budget and capacity**
- A cost estimate for each show from regional travel rates and priced items (registration, exhibit space, sponsorship, shipping), each with its source.
- **Budget & capacity** page for each fiscal year (October–September): planned cost by budget line against the show allocation, staff show days, exhibit-staff load, date conflicts, and three scenarios (current plan, AI recommendations, your recommendations). When a scenario doesn't fit, it suggests the changes that give up the least value per dollar.
- A budget impact note on each show's page.

**Administration**
- Administrator-managed accounts with invitation emails and first-time password setup.
- Event creation, an **Edit show details** form (tier, region, exhibit type, staffing, prices and sources), and budget settings (allocation, staff limits, rates).
- Row-level database security plus server-side checks.

## 0. Run fully locally (no hosted project needed)

Requires Docker. The Supabase CLI is a dev dependency, and `supabase/config.toml` is already set up for `http://localhost:3000` (invite template, unused services disabled).

```bash
npm install
npx supabase start -x vector,imgproxy,supavisor   # first run downloads several GB of images
cp .env.example .env.local
# fill in the API URL, anon key and service role key that `supabase start` prints
scripts/create-local-admin.sh you@example.com "Your Name"   # prints a temporary password
npm run dev
```

- App: http://localhost:3000 · Supabase Studio: http://127.0.0.1:54323 · Local email inbox (invitations): http://127.0.0.1:54324
- Stop with `npx supabase stop` (data is kept); `npx supabase stop --no-backup` wipes it.
- The database schema lives in `supabase/migrations/` (six files, applied in order). `npx supabase start` applies them; after pulling new ones, run `npx supabase migration up`.
- To stand up the hosted project later: `npx supabase link --project-ref <ref>` then `npx supabase db push`, and swap the `.env.local` / Vercel values for the hosted ones.

## 1. Create Supabase project

1. Create a new Supabase project.
2. Run `npx supabase link --project-ref <ref>` and `npx supabase db push`. This applies **every** migration in `supabase/migrations/`, in order. (If you use the SQL Editor instead, run each file in filename order; running only the first leaves the app incomplete.)
3. In **Authentication → URL Configuration**, set the Site URL to your Vercel production URL and add `http://localhost:3000/**` as a development redirect URL.
4. In **Authentication → Email Templates → Invite user**, set the invitation link to:

   ```html
   <a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password">Accept invitation</a>
   ```

5. In **Authentication → Users**, create your first user.
6. Copy that user's UUID and run the commented `update public.profiles...` statement at the end of `supabase/migrations/20261119000000_initial_schema.sql` to make that user an administrator.

The administrator can then invite all other evaluators from the app.

**After setup:** the budget settings start with a $0 allocation. An administrator enters the show allocation for each budget line, and checks the staff limits and rates, on the **Budget** page.

## 2. Configure locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Populate `.env.local` from **Supabase → Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # used for invitation links

# Optional: only for the show research script (scripts/web-search.mjs)
BRAVE_API_KEY=...
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or the search key in client code or prefix them with `NEXT_PUBLIC_`.

## 3. Deploy to Vercel

1. Push this folder to a Git repository and import it into Vercel.
2. Add the four required environment variables above in **Vercel → Project Settings → Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to the final `https://...vercel.app` or custom-domain URL. (The search key isn't needed on Vercel.)
3. Deploy.
4. Return to Supabase Authentication URL Configuration and add the production URL.

## Data scripts

These run from the project folder against the database in `.env.local`. They read private files from `data/` and `docs/`, which aren't in the repository (see below).

| Command | What it does |
|---|---|
| `npm run import:events -- <workbook.xlsx> [--dry-run]` | Imports or updates events from the master events workbook, keyed on its Event ID. Needs `data/config/event-import-config.json`; copy `scripts/event-import-config.example.json` to start one. |
| `npm run ai:drafts [-- <source_id> ...]` | Loads AI draft assessments from `data/ai-drafts/<source_id>.json` as the AI evaluator's drafts. |
| `npm run adopt:ai -- <changes.json>` | Starts a person's own assessment from the AI draft, with their changes, saved as a draft under their name for them to review and submit (see the script header for the file format). |
| `npm run costs:load [-- --dry-run]` | Loads show prices and cost inputs, then recalculates each show's stored estimate. Fills only empty fields, so edits made in the app are kept. |
| `node scripts/web-search.mjs "<query>"` | Web search used for show research. Needs `BRAVE_API_KEY`; rate-limited and logged to `data/ai-research/`. |

## Private data (not in this repository)

`data/` and `docs/` are listed in `.gitignore`. They hold internal material: source documents, research, AI drafts, budget settings and the event import configuration. The app runs without them, but the data scripts above need them. Keep your own backups of both folders and of the database (for example `npx supabase db dump --local --data-only -f <file>`).

## Tests

```bash
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run typecheck
npm run build
```

The unit/component suite covers weighted scores and coverage, comparison calculations, submission-based privacy, seeded database safeguards, form controls, named results, the dashboard's filters, sorting and CSV export, post-show metrics, cost estimates, budget roll-ups, staff conflicts, "what fits" suggestions and the site navigation. Playwright covers desktop/mobile rendering, responsive overflow, interaction, accessibility and screenshot generation. The `/test-preview` fixture returns 404 unless `VISUAL_TEST_MODE=true`.

## Scoring

Each criterion is rated from 1 (Very weak) to 5 (Exceptional), or Unknown. Unknown criteria are left out of the score rather than counted as zero: the score is the weighted ratings divided by the most the rated criteria could earn, scaled to 0–100. When less than half of a section's weight is rated, the score is shown as "Insufficient data." Criteria and weights are seeded and updated by the migrations in `supabase/migrations/` and can be edited directly in Supabase. Each section's weights should total 100. The app's **How scoring works** page explains the full method.

The final participation decision remains a recommendation rather than an automatic score threshold. This preserves the important distinction between an attractive event and an event where a booth adds enough incremental value.

## Suggested next enhancements

- Editing an event's name, dates and location in the app (today they come from the events workbook), and archiving events
- Email reminders for incomplete evaluations
- A team-recommendations budget scenario for administrators
