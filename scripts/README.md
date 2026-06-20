# One-time optimization scripts

These are utility scripts that are **not part of the running app**. They operate
on production Supabase data using the service-role key, so they need to be
treated carefully.

## `optimize-existing-images.mjs`

Recompresses product and shop-photo images that were uploaded **before** the
ProductImageUploader was switched from 1280px/0.9 to 900px/0.85. Existing
images don't shrink on their own, so this is a one-time backfill.

### What it touches

- `mystore-assets/<userId>/products/*` — product photos
- `mystore-assets/<userId>/shop_photos/*` — wide shop banner photos

### What it does NOT touch (deliberate)

- `logos/` — small, often transparent PNGs; JPEG re-encoding would strip alpha
  and add visible compression artifacts on retina screens.
- `avatars/` — already small, not on a critical render path.
- `payment_qrs/` — **never re-encode payment QR codes**. Any lossy compression
  can render a QR unscannable; this risk is non-negotiable.

### Safety guarantees

- **Dry-run by default** — run without `--apply` first, review the listed
  changes, then apply.
- **Overwrites only if smaller** — if the new compressed version is the same
  size or larger (e.g. an already-small image that won't compress further),
  the original is kept.
- **Same storage key** — the URL stored in your database (`products.image_url`,
  `users.shop_photos`, etc.) keeps working because we upsert to the same
  path. No DB migration needed.
- **Audit log** — every decision is written to a timestamped JSON file under
  `scripts/`.

### Running it

```bash
# 1. Install the script's deps (one-time, not committed):
npm install --no-save @supabase/supabase-js sharp

# 2. Set Supabase URL + SERVICE ROLE key (NOT the anon key — needs admin):
export SUPABASE_URL="https://zdertmpzervgjicuwsfz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role key from Supabase project settings>"

# 3. Dry-run — lists what would change, writes nothing:
node scripts/optimize-existing-images.mjs

# 4. Review output. If happy, apply for real:
node scripts/optimize-existing-images.mjs --apply

# Or only one folder at a time:
node scripts/optimize-existing-images.mjs --apply --folder=shop_photos
```

### Getting the service role key

Supabase dashboard → Project Settings → API → "service_role" key. **Never
commit this** anywhere — it bypasses all RLS. Use only in your shell to run
this script, then unset it (`unset SUPABASE_SERVICE_ROLE_KEY`).
