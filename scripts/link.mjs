// npm run bet:link — attach a missing tweet link to a bet (allowed even after settling; a link is never swapped).
//   Interactive:  npm run bet:link
//   One line:     npm run bet:link -- 12 https://x.com/jokers_gambit/status/123

import { loadBets, saveBets, isTweetUrl, fmtOdds, shortDate } from './lib/bets.mjs';
import { ask, done, fail } from './lib/cli.mjs';
import { publish } from './lib/publish.mjs';

let bets;
try {
  bets = loadBets();
} catch (e) {
  fail(e.message);
}

const linked = [];
function link(id, url) {
  const b = bets.find((x) => x.id === id);
  if (!b) throw new Error(`There is no bet #${id}`);
  if (b.tweet_url) throw new Error(`Bet #${id} already has a tweet link (${b.tweet_url})`);
  url = String(url).trim().replace(/\?.*$/, '').replace('twitter.com', 'x.com');
  if (!isTweetUrl(url)) throw new Error(`"${url}" doesn't look like a tweet link (https://x.com/.../status/...)`);
  const other = bets.find((x) => x.tweet_url === url);
  if (other) console.log(`  ! Note: bet #${other.id} uses this same tweet.`);
  b.tweet_url = url;
  linked.push(b);
  console.log(`  ✓ #${b.id} linked`);
}

const args = process.argv.slice(2);
try {
  if (args.length) {
    for (let i = 0; i + 1 < args.length; i += 2) link(Number(String(args[i]).replace('#', '')), args[i + 1]);
  } else {
    const missing = bets.filter((b) => !b.tweet_url);
    console.log(`\n${missing.length} bet(s) without a tweet link. Paste the link for each, or press Enter to skip. Type "q" to stop.\n`);
    for (const b of missing) {
      console.log(`#${b.id}  ${shortDate(b.date)} ${b.date.slice(0, 4)}  ${b.fixture} — ${b.bet} @${fmtOdds(b.odds)}`);
      const url = await ask('  Tweet URL');
      if (url.toLowerCase() === 'q') break;
      if (!url) continue;
      try {
        link(b.id, url);
      } catch (e) {
        console.log(`  ${e.message}`);
      }
    }
  }
} catch (e) {
  fail(e.message);
}
done();

if (!linked.length) {
  console.log('No links added.');
  process.exit(0);
}
try {
  saveBets(bets);
  publish(`Link tweet${linked.length > 1 ? 's' : ''} for ${linked.map((b) => `#${b.id}`).join(', ')}`);
} catch (e) {
  fail(e.message);
}
