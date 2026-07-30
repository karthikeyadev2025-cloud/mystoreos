# Database Backups — Verification Runbook

For a live product with paying customers, "backups exist" isn't
enough. You need to know: (a) they're running, (b) they cover the
right window, (c) they actually restore. This runbook walks through
verifying all three on your current Supabase setup.

## What Supabase gives you

Supabase Pro (which you need for anything past a hobby project) ships
Point-in-Time Recovery (PITR) as an add-on. Free tier gives you daily
snapshots only.

Pricing at the time of writing: PITR is $100/mo. If MyStoreOS is
handling real money at any scale, this is not optional — a single
schema-corrupting migration mistake without PITR means all-day-yesterday
data is gone.

## Verification checklist

### 1. Confirm PITR is enabled

Log into the Supabase dashboard → your project → Settings → Database →
Point in Time Recovery. Should show "Enabled" with a retention window
(default 7 days on the base add-on tier).

If it's not enabled: enable it now. It takes about 30 minutes to
provision and won't be usable for restore until the first full
snapshot completes.

### 2. Confirm the retention window matches your risk tolerance

Default PITR retention on the base add-on is 7 days. If your worst-case
"we didn't notice for a while" window is longer than that (e.g. you
review payment discrepancies weekly), bump the retention. Extended
retention is a paid add-on.

For MyStoreOS at your current scale, 7 days is probably fine. If you
process >₹1L/day in Razorpay volume, consider 14+.

### 3. Test restore ANNUALLY (or before your next big change)

A backup you've never restored isn't a backup. The test:

1. Create a Supabase project on the free tier (call it
   `mystoreos-restore-test`).
2. From your production project's dashboard → Backups → Download a
   recent daily snapshot.
3. Restore into the test project via `psql`:
   ```
   psql -h db.<test-project-ref>.supabase.co -U postgres < backup.sql
   ```
4. Verify: log into the test project's SQL editor and run:
   ```sql
   SELECT COUNT(*) FROM public.users;
   SELECT COUNT(*) FROM public.orders WHERE created_at > now() - interval '30 days';
   SELECT MAX(created_at) FROM public.orders;
   ```
   All three should be within cooey of what production shows.
5. Delete the test project when done.

Log the restore-test in a simple file (see `docs/RESTORE_LOG.md`
suggested content below). Anthropic recommends you keep at least the
last two restore tests documented.

### 4. Off-region snapshot

Supabase's built-in backups sit in the same region as your primary
database. A regional AWS outage takes both out. For genuine business
continuity — not just accidental-delete recovery — add an off-region
snapshot:

Weekly `pg_dump` from the CLI, uploaded to a bucket in a different
region:

```bash
# Weekly cron on any small VM or GitHub Action:
export PGPASSWORD='...'
pg_dump -h db.<project-ref>.supabase.co -U postgres -d postgres \
        -Fc -f "mystoreos-$(date +%F).dump"
aws s3 cp "mystoreos-$(date +%F).dump" \
        s3://mystoreos-offsite-backups/  # bucket in a non-Mumbai region
```

Skip if that's overkill for your current stage. Add before you cross
one crore in ARR or 10,000 active shops.

## What to log

Create `docs/RESTORE_LOG.md` with:

```
| Date | Restored from | Restore time | Row-count deltas | Anomalies |
|------|--------------|-------------|-----------------|-----------|
| 2026-08-01 | 2026-07-31 snapshot | 4 min | users -3, orders -12 (last 24h) | none |
```

Update it every time you run a test restore. If you have an incident
that requires a real restore, log that too. In a downstream regulator
or partner conversation (payment aggregators, compliance auditors),
this file IS your business-continuity evidence.

## Recovery workflow (for reference)

If you need to restore in production:

1. **Stop writes**. Set Supabase → Pause Project, or if that's too
   disruptive, temporarily REVOKE INSERT/UPDATE/DELETE from anon +
   authenticated. This keeps reads working while you figure out the
   restore point.
2. **Identify the restore target time**. PITR granularity is ~10
   seconds. Pick the latest timestamp before whatever bad thing
   happened.
3. **Trigger PITR restore** via dashboard → Backups → Point in Time
   Recovery → choose timestamp → Restore. Supabase does this
   in-place — do NOT restore to a new project unless you're happy to
   change all your project URLs.
4. **Verify** with the row-count queries above.
5. **Re-open writes**. Un-pause / grant back the RLS.

Expected downtime: 10-30 minutes for a database of your current size.

## What NOT to rely on

- **Vercel snapshots**: Vercel does not back up your database. It only
  keeps deployment history for the frontend build.
- **Supabase free tier backups**: These are daily and delete after 7
  days. Not enough for a live product.
- **Your `supabase/migrations/` folder**: This is your SCHEMA history,
  not your DATA. Don't confuse the two.
- **`git`**: This is your CODE history. Same warning.

The only thing standing between you and data loss is the PITR /
snapshot setup on the Supabase side. Verify quarterly.
