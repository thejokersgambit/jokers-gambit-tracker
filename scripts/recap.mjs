// npm run recap:week                 -> latest week with bets
// npm run recap:week -- 2026-09-14   -> the Mon–Sun week containing that date
// npm run recap:month                -> latest month with bets
// npm run recap:month -- 2026-09     -> that month
// Writes a 1200×675 PNG into exports/.

import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import {
  ROOT, CONFIG, loadBets, summarise, groupBy, weekStart, weekLabel, dayLabel, monthKey, monthLabel, byChrono,
  fmtU, fmtPct, fmtRate, fmtOdds, fmtStake, record, isISODate,
} from './lib/bets.mjs';

// Brand palette — same tokens as site/style.css. Crimson is structure only; results use signal green/red.
const C = {
  bg: '#0a0808', surface: '#121010', surface2: '#171313', surface3: '#1d1818', line: '#2a2122', lineSoft: '#1f1819',
  ivory: '#f2e8dc', text: '#e9e1d7', muted: '#a39a91', dim: '#6f6761', silver: '#cec6c0',
  crimson: '#8b0616', crimsonDeep: '#5e0712', crimsonInk: '#2c0a0e',
  pos: '#3ddc84', neg: '#ff4747', posBg: 'rgba(61,220,132,0.08)',
};
const col = (x) => (x > 0 ? C.pos : x < 0 ? C.neg : C.muted);

// Minimal element helper for satori (no React needed).
const h = (type, style = {}, ...children) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) },
});
const img = (src, w, hgt, style = {}) => ({ type: 'img', props: { src, width: w, height: hgt, style } });

