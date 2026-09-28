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
import { MARK_SVG } from './lib/mark.mjs';

const C = {
  bg: '#0a090d', surface: '#13111a', surface2: '#1a1724', line: '#28233a', text: '#ecebf2', muted: '#9690ab', dim: '#635d78',
  purpleDeep: '#2a1452', purpleText: '#b69cff', gold: '#e3b84b', pos: '#34d27f', neg: '#f4565c',
  posBg: 'rgba(52,210,127,0.14)', negBg: 'rgba(244,86,92,0.14)',
};
const col = (x) => (x > 0 ? C.pos : x < 0 ? C.neg : C.muted);

// Minimal element helper for satori (no React needed).
const h = (type, style = {}, ...children) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) },
});
const img = (src, w, hgt) => ({ type: 'img', props: { src, width: w, height: hgt, style: {} } });

const font = (pkg, file) => fs.readFileSync(path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files', file));
const FONTS = [
  { name: 'Inter', data: font('inter', 'inter-latin-400-normal.woff'), weight: 400 },
  { name: 'Inter', data: font('inter', 'inter-latin-600-normal.woff'), weight: 600 },
  { name: 'Inter', data: font('inter', 'inter-latin-800-normal.woff'), weight: 800 },
  { name: 'JBM', data: font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'), weight: 500 },
  { name: 'JBM', data: font('jetbrains-mono', 'jetbrains-mono-latin-700-normal.woff'), weight: 700 },
];
const MONO = { fontFamily: 'JBM' };

function statBox(label, value, color) {
  return h('div', { flexDirection: 'column', gap: 6, padding: '14px 12px', minWidth: 0, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, flex: 1 },
    h('div', { ...MONO, fontSize: 13, letterSpacing: 2, color: C.muted, fontWeight: 500 }, label),
    h('div', { ...MONO, fontSize: 21, fontWeight: 700, color, whiteSpace: 'nowrap' }, value),
  );
}

function leftPanel({ eyebrow, title, s }) {
  return h('div', { flexDirection: 'column', width: 440, height: '100%', padding: '44px 36px 36px 48px', justifyContent: 'space-between' },
    h('div', { flexDirection: 'column' },
      h('div', { alignItems: 'center', gap: 12 },
        img(`data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`, 34, 34),
        h('div', { ...MONO, fontSize: 20, fontWeight: 700, letterSpacing: 4, color: C.gold }, "JOKER'S GAMBIT"),
      ),
      h('div', { ...MONO, marginTop: 40, fontSize: 15, fontWeight: 700, letterSpacing: 3, color: C.purpleText }, eyebrow),
      h('div', { marginTop: 8, fontFamily: 'Inter', fontSize: 38, fontWeight: 800, color: C.text, letterSpacing: -0.5 }, title),
      h('div', { ...MONO, marginTop: 18, fontSize: 96, fontWeight: 700, letterSpacing: -4, color: col(s.pl), lineHeight: 1 }, fmtU(s.pl)),
      h('div', { ...MONO, marginTop: 12, fontSize: 15, color: C.dim }, `${s.bets} bets · ${s.staked.toFixed(2)}u staked${s.pending ? ` · ${s.pending} pending` : ''}`),
    ),
    h('div', { gap: 10 },
      statBox('RECORD', record(s), C.text),
      statBox('ROI', fmtPct(s.roi), s.roi == null ? C.muted : col(s.roi)),
      statBox('WIN %', fmtRate(s.winRate), C.gold),
    ),
  );
}

function footer() {
  return h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', background: C.purpleDeep, ...MONO, fontSize: 15, fontWeight: 700 },
    h('div', { color: C.gold }, CONFIG.footer_line),
    h('div', { color: C.text }, `${CONFIG.domain}  ·  @${CONFIG.handle}`),
  );
}

function frame(left, right) {
  return h('div', { width: 1200, height: 675, background: C.bg, color: C.text, fontFamily: 'Inter', position: 'relative', backgroundImage: 'radial-gradient(circle at 0% 0%, #2a145288 0%, #0a090d00 55%)' },
    h('div', { width: '100%', height: 631 }, left, right),
    footer(),
  );
}

function tableHead(cols) {
  return h('div', { ...MONO, fontSize: 12, letterSpacing: 2, color: C.dim, fontWeight: 500, background: C.surface2, padding: '10px 0', borderBottom: `1px solid ${C.line}` }, ...cols);
}

function weekCard(bets, monday) {
  const s = summarise(bets);
  const MAX = 9;
  const shown = bets.slice(0, bets.length > MAX ? MAX - 1 : MAX);
  const rows = shown.map((b) => {
    const pending = b.result === 'pending';
    const flat = b.result === 'push' || b.result === 'void';
    return h('div', { alignItems: 'stretch', height: 52, borderBottom: `1px solid ${C.line}` },
      h('div', { ...MONO, width: 62, paddingLeft: 16, alignItems: 'center', fontSize: 14, fontWeight: 700, color: C.gold }, dayLabel(b.date)),
      h('div', { flex: 1, flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', paddingRight: 10 },
        h('div', { alignItems: 'baseline', gap: 8, overflow: 'hidden' },
          h('div', { fontSize: 17, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380 }, b.bet),
          h('div', { ...MONO, fontSize: 15, fontWeight: 700, color: C.gold }, `@${fmtOdds(b.odds)}`),
        ),
        h('div', { fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 440 }, `${b.fixture} · ${b.league}`),
      ),
      h('div', { width: 64, alignItems: 'center', justifyContent: 'center' },
        h('div', { ...MONO, fontSize: 13, fontWeight: 700, padding: '5px 9px', borderRadius: 999, background: C.purpleDeep, color: C.purpleText, border: '1px solid #3f2677' }, fmtStake(b.stake_u)),
      ),
      h('div', { ...MONO, width: 110, alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, fontWeight: 700,
        fontSize: pending || flat ? 12 : 17, letterSpacing: pending || flat ? 2 : 0,
        color: pending ? C.dim : flat ? C.muted : col(b.pl_units), background: pending || flat ? 'transparent' : b.pl_units > 0 ? C.posBg : C.negBg },
        pending ? 'PENDING' : flat ? b.result.toUpperCase() : fmtU(b.pl_units)),
    );
  });
  const more = bets.length - shown.length;
  return h('div', { flexDirection: 'column', flex: 1, padding: '44px 48px 32px 0' },
    h('div', { flexDirection: 'column', border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, overflow: 'hidden' },
      tableHead([h('div', { width: 62, paddingLeft: 16 }, 'DAY'), h('div', { flex: 1 }, 'BET'), h('div', { width: 64, justifyContent: 'center' }, 'UNITS'), h('div', { width: 110, justifyContent: 'flex-end', paddingRight: 16 }, 'P/L')]),
      ...rows,
      more > 0 ? h('div', { ...MONO, height: 44, alignItems: 'center', paddingLeft: 16, fontSize: 14, color: C.muted, borderBottom: `1px solid ${C.line}` }, `+ ${more} more — every bet at ${CONFIG.domain}/log`) : null,
      h('div', { ...MONO, height: 50, alignItems: 'center', background: C.surface2 },
        h('div', { width: 62, paddingLeft: 16, fontSize: 13, color: C.muted, fontWeight: 700 }, 'WEEK'),
        h('div', { flex: 1, fontSize: 14, color: C.muted }, `${record(s)} · ROI ${fmtPct(s.roi)}`),
        h('div', { width: 110, height: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, fontSize: 20, fontWeight: 700, color: col(s.pl), background: s.pl > 0 ? C.posBg : s.pl < 0 ? C.negBg : 'transparent' }, fmtU(s.pl)),
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
    return h('div', { alignItems: 'center', height: 56, borderBottom: `1px solid ${C.line}`, ...MONO },
      h('div', { width: 200, paddingLeft: 16, fontSize: 16, color: C.text, fontWeight: 500 }, weekLabel(k)),
      h('div', { width: 110, fontSize: 14, color: C.muted }, `${record(s)}${s.pending ? ` ·${s.pending}p` : ''}`),
      h('div', { flex: 1, alignItems: 'center' }, h('div', { width: Math.max(barW, 2), height: 10, borderRadius: 3, background: col(s.pl) })),
      h('div', { width: 120, justifyContent: 'flex-end', paddingRight: 16, fontSize: 18, fontWeight: 700, color: col(s.pl) }, fmtU(s.pl)),
    );
  });
  const byMarket = [...groupBy(bets, (b) => b.market_type).entries()]
    .map(([m, bs]) => [m, summarise(bs)])
    .sort((a, b) => b[1].pl - a[1].pl)
    .slice(0, 3);
  return h('div', { flexDirection: 'column', flex: 1, padding: '44px 48px 32px 0', gap: 16 },
    h('div', { flexDirection: 'column', border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, overflow: 'hidden' },
      tableHead([h('div', { width: 200, paddingLeft: 16 }, 'WEEK (MON–SUN)'), h('div', { width: 110 }, 'RECORD'), h('div', { flex: 1 }, ''), h('div', { width: 120, justifyContent: 'flex-end', paddingRight: 16 }, 'UNITS')]),
      ...rows,
    ),
    h('div', { gap: 10 },
      ...byMarket.map(([m, s]) =>
        h('div', { flexDirection: 'column', flex: 1, gap: 4, padding: '12px 14px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, ...MONO },
          h('div', { fontSize: 12, letterSpacing: 2, color: C.purpleText, fontWeight: 700 }, m.toUpperCase()),
          h('div', { fontSize: 22, fontWeight: 700, color: col(s.pl) }, fmtU(s.pl)),
          h('div', { fontSize: 12, color: C.dim }, `${record(s)} · ROI ${fmtPct(s.roi)}`),
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
