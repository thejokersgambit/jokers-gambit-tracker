// npm run import — one-time migration of the old record into data/bets.json.
//
// Sources in data/import/:
//   *.csv  — Google Sheet tab exports (#, Date, League, Fixture(s), Bet, Stake (U), Odds, Result, P/L, Running P/L)
//   *.md   — a markdown table of bets taken from the X feed (same columns, plus "Pick tweet")
//
// P/L is ALWAYS recomputed from stake/odds/result. The source's own P/L (and each tab's summary panel) is only a
// cross-check. Disagreements, unreadable cells, numbering gaps and likely duplicates are FLAGGED in
// data/import/REPORT.md and block the import until resolved in data/import/corrections.json:
//
//   { "defaults": { "World Cup '26": { "league": "World Cup" } },
//     "rows": {
//       "September 2026 #56": { "odds": 1.775, "why": "..." },        <- override any field
//       "August 2026 #12":    { "accept": true, "why": "..." },       <- keep as-is, flag acknowledged
//       "World Cup '26 gap #24": { "accept": true, "why": "..." },    <- explain a numbering gap
//       "August 2026 #20":    { "skip": true, "why": "..." } } }      <- leave the row out
//
// Flags:  --dry-run (write nothing)  --draft (also write data/import/draft-bets.json for a local preview
//         even while flags are open)  --replace (overwrite an existing data/bets.json, asks first)

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ROOT, DATA_FILE, saveBets, computePL, round2, isISODate, isTweetUrl, MARKET_TYPES, fmtU, byChrono, summarise } from './lib/bets.mjs';
import { parseCSV } from './lib/csv.mjs';
import { guessMarket } from './lib/markets.mjs';
import { parseOdds, parseResult } from './lib/cli.mjs';

const DIR = path.join(ROOT, 'data', 'import');
const CORR_FILE = path.join(DIR, 'corrections.json');
const REPORT = path.join(DIR, 'REPORT.md');
const DRAFT = path.join(DIR, 'draft-bets.json');
const argv = process.argv.slice(2);
const replace = argv.includes('--replace');
const dryRun = argv.includes('--dry-run');
const draft = argv.includes('--draft');

const corr = fs.existsSync(CORR_FILE) ? JSON.parse(fs.readFileSync(CORR_FILE, 'utf8')) : {};
const CORR_ROWS = corr.rows || {};
const CORR_DEFAULTS = corr.defaults || {};
const usedCorr = new Set();

// ---------- reading sources into grids ----------
const tabName = (file) => file.replace(/\.(csv|md)$/i, '').replace(/^Joker.s Gambit\s*-\s*/i, '').trim();

function mdGrid(text) {
  // Every markdown table row becomes a grid row; separator rows (|---|) are dropped.
  return text
    .split(/\r?\n/)
    .filter((l) => /^\s*\|.*\|\s*$/.test(l) && !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
}

const sources = fs
  .readdirSync(DIR)
  .filter((f) => /\.(csv|md)$/i.test(f) && f !== 'REPORT.md')
  .map((file) => {
    const text = fs.readFileSync(path.join(DIR, file), 'utf8');
    const md = file.toLowerCase().endsWith('.md');
    return { file, md, tab: md ? 'X feed' : tabName(file), grid: md ? mdGrid(text) : parseCSV(text) };
  });
if (!sources.length) {
  console.error('✗ No CSV or .md files in data/import/.');
  process.exit(1);
}

// ---------- column mapping ----------
const norm = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9#/]/g, '');
function mapHeader(cells) {
  const m = {};
  cells.forEach((c, i) => {
    const n = norm(c);
    if (!n) return;
    const set = (k) => (m[k] ??= i);
    if (n === '#' || n === 'no') set('num');
    else if (n === 'date') set('date');
    else if (n.startsWith('league') || n.startsWith('competition')) set('league');
    else if (n.startsWith('fixture') || n === 'match') set('fixture');
    else if (n === 'bet' || n === 'pick' || n === 'selection') set('bet');
    else if (n.startsWith('stake')) set('stake');
    else if (n.startsWith('odds')) set('odds');
    else if (n === 'result') set('result');
    else if (n.startsWith('running')) set('running');
    else if (n === 'p/l' || n === 'pl' || n === 'profit') set('pl');
    else if (n.includes('tweet') || n === 'link' || n === 'url') set('tweet');
    else if (n.startsWith('market')) set('market');
    else if (n.startsWith('note')) set('notes');
  });
  return m;
}

// ---------- cell parsers ----------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');
function parseDate(raw, year) {
  const s = raw.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = s.match(/^(?:[a-z]+,?\s+)?([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})?$/)) && MONTHS.includes(m[1])) {
    return `${m[3] || year}-${pad(MONTHS.indexOf(m[1]) + 1)}-${pad(m[2])}`;
  }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s*(\d{4})?$/)) && MONTHS.includes(m[2])) {
    return `${m[3] || year}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(m[1])}`;
  }
  return null; // numeric 9/7 style dates are refused: day/month order is ambiguous
}
const num = (s) => {
  const t = String(s ?? '').trim().replace(/[u\s]/gi, '').replace(/[−–]/g, '-');
  return t === '' ? null : Number(t);
};
const stripAK = (s) => s.replace(/\s*\(confirmed by AK\)\s*/gi, ' ').trim();