const font = (pkg, file) => fs.readFileSync(path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files', file));
const FONTS = [
  { name: 'Cinzel', data: font('cinzel', 'cinzel-latin-500-normal.woff'), weight: 500 },
  { name: 'Cinzel', data: font('cinzel', 'cinzel-latin-700-normal.woff'), weight: 700 },
  { name: 'Bodoni', data: font('bodoni-moda', 'bodoni-moda-latin-700-normal.woff'), weight: 700 },
  { name: 'Inter', data: font('inter', 'inter-latin-400-normal.woff'), weight: 400 },
  { name: 'Inter', data: font('inter', 'inter-latin-600-normal.woff'), weight: 600 },
  { name: 'JBM', data: font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'), weight: 500 },
  { name: 'JBM', data: font('jetbrains-mono', 'jetbrains-mono-latin-700-normal.woff'), weight: 700 },
];
const MONO = { fontFamily: 'JBM' };
const DISPLAY = { fontFamily: 'Cinzel' };
const NUM = { fontFamily: 'Bodoni' }; // big numbers: Cinzel's 1 reads as I
const MARK = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'site', 'brand', 'jg-mark-96.png')).toString('base64')}`;
const SPADE = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 6C38 26 14 38 14 58a18 18 0 0 0 30 13c-1 9-5 16-12 23h36c-7-7-11-14-12-23a18 18 0 0 0 30-13C86 38 62 26 50 6z" fill="none" stroke="#f2e8dc" stroke-width="1.6"/></svg>`).toString('base64')}`;

// Crimson rule with a centre diamond (from the banner)
const rule = (width) =>
  h('div', { width, height: 12, position: 'relative', alignItems: 'center' },
    h('div', { position: 'absolute', left: 0, right: 0, top: 5.5, height: 1, backgroundImage: `linear-gradient(90deg, ${C.crimson}, ${C.crimson} 70%, rgba(139,6,22,0))` }),
    h('div', { position: 'absolute', left: 0, top: 2, width: 8, height: 8, background: C.crimson, transform: 'rotate(45deg)' }),
  );

function statBox(label, value, color) {
  return h('div', { flexDirection: 'column', gap: 8, padding: '14px 14px 13px', minWidth: 0, flex: 1, borderRadius: 10,
      backgroundImage: `linear-gradient(180deg, ${C.surface2}, ${C.surface})`, border: `1px solid ${C.lineSoft}`, borderTop: `2px solid ${C.crimson}` },
    h('div', { ...MONO, fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: 500 }, label),
    h('div', { ...NUM, fontSize: 26, fontWeight: 700, color, whiteSpace: 'nowrap' }, value),
  );
}

function leftPanel({ eyebrow, title, s }) {
  return h('div', { flexDirection: 'column', width: 450, height: '100%', padding: '40px 34px 34px 48px', justifyContent: 'space-between' },
    h('div', { flexDirection: 'column' },
      h('div', { alignItems: 'center', gap: 14 },
        img(MARK, 46, 46, { borderRadius: 23 }),
        h('div', { ...DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: 4.5 },
          h('span', { color: C.silver }, 'JOKER’S'),
          h('span', { color: C.crimson, marginLeft: 12 }, 'GAMBIT'),
        ),
      ),
      h('div', { marginTop: 14 }, rule(300)),
      h('div', { ...DISPLAY, marginTop: 26, fontSize: 14, fontWeight: 700, letterSpacing: 4, color: C.muted }, eyebrow),
      h('div', { ...DISPLAY, marginTop: 8, fontSize: 36, fontWeight: 700, color: C.ivory, letterSpacing: 1 }, title),
      h('div', { ...NUM, marginTop: 10, fontSize: 112, fontWeight: 700, color: col(s.pl), lineHeight: 1, letterSpacing: -1 }, fmtU(s.pl)),
      h('div', { ...MONO, marginTop: 14, fontSize: 14, color: C.dim }, `${s.bets} bets · ${s.staked.toFixed(2)}u staked${s.pending ? ` · ${s.pending} pending` : ''}`),
    ),
    h('div', { gap: 10 },
      statBox('RECORD', record(s), C.ivory),
      statBox('ROI', fmtPct(s.roi), s.roi == null ? C.muted : col(s.roi)),
      statBox('WIN %', fmtRate(s.winRate), C.ivory),
    ),
  );
}

function footer() {
  return h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, alignItems: 'center', justifyContent: 'space-between', padding: '0 48px',
      background: '#120b0c', borderTop: `2px solid ${C.crimson}` },
    h('div', { ...DISPLAY, color: C.ivory, fontSize: 15, fontWeight: 700, letterSpacing: 2.5 }, CONFIG.footer_line.toUpperCase()),
    h('div', { ...MONO, color: C.silver, fontSize: 14, fontWeight: 500 }, `${CONFIG.domain}  ·  @${CONFIG.handle}`),
  );
}

function frame(left, right) {
  return h('div', { width: 1200, height: 675, background: C.bg, color: C.text, fontFamily: 'Inter', position: 'relative',
      backgroundImage: 'radial-gradient(circle at 8% 0%, rgba(139,6,22,0.30) 0%, rgba(10,8,8,0) 48%)' },
    img(SPADE, 300, 300, { position: 'absolute', left: -60, bottom: -40, opacity: 0.045 }),
    h('div', { width: '100%', height: 629 }, left, right),
    footer(),
  );
}

function tableHead(cols) {
  return h('div', { ...MONO, fontSize: 11, letterSpacing: 2.5, color: C.dim, fontWeight: 500, padding: '12px 0 10px', borderBottom: `1px solid ${C.crimsonDeep}`, background: C.surface2 }, ...cols);
}

/** P/L cell: signal-coloured text + a 4px marker bar. Never a red fill, so losses can't blend into the crimson branding. */
function plCell(b, width, size = 17) {
  const pending = b.result === 'pending';
  const flat = b.result === 'push' || b.result === 'void';
  const v = b.pl_units;
  return h('div', { ...MONO, width, height: '100%', position: 'relative', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, fontWeight: 700,
      fontSize: pending || flat ? 12 : size, letterSpacing: pending || flat ? 2 : 0,
      color: pending ? C.dim : flat ? C.muted : col(v),
      background: pending || flat ? 'transparent' : v > 0 ? C.posBg : C.surface3 },
    pending || flat ? null : h('div', { position: 'absolute', left: 0, top: 11, bottom: 11, width: 4, borderRadius: 2, background: col(v) }),
    pending ? 'PENDING' : flat ? b.result.toUpperCase() : fmtU(v));
}

function weekCard(bets, monday) {
  const s = summarise(bets);
  const MAX = 9;
  const shown = bets.slice(0, bets.length > MAX ? MAX - 1 : MAX);
  const rows = shown.map((b) =>
    h('div', { alignItems: 'stretch', height: 52, borderBottom: `1px solid ${C.lineSoft}` },
      h('div', { ...MONO, width: 62, paddingLeft: 16, alignItems: 'center', fontSize: 13, fontWeight: 700, letterSpacing: 1, color: C.silver }, dayLabel(b.date)),
      h('div', { flex: 1, flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', paddingRight: 10 },
        h('div', { alignItems: 'baseline', gap: 8, overflow: 'hidden' },
          h('div', { fontSize: 16.5, fontWeight: 600, color: C.ivory, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380 }, b.bet),
          h('div', { ...MONO, fontSize: 14, fontWeight: 500, color: C.muted }, `@${fmtOdds(b.odds)}`),
        ),
        h('div', { fontSize: 12, color: C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 440 }, `${b.fixture} · ${b.league}`),
      ),
      h('div', { width: 64, alignItems: 'center', justifyContent: 'center' },
        h('div', { ...MONO, fontSize: 12.5, fontWeight: 700, padding: '5px 9px', borderRadius: 999, background: C.crimsonInk, color: C.ivory, border: `1px solid ${C.crimsonDeep}` }, fmtStake(b.stake_u)),
      ),
      plCell(b, 112),
    ),
  );
  const more = bets.length - shown.length;
  return h('div', { flexDirection: 'column', flex: 1, padding: '40px 48px 30px 0' },
    h('div', { flexDirection: 'column', border: `1px solid ${C.line}`, borderRadius: 10, background: C.surface, overflow: 'hidden' },
      tableHead([h('div', { width: 62, paddingLeft: 16 }, 'DAY'), h('div', { flex: 1 }, 'BET'), h('div', { width: 64, justifyContent: 'center' }, 'UNITS'), h('div', { width: 112, justifyContent: 'flex-end', paddingRight: 16 }, 'P/L')]),
      ...rows,
      more > 0 ? h('div', { ...MONO, height: 44, alignItems: 'center', paddingLeft: 16, fontSize: 13, color: C.muted, borderBottom: `1px solid ${C.lineSoft}` }, `+ ${more} more — every bet at ${CONFIG.domain}/log`) : null,
      h('div', { height: 54, alignItems: 'center', background: C.surface2, borderTop: `1px solid ${C.line}` },
        h('div', { ...MONO, width: 62, paddingLeft: 16, fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: 1 }, 'WEEK'),
        h('div', { ...MONO, flex: 1, fontSize: 13, color: C.muted }, `${record(s)} · ROI ${fmtPct(s.roi)}`),
        h('div', { ...NUM, width: 112, height: '100%', position: 'relative', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, fontSize: 23, fontWeight: 700, color: col(s.pl), background: s.pl > 0 ? C.posBg : s.pl < 0 ? C.surface3 : 'transparent' },
          s.pl ? h('div', { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderRadius: 2, background: col(s.pl) }) : null,
          fmtU(s.pl)),
      ),
    ),
  );
}

function monthCard(bets) {
  const weeks = [...groupBy(bets, (b) => weekStart(b.date)).entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  const maxAbs = Math.max(0.01, ...weeks.map(([, w]) => Math.abs(summarise(w).pl)));
  const rows = weeks.map(([k, w]) => {
    const s = summarise(w);
    const barW = Math.round((Math.abs(s.pl) / maxAbs) * 180);
    return h('div', { alignItems: 'center', height: 56, borderBottom: `1px solid ${C.lineSoft}`, ...MONO },
      h('div', { width: 200, paddingLeft: 16, fontSize: 15, color: C.ivory, fontWeight: 500 }, weekLabel(k)),
      h('div', { width: 110, fontSize: 13, color: C.dim }, `${record(s)}${s.pending ? ` ·${s.pending}p` : ''}`),
      h('div', { flex: 1, alignItems: 'center' }, h('div', { width: Math.max(barW, 2), height: 8, borderRadius: 4, background: col(s.pl) })),
      h('div', { width: 120, justifyContent: 'flex-end', paddingRight: 16, fontSize: 17, fontWeight: 700, color: col(s.pl) }, fmtU(s.pl)),
    );
  });
  const byMarket = [...groupBy(bets, (b) => b.market_type).entries()]
    .map(([m, bs]) => [m, summarise(bs)])
    .sort((a, b) => b[1].pl - a[1].pl)
    .slice(0, 3);
  return h('div', { flexDirection: 'column', flex: 1, padding: '40px 48px 30px 0', gap: 16 },
    h('div', { flexDirection: 'column', border: `1px solid ${C.line}`, borderRadius: 10, background: C.surface, overflow: 'hidden' },
      tableHead([h('div', { width: 200, paddingLeft: 16 }, 'WEEK (MON–SUN)'), h('div', { width: 110 }, 'RECORD'), h('div', { flex: 1 }, ''), h('div', { width: 120, justifyContent: 'flex-end', paddingRight: 16 }, 'UNITS')]),
      ...rows,
    ),
    h('div', { gap: 10 },
      ...byMarket.map(([m, s]) =>
        h('div', { flexDirection: 'column', flex: 1, gap: 6, padding: '13px 14px', borderRadius: 10, backgroundImage: `linear-gradient(180deg, ${C.surface2}, ${C.surface})`, border: `1px solid ${C.lineSoft}`, borderTop: `2px solid ${C.crimson}` },
          h('div', { ...MONO, fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: 700 }, m.toUpperCase()),
          h('div', { ...NUM, fontSize: 25, fontWeight: 700, color: col(s.pl) }, fmtU(s.pl)),
          h('div', { ...MONO, fontSize: 12, color: C.dim }, `${record(s)} · ROI ${fmtPct(s.roi)}`),
        ),
      ),
    ),
  );
}

async function render(tree, outName) {
  const svg = await satori(tree, { width: 1200, height: 675, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  const dir = path.join(ROOT, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, outName);
  fs.writeFileSync(out, png);
  return out;
}

const [kind, arg] = process.argv.slice(2);
try {
  const sample = process.argv.includes('--sample');
  const bets = loadBets(sample ? path.join(ROOT, 'data', 'sample', 'bets.json') : undefined).sort(byChrono);
  if (!bets.length) throw new Error('No bets yet.');
  let out;
  if (kind === 'week') {
    const ref = arg && arg !== '--sample' ? arg : bets[bets.length - 1].date;
    if (!isISODate(ref)) throw new Error(`"${ref}" is not a date like 2026-09-14`);
    const monday = weekStart(ref);
    const wk = bets.filter((b) => weekStart(b.date) === monday);
    if (!wk.length) throw new Error(`No bets in the week of ${weekLabel(monday)}`);
    const s = summarise(wk);
    out = await render(frame(leftPanel({ eyebrow: 'WEEKLY RECAP', title: weekLabel(monday), s }), weekCard(wk, monday)), `${sample ? 'SAMPLE-' : ''}week-${monday}.png`);
  } else if (kind === 'month') {
    const key = arg && arg !== '--sample' ? arg.slice(0, 7) : monthKey(bets[bets.length - 1].date);
    if (!/^\d{4}-\d{2}$/.test(key)) throw new Error(`"${arg}" is not a month like 2026-09`);
    const mo = bets.filter((b) => monthKey(b.date) === key);
    if (!mo.length) throw new Error(`No bets in ${monthLabel(key)}`);
    const s = summarise(mo);
    out = await render(frame(leftPanel({ eyebrow: 'MONTHLY RECAP', title: monthLabel(key), s }), monthCard(mo)), `${sample ? 'SAMPLE-' : ''}month-${key}.png`);
  } else {
    throw new Error('Use: npm run recap:week   or   npm run recap:month');
  }
  console.log(`✓ Saved ${path.relative(ROOT, out)}`);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
