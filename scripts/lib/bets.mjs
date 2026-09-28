// Core data model: loading, validating, saving and summarising bets.
// Everything the site shows is derived from data/bets.json through this file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_FILE = path.join(ROOT, 'data', 'bets.json');
export const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

export const RESULTS = ['pending', 'win', 'loss', 'push', 'void'];
export const MARKET_TYPES = CONFIG.market_types;
export const FIELDS = ['id', 'date', 'league', 'fixture', 'market_type', 'bet', 'stake_u', 'odds', 'result', 'pl_units', 'tweet_url', 'notes'];

// ---------- P/L ----------

export function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** P/L in units, always derived from stake, odds and result. Never hand-entered. */
export function computePL(stake, odds, result) {
  if (result === 'win') return round2(stake * (odds - 1));
  if (result === 'loss') return round2(-stake);
  return 0; // push, void, pending
}

// ---------- Load / save / validate ----------

export function loadBets(file = DATA_FILE) {
  if (!fs.existsSync(file)) {
    throw new Error(`No data file at ${path.relative(ROOT, file)}. Run "npm run import" first.`);
  }
  const bets = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validate(bets);
  if (errors.length) {
    throw new Error(`Data file has problems:\n  - ${errors.join('\n  - ')}`);
  }
  return bets;
}

export function saveBets(bets, file = DATA_FILE) {
  const clean = bets.map(normalise).sort(byChrono);
  const errors = validate(clean);
  if (errors.length) throw new Error(`Refusing to save invalid data:\n  - ${errors.join('\n  - ')}`);
  // One bet per line: readable, and every change shows up as a clean one-line diff in git history.
  const body = '[\n' + clean.map((b) => '  ' + JSON.stringify(b)).join(',\n') + '\n]\n';
  fs.writeFileSync(file, body);
  return clean;
}

/** Fixed key order + recomputed P/L. */
export function normalise(b) {
  const stake = Number(b.stake_u);
  const odds = Number(b.odds);
  return {
    id: Number(b.id),
    date: b.date,
    league: String(b.league ?? '').trim(),
    fixture: String(b.fixture ?? '').trim(),
    market_type: b.market_type,
    bet: String(b.bet ?? '').trim(),
    stake_u: stake,
    odds,
    result: b.result,
    pl_units: computePL(stake, odds, b.result),
    tweet_url: String(b.tweet_url ?? '').trim(),
    notes: String(b.notes ?? '').trim(),
  };
}

export function validate(bets) {
  const errors = [];
  if (!Array.isArray(bets)) return ['data file must contain a list of bets'];
  const ids = new Set();
  for (const b of bets) {
    const tag = `bet #${b.id ?? '?'}`;
    if (!Number.isInteger(b.id) || b.id < 1) errors.push(`${tag}: id must be a positive whole number`);
    if (ids.has(b.id)) errors.push(`${tag}: duplicate id`);
    ids.add(b.id);
    if (!isISODate(b.date)) errors.push(`${tag}: date "${b.date}" must look like 2026-09-28`);
    if (!b.fixture) errors.push(`${tag}: fixture is empty`);
    if (!b.bet) errors.push(`${tag}: bet text is empty`);
    if (!MARKET_TYPES.includes(b.market_type)) errors.push(`${tag}: market_type "${b.market_type}" is not one of: ${MARKET_TYPES.join(', ')}`);
    if (!(typeof b.stake_u === 'number' && b.stake_u > 0)) errors.push(`${tag}: stake_u must be a number above 0`);
    if (!(typeof b.odds === 'number' && b.odds >= 1.01)) errors.push(`${tag}: odds must be decimal odds of 1.01 or more`);
    if (!RESULTS.includes(b.result)) errors.push(`${tag}: result "${b.result}" must be one of ${RESULTS.join('/')}`);
    if (typeof b.stake_u === 'number' && typeof b.odds === 'number' && b.pl_units !== computePL(b.stake_u, b.odds, b.result)) {
      errors.push(`${tag}: pl_units ${b.pl_units} does not match stake/odds/result (should be ${computePL(b.stake_u, b.odds, b.result)}). P/L is never hand-edited.`);
    }
    if (b.tweet_url && !isTweetUrl(b.tweet_url)) errors.push(`${tag}: tweet_url "${b.tweet_url}" is not an x.com / twitter.com status link`);
  }
  return errors;
}

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

