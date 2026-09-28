// Integrity rules enforced before anything is published:
//   1. A settled bet is never altered (only exception: attaching a missing tweet link).
//   2. A bet is never removed.
//   3. A settled bet never goes back to pending.
// "Before" is the last committed version of data/bets.json in git.

import { spawnSync } from 'node:child_process';
import { ROOT } from './bets.mjs';

export function git(args, { quiet = true } = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
  if (r.error) throw new Error('git is not installed or not on PATH');
  return r;
}

export const isRepo = () => git(['rev-parse', '--is-inside-work-tree']).stdout?.trim() === 'true';

export function committedBets() {
  const r = git(['show', 'HEAD:data/bets.json']);
  if (r.status !== 0) return null; // nothing committed yet
  return JSON.parse(r.stdout);
}

const LOCKED = ['date', 'league', 'fixture', 'market_type', 'bet', 'stake_u', 'odds', 'result', 'pl_units', 'notes'];

export function guard(current, previous) {
  if (!previous) return [];
  const errors = [];
  const byId = new Map(current.map((b) => [b.id, b]));
  const prevMax = previous.reduce((m, b) => Math.max(m, b.id), 0);
  for (const old of previous) {
    const now = byId.get(old.id);
    if (!now) {
      errors.push(`bet #${old.id} (${old.fixture}) has been removed — bets are never dropped`);
      continue;
    }
    if (old.result === 'pending') continue;
    if (now.result === 'pending') errors.push(`bet #${old.id} was settled as ${old.result} and has been set back to pending`);
    for (const f of LOCKED) {
      if (JSON.stringify(old[f]) !== JSON.stringify(now[f])) {
        errors.push(`bet #${old.id} is settled; its ${f} changed from ${JSON.stringify(old[f])} to ${JSON.stringify(now[f])}`);
      }
    }
    if (old.tweet_url && old.tweet_url !== now.tweet_url) {
      errors.push(`bet #${old.id} is settled; its tweet_url changed (a link can be added once, never swapped)`);
    }
  }
  for (const b of current) {
    if (!previous.some((o) => o.id === b.id) && b.id <= prevMax) {
      errors.push(`bet #${b.id} is new but reuses an id at or below the last published id (${prevMax})`);
    }
  }
  return errors;
}
