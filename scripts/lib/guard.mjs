// Small git helpers for the publish step.

import { spawnSync } from 'node:child_process';
import { ROOT } from './bets.mjs';

export function git(args, { quiet = true } = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
  if (r.error) throw new Error('git is not installed or not on PATH');
  return r;
}

export const isRepo = () => git(['rev-parse', '--is-inside-work-tree']).stdout?.trim() === 'true';
