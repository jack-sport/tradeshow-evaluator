# JAXPORT Trade Show Participation Scorecard

A named, multi-user evaluation app for deciding whether JAXPORT should **Exhibit + Sales**, send **Sales Only**, or **Skip** a trade show. Built for Vercel and Supabase.

## What is included

- Administrator-managed accounts and invitation emails
- Secure invitation callback and first-time password setup
- Event records with dates, tier, high-value targets and fully loaded cost estimates
- Weighted 100-point Event Opportunity score
- Separate weighted 100-point Exhibit Value score
- Draft saving and final submission
- Team comparison unlocked only after an evaluator submits their own assessment
- Named scores, recommendation counts, overall score spread and criterion-level differences
- Administrator event and user setup screens
- Row-level database security plus server-side checks

## 0. Run fully locally (no hosted project needed)

Requires Docker. The Supabase CLI is a dev dependency, and `supabase/config.toml` is already set up for `http://localhost:3000` (invite template, unused services disabled).

```bash
npm install
npx supabase start -x vector,imgproxy,supavisor   # first run downloads several GB of images
# copy the API URL, anon key and service role key it prints into .env.local
scripts/create-local-admin.sh you@example.com "Your Name"   # prints a temporary password
npm run dev
```

- App: http://localhost:3000 · Supabase Studio: http://127.0.0.1:54323 · Local email inbox (invitations): http://127.0.0.1:54324
- Stop with `npx supabase stop` (data is kept); `npx supabase stop --no-backup` wipes it.
- The database schema lives in `supabase/migrations/`. To stand up the hosted project later: `npx supabase link --project-ref <ref>` then `npx supabase db push`, and swap the `.env.local` / Vercel values for the hosted ones.

## 1. Create Supabase project

1. Create a new Supabase project.
2. Run `npx supabase link --project-ref <ref>` and `npx supabase db push` (or paste `supabase/migrations/20261119000000_initial_schema.sql` into the **SQL Editor** and run it once).
3. In **Authentication → URL Configuration**, set the Site URL to your Vercel production URL and add `http://localhost:3000/**` as a development redirect URL.
4. In **Authentication → Email Templates → Invite user**, set the invitation link to:

   ```html
   <a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password">Accept invitation</a>
   ```

5. In **Authentication → Users**, create your first user.
6. Copy that user's UUID and run the final commented `update public.profiles...` statement at the end of the migration file to make the first user an administrator.

The administrator can then invite all other evaluators from the app.

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
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code or prefix it with `NEXT_PUBLIC_`.

## 3. Deploy to Vercel

1. Push this folder to a Git repository and import it into Vercel.
2. Add the four environment variables above in **Vercel → Project Settings → Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to the final `https://...vercel.app` or custom-domain URL.
3. Deploy.
4. Return to Supabase Authentication URL Configuration and add the production URL.

## Tests

```bash
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run typecheck
npm run build
```

The unit/component suite covers weighted scores, comparison calculations, submission-based privacy, seeded database safeguards, form controls and named results. Playwright covers desktop/mobile rendering, responsive overflow, interaction, accessibility and screenshot generation. The `/test-preview` fixture returns 404 unless `VISUAL_TEST_MODE=true`.

## Scoring

Each criterion is rated from 1 (Very weak) to 5 (Exceptional). The app normalizes weighted ratings to a 0–100 score. Criteria and weights are seeded in `supabase/migrations/20261119000000_initial_schema.sql` and can be edited directly in Supabase. Each section's weights should total 100.

The final participation decision remains a recommendation rather than an automatic score threshold. This preserves the important distinction between an attractive event and an event where a booth adds enough incremental value.

## Suggested next enhancements

- CSV export for annual planning meetings
- Administrator editing and archiving of existing events
- Historical actuals: meetings, qualified leads, opportunities and cargo wins
- Portfolio capacity warnings (two major exhibits, one to four regional exhibits)
- Email reminders for incomplete evaluations
