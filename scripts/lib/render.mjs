// HTML templates for the two pages. Plain strings, no framework.

import {
  CONFIG, summarise, groupBy, weekStart, weekLabel, weekLabelLong, dayLabel, dayName, shortDate, monthKey, monthLabel,
  fmtU, fmtPct, fmtRate, fmtOdds, fmtStake, record, sign, byChrono,
} from './bets.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const RESULT_LABEL = { pending: 'Pending', win: 'Win', loss: 'Loss', push: 'Push', void: 'Void' };

function layout({ title, description, path, body, sample, draft, builtAt, assetVersion }) {
  const url = `https://${CONFIG.domain}${path}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0a090d">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/jetbrains-mono-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css?v=${assetVersion}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:site" content="@${CONFIG.handle}">
</head>
<body>
${sample ? '<div class="sample-banner">SAMPLE DATA — design preview only, not real bets</div>' : ''}${draft ? '<div class="sample-banner">IMPORT DRAFT — local preview, not yet published</div>' : ''}
<header class="top">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">🃏</span><span class="brand-name">JOKER'S GAMBIT</span></a>
  <nav>
    <a href="/"${path === '/' ? ' aria-current="page"' : ''}>Dashboard</a>
    <a href="/log"${path === '/log' ? ' aria-current="page"' : ''}>Full log</a>
    <a href="${CONFIG.x_url}" rel="noopener">@${CONFIG.handle}</a>
  </nav>
</header>
<main>
${body}
</main>
<footer class="foot">
  <p class="foot-line">${esc(CONFIG.footer_line)}</p>
  <p class="foot-meta">
    Raw data: <a href="/bets.csv">CSV</a> · <a href="/bets.json">JSON</a>${CONFIG.repo_url ? ` · <a href="${esc(CONFIG.repo_url)}/commits/main/data/bets.json" rel="noopener">change history</a>` : ''}
    · Updated ${esc(builtAt)}
  </p>
  <p class="foot-meta">Units P/L is computed from stake, odds and result — never typed by hand. 18+. Bet responsibly.</p>
</footer>
</body>
</html>
`;
}

