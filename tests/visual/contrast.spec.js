import { test, expect } from '@playwright/test';

/**
 * WCAG AA contrast gate.
 *
 * The palette flip to a light ground left 84 text nodes unreadable —
 * near-white body copy on white pricing cards, cream headings on cream,
 * white button labels on near-white fills. None of it was caught by the
 * build, by eslint, or by the theme-integrity test, because every one of
 * those inspects source rather than rendered output. Contrast is a
 * property of a rendered pair, so it has to be measured in a browser.
 *
 * Two known limits, worth stating so this test is not over-trusted:
 *
 *  - Gradient text is invisible here. WebkitTextFillColor: transparent
 *    means getComputedStyle reports no usable colour, so the audit scores
 *    it as passing. The hero headline was exactly this case: it read as
 *    clean while its last word faded into the cream. Gradient text is now
 *    banned on this page for that reason.
 *  - It measures the nearest opaque ancestor background, so text over an
 *    image or a heavy gradient is approximated.
 */

const LUM = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

test('landing page has no text below WCAG AA', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const fails = await page.evaluate(() => {
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const alpha = (c) => { const m = c.match(/[\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; };
    const bgOf = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && alpha(bg) > 0.5 && bg !== 'rgba(0, 0, 0, 0)') return parse(bg);
        n = n.parentElement;
      }
      return [247, 245, 240];
    };
    const blend = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      const txt = [...el.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim()).join(' ').trim();
      if (!txt || txt.length < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.1) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const bg = bgOf(el);
      const fg = blend(parse(cs.color), alpha(cs.color), bg);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        out.push(`${ratio.toFixed(2)}:1 (need ${need}) ${Math.round(size)}px "${txt.slice(0, 40)}" ${cs.color} on rgb(${bg.map(Math.round).join(', ')})`);
      }
    }
    return out;
  });

  expect(fails, `\n${fails.length} unreadable text nodes:\n  ${fails.join('\n  ')}\n`).toEqual([]);
});

test('no gradient text on the landing page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const gradients = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        return cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' && el.textContent.trim();
      })
      .map((el) => el.textContent.trim().slice(0, 40)));
  expect(gradients,
    '\nGradient text cannot be contrast-checked — the audit scores it as passing while it may be unreadable.\n'
  ).toEqual([]);
});
