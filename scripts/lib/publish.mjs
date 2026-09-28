// Check → build → commit → push. Used by bet:add, bet:settle, bet:link and npm run publish.

import { loadBets } from './bets.mjs';
import { git, isRepo, committedBets, guard } from './guard.mjs';
import { build } from '../build.mjs';

export function check() {
  const bets = loadBets(); // throws on schema / P/L problems
  const errors = isRepo() ? guard(bets, committedBets()) : [];
  if (errors.length) {
    throw new Error(
      `Integrity check failed — nothing was published:\n  - ${errors.join('\n  - ')}\n` +
        `\nTo undo your local change to the data file, run:  git checkout data/bets.json`,
    );
  }
  return bets;
}

export function publish(message) {
  check();
  build();
  console.log('✓ Checked and rebuilt the site');

  if (!isRepo()) {
    console.log('! This folder is not connected to git yet, so nothing was uploaded. (See README → First-time setup.)');
    return false;
  }
  git(['add', 'data']);
  const staged = git(['diff', '--cached', '--quiet']).status !== 0;
  if (staged) {
    const c = git(['commit', '-m', message || 'Update bets']);
    if (c.status !== 0) throw new Error(`git commit failed:\n${c.stderr || c.stdout}`);
    console.log(`✓ Saved to history: "${message}"`);
  }
  const hasRemote = git(['remote']).stdout.trim().length > 0;
  if (!hasRemote) {
    console.log('! No GitHub remote set up yet, so nothing was uploaded. (See README → First-time setup.)');
    return false;
  }
  console.log('… Uploading to GitHub');
  const p = git(['push'], { quiet: true });
  if (p.status !== 0) {
    console.log(`✗ Upload failed (are you online?). Your change is saved on this computer.\n  Run "npm run publish" to retry.\n\n${(p.stderr || '').trim()}`);
    return false;
  }
  console.log('✓ Uploaded. The live site updates in about a minute.');
  return true;
}
