// Per-shop link previews for /s/:shopId
// ------------------------------------------------------------------
// WhatsApp / Facebook / X read Open Graph tags from the HTML BEFORE any
// JavaScript runs. This SPA can't set them client-side for crawlers, so this
// serverless function fetches the real built index.html, swaps in the shop's
// name + logo as the og:/twitter: tags, and returns it.
//
// SAFETY: on ANY error (Supabase down, bad shopId, fetch fail) it returns the
// normal index.html unchanged. It can never break the storefront — worst case
// the preview is just the generic MyStore OS card.

const SUPA_URL = process.env.VITE_SUPABASE_URL || 'https://zdertmpzervgjicuwsfz.supabase.co';
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

let _htmlCache = null;
let _htmlAt = 0;

async function getBaseHtml(host) {
  const now = Date.now();
  if (_htmlCache && now - _htmlAt < 60000) return _htmlCache;
  const res = await fetch(`https://${host}/index.html`);
  const html = await res.text();
  _htmlCache = html;
  _htmlAt = now;
  return html;
}

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inject(html, { title, desc, image, url }) {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="MyStore OS" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join('\n    ');
  return html
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

export default async function handler(req, res) {
  const host = (req.headers && req.headers.host) || 'mystoreos.in';
  const shopId = ((req.query && req.query.shopId) || '').toString();

  let baseHtml = '';
  try {
    baseHtml = await getBaseHtml(host);
  } catch (e) {
    // Extremely rare (origin can't serve its own index.html). Minimal safe page.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send('<!doctype html><meta http-equiv="refresh" content="0;url=/"><title>MyStore OS</title>');
    return;
  }

  try {
    if (shopId && SUPA_KEY) {
      const r = await fetch(
        `${SUPA_URL}/rest/v1/users?id=eq.${encodeURIComponent(shopId)}&select=name,logo`,
        { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
      );
      const rows = await r.json();
      const shop = Array.isArray(rows) ? rows[0] : null;
      if (shop && shop.name) shop.name = String(shop.name).trim();
      if (shop && shop.name) {
        const html = inject(baseHtml, {
          title: `${shop.name} — Order Online`,
          desc: `Browse and order from ${shop.name} on MyStore OS. Fresh stock, quick delivery, pay by UPI.`,
          image: shop.logo || `https://${host}/logo.png`,
          url: `https://${host}/s/${shopId}`,
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate');
        res.status(200).send(html);
        return;
      }
    }
  } catch (e) {
    // fall through to the unmodified SPA HTML
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(baseHtml);
}
