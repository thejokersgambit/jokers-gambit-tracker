// Builds the static site into dist/.
//   npm run build            -> uses data/bets.json (the real record)
//   npm run preview:sample   -> uses data/sample/bets.json with a SAMPLE banner (never deployed)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DATA_FILE, FIELDS, loadBets } from './lib/bets.mjs';
import { renderDashboard, renderLog, toCSV } from './lib/render.mjs';

export function build({ sample = false, draft = false } = {}) {
  const dataFile = sample ? path.join(ROOT, 'data', 'sample', 'bets.json') : draft ? path.join(ROOT, 'data', 'import', 'draft-bets.json') : DATA_FILE;
  const bets = loadBets(dataFile);
  const out = path.join(ROOT, 'dist');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'log'), { recursive: true });

  // Static assets
  fs.cpSync(path.join(ROOT, 'site'), out, { recursive: true });
  const css = fs.readFileSync(path.join(ROOT, 'site', 'style.css'));
  const js = fs.readFileSync(path.join(ROOT, 'site', 'log.js'));
  const assetVersion = crypto.createHash('sha1').update(css).update(js).digest('hex').slice(0, 8);

  const builtAt = new Date().toLocaleString('en-GB', {
    timeZone: 'America/Toronto', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
  const opts = { sample, draft, builtAt, assetVersion };

  fs.writeFileSync(path.join(out, 'index.html'), renderDashboard(bets, opts));
  fs.writeFileSync(path.join(out, 'log', 'index.html'), renderLog(bets, opts));
  fs.writeFileSync(path.join(out, 'bets.csv'), toCSV(bets, FIELDS));
  fs.copyFileSync(dataFile, path.join(out, 'bets.json'));
  return { count: bets.length, out };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build.mjs')) {
  try {
    const { count } = build({ sample: process.argv.includes('--sample'), draft: process.argv.includes('--draft') });
    console.log(`✓ Built site from ${count} bets → dist/`);
  } catch (e) {
    console.error(`✗ Build failed: ${e.message}`);
    process.exit(1);
  }
}