/** X status IDs encode their posting time, so this is derived from the link itself, not typed in. */
export function tweetPostedAt(url) {
  const m = String(url).match(/status\/(\d+)/);
  if (!m) return null;
  return new Date(Number((BigInt(m[1]) >> 22n) + 1288834974657n));
}
const postedText = (url) => {
  const d = tweetPostedAt(url);
  return d ? d.toLocaleString('en-US', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';
};

const tweetLink = (b, cls = '') =>
  b.tweet_url
    ? `<a class="tw ${cls}" href="${esc(b.tweet_url)}" rel="noopener" aria-label="View pick #${b.id} on X">View pick on X ↗</a><span class="tw-time">posted ${esc(postedText(b.tweet_url))}</span>`
    : `<span class="tw tw-missing ${cls}" title="Tweet link not yet attached to this row">Tweet link missing</span>`;

const plCell = (b, inLog = false) =>
  b.result === 'pending'
    ? `<span class="pl pl-pending">${inLog ? '—' : 'PENDING'}</span>`
    : inLog
      ? `<span class="pl pl-${sign(b.pl_units)}">${fmtU(b.pl_units)}</span>`
    : b.result === 'push' || b.result === 'void'
      ? `<span class="pl pl-flat">${b.result.toUpperCase()}</span>`
      : `<span class="pl pl-${sign(b.pl_units)}">${fmtU(b.pl_units)}</span>`;

// ---------- Dashboard ----------

export function renderDashboard(bets, opts) {
  const all = [...bets].sort(byChrono);
  const season = all.filter((b) => b.date >= CONFIG.season_start);
  const S = summarise(season);
  const A = summarise(all);

  const weeks = groupBy(all, (b) => weekStart(b.date));
  const weekKeys = [...weeks.keys()].sort().reverse();
  const currentKey = weekKeys[0];
  const current = currentKey ? weeks.get(currentKey) : [];
  const W = summarise(current);

  const months = groupBy(all, (b) => monthKey(b.date));
  const monthKeys = [...months.keys()].sort().reverse();

  const streakTxt = S.streak ? `${S.streak.type}${S.streak.n}` : '—';
  const streakCls = S.streak ? (S.streak.type === 'W' ? 'pos' : 'neg') : 'flat';

  const headline = `
<section class="hero" aria-labelledby="h-season">
  <h1 id="h-season" class="eyebrow">${esc(CONFIG.season_label)}</h1>
  <div class="hero-grid">
    <div class="stat stat-main">
      <span class="stat-k">Units P/L</span>
      <span class="stat-v ${sign(S.pl)}">${fmtU(S.pl)}</span>
      <span class="stat-sub">${S.bets} bets · ${S.staked.toFixed(2)}u staked${S.pending ? ` · ${S.pending} pending` : ''}</span>
    </div>
    <div class="stat"><span class="stat-k">Record</span><span class="stat-v rec"><b class="pos">${S.wins}</b>-<b class="neg">${S.losses}</b>${S.pushes ? `-<b class="flat">${S.pushes}</b>` : ''}</span><span class="stat-sub">W-L${S.pushes ? '-P' : ''}${S.voids ? ` · ${S.voids} void` : ''}</span></div>
    <div class="stat"><span class="stat-k">ROI</span><span class="stat-v ${S.roi == null ? 'flat' : sign(S.roi)}">${fmtPct(S.roi)}</span><span class="stat-sub">P/L ÷ staked</span></div>
    <div class="stat"><span class="stat-k">Win rate</span><span class="stat-v gold">${fmtRate(S.winRate)}</span><span class="stat-sub">wins ÷ decided</span></div>
    <div class="stat"><span class="stat-k">Streak</span><span class="stat-v ${streakCls}">${streakTxt}</span><span class="stat-sub">current run</span></div>
  </div>
  ${all.length !== season.length ? `<p class="alltime">All-time (incl. before ${esc(shortDate(CONFIG.season_start))} ${CONFIG.season_start.slice(0, 4)}): ${A.bets} bets · ${record(A)} · <b class="${sign(A.pl)}">${fmtU(A.pl)}</b> · ROI ${fmtPct(A.roi)}</p>` : ''}
</section>`;

  // Centrepiece: one "sheet" — title bar, this week's bets, week total, then every past week underneath
  // in the same columns (modelled on the reference weekly sheet).
  const weekRows = current
    .map(
      (b) => `
    <li class="wk-row r-${b.result}">
      <span class="wk-day"><span class="d-long">${dayName(b.date)}</span><span class="d-short">${dayLabel(b.date)}</span></span>
      <span class="wk-bet">
        <span class="wk-text">${esc(b.bet)} <span class="odds">@${fmtOdds(b.odds)}</span></span>
        <span class="wk-meta">${esc(b.fixture)} · ${esc(b.league)}${b.tweet_url ? ` · <a href="${esc(b.tweet_url)}" rel="noopener" aria-label="Pick #${b.id} on X">tweet ↗</a>` : ''}</span>
      </span>
      <span class="pill">${fmtStake(b.stake_u)}</span>
      ${plCell(b)}
    </li>`,
    )
    .join('');

  const history = weekKeys
    .slice(1)
    .map((k) => {
      const s = summarise(weeks.get(k));
      return `
      <li><a href="/log?week=${k}" class="wk-hist" aria-label="Week of ${weekLabel(k)}: ${fmtU(s.pl)}, record ${record(s)}">
        <span class="hist-range">${weekLabel(k)}</span>
        <span class="hist-rec">${record(s)}${s.pending ? ` ·${s.pending}p` : ''}</span>
        <span class="pl pl-${sign(s.pl)}">${fmtU(s.pl)}</span>
      </a></li>`;
    })
    .join('');

  const weekTable = currentKey
    ? `
<section class="week" aria-labelledby="h-week">
  <div class="sec-head">
    <h2>Current week</h2>
    <span class="sec-note">${record(W)}${W.pending ? ` · ${W.pending} pending` : ''}</span>
  </div>
  <div class="wk-table">
    <h3 class="wk-title" id="h-week">${weekLabelLong(currentKey)}</h3>
    <div class="wk-cols" aria-hidden="true"><span></span><span>Bet</span><span>Units</span><span>P/L</span></div>
    <ol class="wk-list">${weekRows}
    </ol>
    <div class="wk-total">
      <span class="wk-day">Week</span>
      <span class="wk-bet"><span class="wk-text">${current.length} bet${current.length === 1 ? '' : 's'} · ROI ${fmtPct(W.roi)}</span></span>
      <span class="pill pill-total">${fmtStake(current.reduce((t, b) => t + b.stake_u, 0))}</span>
      <span class="pl pl-${sign(W.pl)}">${fmtU(W.pl)}</span>
    </div>
    ${history ? `<h3 class="wk-divider" id="h-hist">Past weeks <span>Mon–Sun · tap a week to see its bets</span></h3>
    <ol class="wk-hist-list" aria-labelledby="h-hist">${history}
    </ol>` : ''}
  </div>
</section>`
    : `<section class="week"><p class="empty">No bets recorded yet.</p></section>`;

  const monthCards = monthKeys
    .map((k) => {
      const s = summarise(months.get(k));
      return `<li class="mcard"><a href="/log?month=${k}">
        <span class="mcard-name">${monthLabel(k)}</span>
        <span class="mcard-pl ${sign(s.pl)}">${fmtU(s.pl)}</span>
        <span class="mcard-row"><span>Record</span><b>${record(s)}</b></span>
        <span class="mcard-row"><span>ROI</span><b class="${s.roi == null ? '' : sign(s.roi)}">${fmtPct(s.roi)}</b></span>
        <span class="mcard-row"><span>Bets</span><b>${s.bets}${s.pending ? ` (${s.pending} pending)` : ''}</b></span>
      </a></li>`;
    })
    .join('');

  const body = `${headline}
${weekTable}
<section aria-labelledby="h-months"><div class="sec-head"><h2 id="h-months">By month</h2></div><ul class="months">${monthCards}</ul></section>
<a class="cta" href="/log">Full log — all ${all.length} bets, each linked to its pick tweet →</a>`;

  return layout({
    ...opts,
    title: `Joker's Gambit — Verified betting record`,
    description: `${CONFIG.season_label}: ${record(S)}, ${fmtU(S.pl)}, ROI ${fmtPct(S.roi)}. ${CONFIG.tagline}`,
    path: '/',
    body,
  });
}

// ---------- Full log ----------

export function renderLog(bets, opts) {
  const all = [...bets].sort(byChrono).reverse();
  const uniq = (fn) => [...new Set(all.map(fn))];
  const months = uniq((b) => monthKey(b.date)).sort().reverse();
  const leagues = uniq((b) => b.league).sort((a, b) => a.localeCompare(b));
  const markets = uniq((b) => b.market_type).sort((a, b) => a.localeCompare(b));
  const S = summarise(all);

  const select = (name, label, options) => `
    <label class="f"><span>${label}</span><select name="${name}" data-filter="${name}"><option value="">All</option>${options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`;

  const rows = all
    .map(
      (b) => `
  <li class="lg-row r-${b.result}" id="bet-${b.id}" data-month="${monthKey(b.date)}" data-week="${weekStart(b.date)}" data-league="${esc(b.league)}" data-market="${esc(b.market_type)}" data-result="${b.result}" data-stake="${b.stake_u}" data-pl="${b.pl_units}">
    <div class="lg-top">
      <a class="lg-id" href="#bet-${b.id}">#${b.id}</a>
      <span class="lg-date">${dayLabel(b.date)} ${shortDate(b.date)} ${b.date.slice(0, 4)}</span>
      <span class="lg-league">${esc(b.league)}</span>
      <span class="lg-market">${esc(b.market_type)}</span>
    </div>
    <div class="lg-fixture">${esc(b.fixture)}</div>
    <div class="lg-bet">${esc(b.bet)} <span class="odds">@${fmtOdds(b.odds)}</span> <span class="pill">${fmtStake(b.stake_u)}</span></div>
    <div class="lg-res"><span class="res res-${b.result}">${RESULT_LABEL[b.result]}</span>${plCell(b, true)}</div>
    ${b.notes ? `<div class="lg-notes">${esc(b.notes)}</div>` : ''}
    <div class="lg-tw">${tweetLink(b)}</div>
  </li>`,
    )
    .join('');

  const body = `
<section class="log-head">
  <h1>Full log</h1>
  <p class="lede">Every bet, newest first. Each row links to the pick as it was posted on X before kickoff — check the timestamp against the fixture.</p>
</section>
<form class="filters" id="filters" role="search">
  ${select('month', 'Month', months.map((m) => [m, monthLabel(m)]))}
  ${select('league', 'League', leagues.map((l) => [l, l]))}
  ${select('market', 'Market', markets.map((m) => [m, m]))}
  ${select('result', 'Result', ['pending', 'win', 'loss', 'push', 'void'].map((r) => [r, RESULT_LABEL[r]]))}
  <input type="hidden" name="week" data-filter="week">
  <p class="week-chip" id="week-chip" hidden>Week of <b id="week-chip-label"></b> <button type="button" id="week-clear" aria-label="Clear week filter">×</button></p>
</form>
<p class="log-sum" id="log-sum" aria-live="polite">${S.bets} bets · ${record(S)} · <b class="${sign(S.pl)}">${fmtU(S.pl)}</b> · ROI ${fmtPct(S.roi)}</p>
<ol class="lg-list" id="log">${rows}
</ol>
<p class="empty" id="log-empty" hidden>No bets match these filters.</p>
<script src="/log.js?v=${opts.assetVersion}" defer></script>`;

  return layout({
    ...opts,
    title: `Full log — Joker's Gambit`,
    description: `All ${S.bets} Joker's Gambit bets, each linked to its pick tweet. ${record(S)}, ${fmtU(S.pl)}.`,
    path: '/log',
    body,
  });
}

// ---------- CSV export ----------

export function toCSV(bets, fields) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [fields.join(','), ...[...bets].sort(byChrono).map((b) => fields.map((f) => cell(b[f])).join(','))].join('\n') + '\n';
}