/** Tweet cell → { url, note }. Only a cell that STARTS with a status link counts as the pick tweet. */
function parseTweetCell(cell) {
  const c = cell.trim();
  const m = c.match(/^(https:\/\/(?:www\.)?(?:x|twitter)\.com\/\w+\/status\/\d+)/);
  const clean = (u) => u.replace(/\?.*$/, '').replace('twitter.com', 'x.com').replace('www.', '');
  if (m) return { url: clean(m[1]), note: '' };
  if (!c) return { url: '', note: '' };
  const recap = c.match(/https:\/\/\S+/);
  if (/not located/i.test(c)) return { url: '', note: `Pick tweet not located${recap ? `; result post: ${clean(recap[0])}` : ''}` };
  return { url: '', note: c };
}

// ---------- parse every source ----------
const flags = []; // level: 'error' | 'mismatch' | 'info'
const imported = [];
const tabStats = [];

for (const src of sources) {
  const { grid, tab, file } = src;
  const hi = grid.findIndex((r) => { const m = mapHeader(r); return m.date !== undefined && m.bet !== undefined; });
  if (hi < 0) {
    flags.push({ key: tab, level: 'error', msg: `${file}: no header row with "Date" and "Bet" columns` });
    continue;
  }
  const col = mapHeader(grid[hi]);
  const defaults = CORR_DEFAULTS[tab] || {};
  if (col.league === undefined && !defaults.league) flags.push({ key: tab, level: 'error', msg: 'No League column — set one in corrections.json "defaults"' });
  const year = Number((tab.match(/20\d\d/) || [])[0]) || 2026;

  // Summary panel ("Record 34-18", "Profit +28.38U", "Units Staked 98U") — label cell followed by a value cell.
  const panel = {};
  for (const row of grid) {
    row.forEach((c, i) => {
      const label = c.trim().toLowerCase();
      const v = (row[i + 1] ?? '').trim();
      if (['record', 'profit', 'units staked'].includes(label) && /^[+\-\d]/.test(v) && !(label in panel)) panel[label] = v;
    });
  }

  let lastDate = null, sheetSum = 0, lastRunning = null, prevNum = null;
  const bets = [];
  for (let r = hi + 1; r < grid.length; r++) {
    const cells = grid[r];
    const g = (k) => (col[k] === undefined ? '' : String(cells[col[k]] ?? '').trim());
    if (!g('bet') && !g('fixture')) continue;
    const n = g('num');
    const key = n ? `${tab} #${n}` : `${tab} row ${r + 1}`;
    const flag = (level, msg) => flags.push({ key, level, msg });

    if (n && prevNum !== null && Number(n) !== prevNum + 1) {
      for (let missing = prevNum + 1; missing < Number(n); missing++) {
        const gk = `${tab} gap #${missing}`;
        if (CORR_ROWS[gk]) usedCorr.add(gk);
        if (!CORR_ROWS[gk]?.accept) flags.push({ key: gk, level: 'mismatch', msg: `Numbering jumps from #${prevNum} to #${n} — there is no #${missing}. Was a bet removed, or is it a numbering slip?` });
        else flags.push({ key: gk, level: 'info', msg: `Numbering gap explained: ${CORR_ROWS[gk].why}` });
      }
    }
    if (n) prevNum = Number(n);

    const c = CORR_ROWS[key];
    if (c) usedCorr.add(key);
    if (c?.skip) {
      flag('info', `Left out: ${c.why || '(no reason given)'}`);
      continue;
    }

    const notes = [];
    // date
    let date = g('date') ? parseDate(g('date'), year) : lastDate;
    if (!g('date') && lastDate) flag('info', `Date blank — used the row above (${lastDate})`);
    if (!date && !c?.date) flag('error', `Can't read the date "${g('date')}"`);
    if (date) lastDate = date;

    // odds (American → decimal, keeping what was posted)
    const oddsRaw = g('odds').split(/\s+/)[0] || '';
    const odds = oddsRaw ? parseOdds(oddsRaw) : null;
    if (/^[+-]\d{3,}$/.test(oddsRaw)) notes.push(`Posted odds ${oddsRaw}`);

    // result: first word counts, anything in brackets becomes a note
    const resRaw = stripAK(g('result'));
    const resWord = resRaw.split(/[\s(]/)[0];
    const result = resWord === '' || /^pending$/i.test(resWord) ? 'pending' : parseResult(resWord) || (/^(won|✔️?)$/i.test(resWord) ? 'win' : /^lost$/i.test(resWord) ? 'loss' : null);
    const resNote = (resRaw.match(/\((.*)\)/) || [])[1];
    if (resNote) notes.push(`Result: ${resNote}`);

    const tw = parseTweetCell(g('tweet'));
    if (tw.note && !c?.tweet_url) notes.push(tw.note);
    if (g('notes')) notes.push(g('notes'));

    const bet = {
      date,
      league: g('league') || defaults.league || '',
      fixture: stripAK(g('fixture')),
      bet: stripAK(g('bet')),
      stake_u: num(g('stake')),
      odds,
      result,
      market_type: '',
      tweet_url: tw.url,
      notes: [`Imported from ${src.md ? 'X feed extraction' : `old sheet tab "${tab}"`}${n ? ` #${n}` : ''}`, ...notes].join('. '),
      _key: key,
      _src: sources.indexOf(src),
      _row: r,
    };
    bet.market_type = g('market') && MARKET_TYPES.includes(g('market')) ? g('market') : guessMarket(bet.bet);

    const overridden = c ? Object.keys(c).filter((k) => !['accept', 'why', 'skip'].includes(k)) : [];
    for (const k of overridden) bet[k] = c[k];
    if (overridden.length) bet.notes += `. Corrected at import (${overridden.join(', ')}): ${c.why}`;

    if (!isISODate(bet.date)) flag('error', `Date "${bet.date}" is not valid`);
    if (!(bet.stake_u > 0)) flag('error', `Stake "${g('stake')}" is not a positive number`);
    if (!(bet.odds >= 1.01)) flag('error', `Odds "${g('odds')}" can't be read`);
    if (!bet.result) flag('error', `Result "${g('result')}" is not win/loss/push/void/pending`);
    if (!bet.fixture || /^\(.*\)$/.test(bet.fixture)) { if (!c?.accept && !overridden.includes('fixture')) flag('mismatch', `Fixture "${bet.fixture}" is missing or a placeholder — what was the match?`); }
    if (/details in tweet/i.test(bet.bet) && !c?.accept && !overridden.includes('bet')) flag('mismatch', `Bet text "${bet.bet}" doesn't say what the bet was — list the legs`);
    if (bet.tweet_url && !isTweetUrl(bet.tweet_url)) flag('error', `Tweet URL "${bet.tweet_url}" is not a status link`);

    // Tweet must have been posted on or before the bet date (tweet IDs encode their posting time).
    if (bet.tweet_url && isISODate(bet.date)) {
      const id = BigInt(bet.tweet_url.match(/status\/(\d+)/)[1]);
      const posted = new Date(Number((id >> 22n) + 1288834974657n)).toISOString().slice(0, 10);
      if (posted > bet.date) flag('mismatch', `Tweet was posted ${posted}, after the bet date ${bet.date}`);
    }

    // P/L cross-check (source P/L is never used as data)
    const srcPL = num(g('pl'));
    if (bet.stake_u > 0 && bet.odds >= 1.01 && bet.result) {
      const ours = computePL(bet.stake_u, bet.odds, bet.result);
      if (srcPL !== null && !isNaN(srcPL)) {
        sheetSum += srcPL;
        if (Math.abs(srcPL - ours) > 0.011) {
          if (c?.accept || overridden.length) flag('info', `Source P/L ${srcPL} vs computed ${ours} — resolved: ${c.why}`);
          else flag('mismatch', `Source P/L ${srcPL} ≠ computed ${ours} (${bet.stake_u}u @ ${bet.odds}, ${bet.result})`);
        }
      } else if (!['push', 'void', 'pending'].includes(bet.result)) {
        flag('info', `Source P/L cell blank — computed ${ours}`);
      }
    }
    const run = num(g('running'));
    if (run !== null && !isNaN(run)) lastRunning = run;
    bets.push(bet);
  }
  imported.push(...bets);

  const valid = bets.filter((b) => b.stake_u > 0 && b.odds >= 1.01 && b.result);
  const s = summarise(valid.map((b) => ({ ...b, pl_units: computePL(b.stake_u, b.odds, b.result) })));
  tabStats.push({
    tab, first: bets[0]?.date || '', count: bets.length, sheetSum: round2(sheetSum), s, lastRunning, panel,
    ourStakedAll: round2(valid.reduce((t, b) => t + b.stake_u, 0)),
  });
}

for (const k of Object.keys(CORR_ROWS)) if (!usedCorr.has(k)) flags.push({ key: k, level: 'error', msg: 'corrections.json entry matches no row' });

// Duplicates across sources
const seen = new Map();
for (const b of imported) {
  const sig = [b.date, b.fixture.toLowerCase(), b.bet.toLowerCase(), b.odds].join('|');
  if (seen.has(sig) && !CORR_ROWS[b._key]?.accept) flags.push({ key: b._key, level: 'mismatch', msg: `Looks like a duplicate of ${seen.get(sig)}` });
  else seen.set(sig, b._key);
}
// Tweets used twice (allowed when one post carried two plays — must be acknowledged)
const byTweet = new Map();
for (const b of imported) if (b.tweet_url) byTweet.set(b.tweet_url, [...(byTweet.get(b.tweet_url) || []), b._key]);
for (const [, keys] of byTweet) if (keys.length > 1 && !keys.every((k) => CORR_ROWS[k]?.accept || CORR_ROWS[k]?.tweet_url)) flags.push({ key: keys.join(' + '), level: 'mismatch', msg: 'Same pick tweet on more than one bet' });
const noTweet = imported.filter((b) => !b.tweet_url);

// ---------- report ----------
const errors = flags.filter((f) => f.level === 'error');
const mismatches = flags.filter((f) => f.level === 'mismatch');
const infos = flags.filter((f) => f.level === 'info');
const esc = (s) => String(s).replace(/\|/g, '\\|');
const table = (list) => (list.length ? '| Row | Issue |\n|---|---|\n' + list.map((f) => `| ${esc(f.key)} | ${esc(f.msg)} |`).join('\n') : '_None._');
const rec = (s) => `${s.wins}-${s.losses}${s.pushes ? `-${s.pushes}` : ''}`;
const totals =
  '| Source | Bets | Computed record | Computed P/L | Source P/L column sum | Panel record | Panel profit | Panel units staked | Computed staked (all / win+loss) |\n|---|---:|---|---:|---:|---|---:|---:|---:|\n' +
  tabStats.map((t) => `| ${t.tab} | ${t.count} | ${rec(t.s)} | ${t.s.pl.toFixed(2)} | ${t.sheetSum.toFixed(2)} | ${t.panel.record ?? '—'} | ${t.panel.profit ?? '—'} | ${t.panel['units staked'] ?? '—'} | ${t.ourStakedAll} / ${t.s.staked} |`).join('\n');
fs.writeFileSync(
  REPORT,
  `# Import report\n\nGenerated ${new Date().toISOString()} · ${sources.length} source file(s) · ${imported.length} bets.\n\n` +
    `## Totals cross-check\n\n${totals}\n\n` +
    `## ❌ Errors — must be fixed (${errors.length})\n\n${table(errors)}\n\n` +
    `## ⚠️ Must be resolved (${mismatches.length})\n\n${table(mismatches)}\n\n` +
    `## 🔗 Bets without a pick-tweet link (${noTweet.length})\n\n${noTweet.length ? noTweet.map((b) => `- ${b._key} · ${b.date} · ${esc(b.fixture)} — ${esc(b.bet)}`).join('\n') : '_None._'}\n\n` +
    `## ℹ️ Notes (${infos.length})\n\n${table(infos)}\n`,
);

console.log(`\nRead ${imported.length} bets from ${sources.length} file(s):`);
for (const t of tabStats) console.log(`  ${t.tab.padEnd(16)} ${String(t.count).padStart(3)} bets · ${rec(t.s).padEnd(8)} · computed ${fmtU(t.s.pl).padStart(8)} · source P/L sum ${t.sheetSum.toFixed(2)}${t.panel.profit ? ` · panel ${t.panel.record} ${t.panel.profit}` : ''}`);
console.log(`\n  ${errors.length} error(s) · ${mismatches.length} to resolve · ${noTweet.length} without tweet link · ${infos.length} note(s)  →  data/import/REPORT.md`);

// ---------- build the list ----------
// Chronological; within a day, sources in date order of their first bet, then row order.
const srcOrder = [...tabStats].sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0)).map((t) => t.tab);
const ordered = imported
  .filter((b) => b.stake_u > 0 && b.odds >= 1.01 && b.result && isISODate(b.date))
  .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : srcOrder.indexOf(sources[a._src].tab) - srcOrder.indexOf(sources[b._src].tab) || a._row - b._row))
  .map(({ _key, _src, _row, ...b }, i) => ({ id: i + 1, ...b }));

