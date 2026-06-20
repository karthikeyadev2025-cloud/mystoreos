#!/usr/bin/env node
/**
 * scripts/optimize-existing-images.mjs
 *
 * ONE-TIME UTILITY: re-compress product and shop_photo images already in
 * Supabase storage (mystore-assets bucket) to a smaller size — the existing
 * 1280px/0.9 JPEGs were causing the storefront to "load heavy" on phones.
 * Future uploads are already capped at 900px/0.85 (ProductImageUploader fix).
 * This script only touches files that were uploaded BEFORE that change.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SAFETY DESIGN (read this before running):
 *
 * • DRY-RUN BY DEFAULT. Without the --apply flag, the script lists what it
 *   WOULD do but writes nothing.
 *
 * • SCOPED TO products/ AND shop_photos/ ONLY. Logos, avatars, and payment
 *   QR codes are explicitly skipped — re-encoding a payment QR can make it
 *   unscannable, and JPEG re-encoding logos with transparency strips alpha
 *   and looks worse on retina screens.
 *
 * • ONLY OVERWRITES IF THE NEW FILE IS GENUINELY SMALLER. If sharp's output
 *   is the same size or larger, the original is kept untouched.
 *
 * • SKIPS ALREADY-SMALL FILES. Anything under MIN_OPTIMIZE_BYTES is left
 *   alone — likely already-compressed or originally tiny.
 *
 * • SKIPS NON-JPEG / NON-PNG / NON-WEBP. Won't touch PDFs, SVGs, or
 *   anything else that happens to be in the bucket.
 *
 * • UPLOADS WITH upsert: true TO THE SAME KEY. This means public URLs
 *   stored in the database (in products.image_url, products.images,
 *   users.logo, users.shop_photos, etc.) keep working — same path,
 *   smaller bytes. No database mutation needed.
 *
 * • FULL AUDIT LOG WRITTEN to scripts/optimize-log-<timestamp>.json with
 *   the original key, original bytes, new bytes, savings, decision.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * USAGE:
 *
 *   # 1. Install deps locally (one time, not committed):
 *   npm install @supabase/supabase-js sharp
 *
 *   # 2. Set Supabase URL + service-role key (NOT the anon key — needs
 *   #    admin permissions to list and overwrite any user's files):
 *   export SUPABASE_URL="https://<project-id>.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *
 *   # 3. Dry-run first to see what would change:
 *   node scripts/optimize-existing-images.mjs
 *
 *   # 4. After reviewing the dry-run output, apply for real:
 *   node scripts/optimize-existing-images.mjs --apply
 *
 *   # Or only one folder:
 *   node scripts/optimize-existing-images.mjs --apply --folder=shop_photos
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

// ── CONFIG ────────────────────────────────────────────────────────────────
const BUCKET = 'mystore-assets';
const TARGET_MAX_DIM = 900;          // px — matches the new client-side cap
const TARGET_QUALITY = 85;            // JPEG quality 0-100
const MIN_OPTIMIZE_BYTES = 80 * 1024; // 80 KB — anything smaller, leave alone
const ALLOWED_FOLDERS = ['products', 'shop_photos'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

// ── ARG PARSING ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY  = args.includes('--apply');
const FOLDER_ARG = args.find(a => a.startsWith('--folder='))?.split('=')[1];
const onlyFolder = FOLDER_ARG && ALLOWED_FOLDERS.includes(FOLDER_ARG) ? FOLDER_ARG : null;
if (FOLDER_ARG && !onlyFolder) {
  console.error(`✗ --folder must be one of: ${ALLOWED_FOLDERS.join(', ')}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (see header comment).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const log = [];

const fmtBytes = b => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`;

// ── BUCKET WALKER ─────────────────────────────────────────────────────────
// Supabase storage's list() is folder-scoped and not recursive. The path
// layout is {userId}/{folder}/{file}, so we walk: list root → for each
// userId folder → list each {folder} → list files.
async function walkBucket() {
  const targets = [];
  const { data: users, error: rootErr } = await supabase.storage.from(BUCKET).list('', { limit: 1000, offset: 0 });
  if (rootErr) throw new Error(`Failed to list bucket root: ${rootErr.message}`);
  console.log(`→ Found ${users.length} top-level entries in bucket root.`);

  for (const userDir of users) {
    if (!userDir.id || userDir.name.includes('.')) continue;     // skip stray files at root, only dirs
    for (const folder of (onlyFolder ? [onlyFolder] : ALLOWED_FOLDERS)) {
      const folderPath = `${userDir.name}/${folder}`;
      const { data: files, error } = await supabase.storage.from(BUCKET).list(folderPath, { limit: 1000, offset: 0 });
      if (error || !files) continue;
      for (const f of files) {
        if (!f.name || f.name.startsWith('.')) continue;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
        targets.push({
          key: `${folderPath}/${f.name}`,
          ext,
          declaredSize: f.metadata?.size || 0,
        });
      }
    }
  }
  return targets;
}

// ── RE-COMPRESS ONE OBJECT ────────────────────────────────────────────────
async function processOne(t) {
  // 1. Download
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(t.key);
  if (dlErr) return { key: t.key, action: 'download_failed', reason: dlErr.message };
  const original = Buffer.from(await blob.arrayBuffer());
  const originalBytes = original.length;

  // 2. Skip already-small
  if (originalBytes < MIN_OPTIMIZE_BYTES) {
    return { key: t.key, action: 'skipped_small', originalBytes };
  }

  // 3. Re-compress with sharp. autoOrient handles phone-photo EXIF rotation.
  let compressed;
  try {
    compressed = await sharp(original)
      .rotate()                                      // honor EXIF orientation, then strip it
      .resize({ width: TARGET_MAX_DIM, height: TARGET_MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: TARGET_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    return { key: t.key, action: 'compress_failed', originalBytes, reason: e.message };
  }

  const newBytes = compressed.length;

  // 4. Sanity: did we actually save bytes? If not, leave the original.
  if (newBytes >= originalBytes * 0.95) {
    return { key: t.key, action: 'skipped_no_savings', originalBytes, newBytes };
  }

  // 5. Sanity: can sharp read the result back? Guards against any silent
  //    corruption from the encode step.
  try {
    const meta = await sharp(compressed).metadata();
    if (!meta.width || !meta.height) throw new Error('no dimensions');
  } catch (e) {
    return { key: t.key, action: 'verify_failed', originalBytes, newBytes, reason: e.message };
  }

  if (!APPLY) {
    return { key: t.key, action: 'would_overwrite', originalBytes, newBytes, saved: originalBytes - newBytes };
  }

  // 6. Upsert back to the same key — same public URL, smaller bytes. The DB
  //    rows already point here, so no schema updates needed.
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(t.key, compressed, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'image/jpeg',
  });
  if (upErr) return { key: t.key, action: 'upload_failed', originalBytes, newBytes, reason: upErr.message };

  return { key: t.key, action: 'overwritten', originalBytes, newBytes, saved: originalBytes - newBytes };
}

// ── MAIN ──────────────────────────────────────────────────────────────────
(async () => {
  console.log(APPLY ? '🟠 APPLY MODE — files will be overwritten' : '🔵 DRY-RUN MODE — no files will be changed');
  console.log(`   Bucket: ${BUCKET}`);
  console.log(`   Folders: ${onlyFolder || ALLOWED_FOLDERS.join(', ')}`);
  console.log(`   Target: ${TARGET_MAX_DIM}px / quality ${TARGET_QUALITY}`);
  console.log(`   Skip-below: ${fmtBytes(MIN_OPTIMIZE_BYTES)}`);
  console.log('');

  const targets = await walkBucket();
  console.log(`→ ${targets.length} candidate files found in target folders.`);
  console.log('');

  let processed = 0, savedBytes = 0;
  for (const t of targets) {
    processed++;
    const res = await processOne(t);
    log.push(res);
    const tag = {
      overwritten:        '✓ rewrote   ',
      would_overwrite:    '→ would     ',
      skipped_small:      '· small     ',
      skipped_no_savings: '· no-saving ',
      compress_failed:    '✗ compress  ',
      download_failed:    '✗ download  ',
      upload_failed:      '✗ upload    ',
      verify_failed:      '✗ verify    ',
    }[res.action] || '? unknown   ';
    if (res.action === 'overwritten' || res.action === 'would_overwrite') {
      savedBytes += (res.saved || 0);
      console.log(`${tag} ${t.key}  ${fmtBytes(res.originalBytes)} → ${fmtBytes(res.newBytes)}  (saved ${fmtBytes(res.saved)})`);
    } else {
      console.log(`${tag} ${t.key}  ${res.reason || ''}`);
    }
    // Tiny pause every 20 files to be polite to the API.
    if (processed % 20 === 0) await new Promise(r => setTimeout(r, 250));
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  const counts = log.reduce((acc, r) => { acc[r.action] = (acc[r.action] || 0) + 1; return acc; }, {});
  console.log('');
  console.log('━━━ SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Processed:       ${processed} files`);
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`));
  console.log(`Total saved:     ${fmtBytes(savedBytes)}${APPLY ? '' : ' (would save, in dry-run)'}`);

  // Audit log
  const logPath = `scripts/optimize-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`Audit log:       ${logPath}`);

  if (!APPLY) {
    console.log('');
    console.log('Dry-run complete. Re-run with --apply to actually rewrite the listed files.');
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
