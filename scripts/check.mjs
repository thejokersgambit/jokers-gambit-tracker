import { check } from './lib/publish.mjs';
import { summarise, record, fmtU, fmtPct } from './lib/bets.mjs';

try {
  const bets = check();
  const s = summarise(bets);
  const missing = bets.filter((b) => !b.tweet_url).length;
  console.log(`✓ ${bets.length} bets OK — ${record(s)}, ${fmtU(s.pl)}, ROI ${fmtPct(s.roi)}, ${s.pending} pending`);
  if (missing) console.log(`! ${missing} bet(s) have no tweet link yet — add them with: npm run bet:link`);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
