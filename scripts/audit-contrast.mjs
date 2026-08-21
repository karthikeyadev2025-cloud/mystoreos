import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);

const fails = await p.evaluate(() => {
  const lum = ([r,g,b]) => { const f = v => { v/=255; return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4; };
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const parse = c => (c.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const alpha = c => { const m=c.match(/[\d.]+/g); return m && m.length>3 ? Number(m[3]) : 1; };
  const bgOf = el => { let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && alpha(bg) > 0.5 && bg !== 'rgba(0, 0, 0, 0)') return parse(bg);
      n = n.parentElement; }
    return [247,245,240]; };
  const blend = (fg, a, bg) => fg.map((c,i) => c*a + bg[i]*(1-a));
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const txt = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();
    if (!txt || txt.length < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility==='hidden' || cs.display==='none' || Number(cs.opacity) < 0.1) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const bg = bgOf(el);
    const fg = blend(parse(cs.color), alpha(cs.color), bg);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push({ txt: txt.slice(0,44), ratio: +ratio.toFixed(2), need,
      color: cs.color, bg: `rgb(${bg.map(Math.round).join(', ')})`, size: Math.round(size),
      tag: el.tagName.toLowerCase() });
  }
  return out;
});

fails.sort((a,b)=>a.ratio-b.ratio);
console.log(`\n${fails.length} text nodes below WCAG AA\n`);
const byColor = {};
for (const f of fails) { const k = f.color + ' ON ' + f.bg; (byColor[k] ||= []).push(f); }
for (const [k, list] of Object.entries(byColor).sort((a,b)=>b[1].length-a[1].length))
  console.log(`${String(list.length).padStart(3)}x  ratio ${list[0].ratio}   ${k}\n      e.g. "${list[0].txt}"`);
await b.close();