if (draft && !errors.length) {
  saveBets(ordered, DRAFT);
  console.log(`\n  Draft for local preview written to data/import/draft-bets.json (NOT the live record).`);
}
if (errors.length || mismatches.length) {
  console.log('\n✗ data/bets.json not written: resolve the flagged rows in data/import/corrections.json, then run "npm run import" again.');
  process.exit(1);
}
if (dryRun) {
  console.log('\n(dry run — nothing written)');
  process.exit(0);
}

let keep = [];
if (fs.existsSync(DATA_FILE)) {
  const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!replace) {
    console.log(`\n✗ data/bets.json already has ${existing.length} bets. To rebuild it from the import files: npm run import -- --replace`);
    process.exit(1);
  }
  keep = existing.filter((b) => !b.notes.startsWith('Imported from'));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question(`\n⚠️  This rebuilds data/bets.json: ${existing.length} bets now → ${ordered.length} imported + ${keep.length} added since. Type REPLACE to continue: `);
  rl.close();
  if (a.trim() !== 'REPLACE') {
    console.log('Cancelled.');
    process.exit(0);
  }
}
const kept = keep.sort(byChrono).map((b, i) => ({ ...b, id: ordered.length + i + 1 }));
const saved = saveBets([...ordered, ...kept]);
console.log(`\n✓ Wrote ${saved.length} bets to data/bets.json · total ${fmtU(round2(saved.reduce((t, b) => t + b.pl_units, 0)))}`);
