// Small helpers shared by the bet:* commands.
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

let rl;
const lineQueue = [];
let closed = false;

function getRl() {
  if (!rl) {
    rl = readline.createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
    // Buffer lines ourselves so piped input (non-interactive) works as well as typing.
    if (!stdin.isTTY) {
      rl.on('line', (l) => lineQueue.push(l));
      rl.on('close', () => (closed = true));
    }
  }
  return rl;
}

export async function ask(question, def = '') {
  const r = getRl();
  const q = `${question}${def ? ` [${def}]` : ''}: `;
  let answer;
  if (stdin.isTTY) {
    answer = await r.question(q);
  } else {
    stdout.write(q);
    while (!lineQueue.length && !closed) await new Promise((res) => setTimeout(res, 10));
    answer = lineQueue.shift() ?? '';
    stdout.write(answer + '\n');
  }
  answer = answer.trim();
  return answer === '' ? def : answer;
}

export async function confirm(question, def = true) {
  const a = (await ask(`${question} (${def ? 'Y/n' : 'y/N'})`)).toLowerCase();
  return a === '' ? def : a.startsWith('y');
}

export function done() {
  rl?.close();
}

export function fail(msg) {
  console.error(`✗ ${msg}`);
  done();
  process.exit(1);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Accepts 2026-09-28, 28/09/2026 is NOT accepted (ambiguous) — but "today", "yesterday", "sat", "9-28" and "sep 28" are. */
export function parseDateInput(s, ref = today()) {
  s = s.trim().toLowerCase();
  const base = new Date(ref + 'T00:00:00Z');
  const fmt = (d) => d.toISOString().slice(0, 10);
  if (s === 'today' || s === '') return ref;
  if (s === 'yesterday') return fmt(new Date(base.getTime() - 864e5));
  if (s === 'tomorrow') return fmt(new Date(base.getTime() + 864e5));
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})-(\d{1,2})$/);
  if (m) return `${ref.slice(0, 4)}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})$/);
  if (m && MONTHS.includes(m[1])) return `${ref.slice(0, 4)}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const di = DAYS.indexOf(s.slice(0, 3));
  if (di >= 0 && /^[a-z]+$/.test(s)) {
    // Next occurrence of that weekday, today included (picks are posted before kickoff).
    const diff = (di - base.getUTCDay() + 7) % 7;
    return fmt(new Date(base.getTime() + diff * 864e5));
  }
  return null;
}

/** Turns "1u", "1.5", "0.5U" into a number. American odds (+150 / -110) are converted to decimal. */
export const parseStake = (s) => Number(String(s).replace(/u(nits?)?$/i, '').trim());
export function parseOdds(s) {
  s = String(s).trim().replace(/^@/, '');
  if (/^[+-]\d{3,}$/.test(s)) {
    const a = Number(s);
    return Math.round((a > 0 ? 1 + a / 100 : 1 + 100 / -a) * 1000) / 1000;
  }
  return Number(s);
}

export function parseResult(s) {
  s = String(s).trim().toLowerCase();
  if (['w', 'win', 'won', '✅'].includes(s)) return 'win';
  if (['l', 'loss', 'lose', 'lost', '❌'].includes(s)) return 'loss';
  if (['p', 'push'].includes(s)) return 'push';
  if (['v', 'void', 'voided'].includes(s)) return 'void';
  return null;
}