export function isTweetUrl(s) {
  return /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/.test(s);
}

export function byChrono(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id;
}

export function nextId(bets) {
  return bets.reduce((m, b) => Math.max(m, b.id), 0) + 1;
}

export const isSettled = (b) => b.result !== 'pending';

// ---------- Dates (all date-only, handled in UTC so time zones never shift a bet) ----------

const D = (s) => new Date(s + 'T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Monday of the week containing this date (weeks run Monday–Sunday). */
export function weekStart(date) {
  const d = D(date);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return iso(d);
}
export function addDays(date, n) {
  const d = D(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export const dayLabel = (date) => DOW[D(date).getUTCDay()];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayName = (date) => DAY_FULL[D(date).getUTCDay()];
export const longDate = (date) => `${MONTH_FULL[D(date).getUTCMonth()]} ${D(date).getUTCDate()}`;
export const weekLabelLong = (monday) => `${longDate(monday)} – ${longDate(addDays(monday, 6))}`;
export const shortDate = (date) => `${MON[D(date).getUTCMonth()]} ${D(date).getUTCDate()}`;
export const weekLabel = (monday) => `${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`;
export const monthKey = (date) => date.slice(0, 7);
export const monthLabel = (key) => `${MONTH_FULL[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export const monthShort = (key) => `${MON[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

// ---------- Stats ----------

export function summarise(bets) {
  const s = { bets: bets.length, wins: 0, losses: 0, pushes: 0, voids: 0, pending: 0, staked: 0, pl: 0 };
  for (const b of bets) {
    if (b.result === 'win') s.wins++;
    else if (b.result === 'loss') s.losses++;
    else if (b.result === 'push') s.pushes++;
    else if (b.result === 'void') s.voids++;
    else s.pending++;
    // Staked = money actually at risk on settled bets. Push/void stakes are returned, so they don't count.
    if (b.result === 'win' || b.result === 'loss') s.staked += b.stake_u;
    s.pl += b.pl_units;
  }
  s.pl = round2(s.pl);
  s.staked = round2(s.staked);
  s.roi = s.staked ? (s.pl / s.staked) * 100 : null;
  s.winRate = s.wins + s.losses ? (s.wins / (s.wins + s.losses)) * 100 : null;
  s.streak = streak(bets);
  return s;
}

/** Current run of consecutive wins or losses, newest first. Pushes/voids don't break or extend a run. */
export function streak(bets) {
  const decided = bets.filter((b) => b.result === 'win' || b.result === 'loss').sort(byChrono).reverse();
  if (!decided.length) return null;
  const type = decided[0].result;
  let n = 0;
  for (const b of decided) {
    if (b.result !== type) break;
    n++;
  }
  return { type: type === 'win' ? 'W' : 'L', n };
}

export function groupBy(bets, keyFn) {
  const m = new Map();
  for (const b of bets) {
    const k = keyFn(b);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(b);
  }
  return m;
}

// ---------- Formatting ----------

export const fmtU = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}u`;
export const fmtPct = (x) => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`);
export const fmtRate = (x) => (x == null ? '—' : `${x.toFixed(1)}%`);
export const fmtOdds = (o) => (Math.round(o * 1000) % 10 ? o.toFixed(3) : o.toFixed(2));
export const fmtStake = (s) => `${Number.isInteger(s) ? s : s.toFixed(2).replace(/0$/, '')}u`;
export const record = (s) => `${s.wins}-${s.losses}${s.pushes ? `-${s.pushes}` : ''}`;
export const sign = (x) => (x > 0 ? 'pos' : x < 0 ? 'neg' : 'flat');
