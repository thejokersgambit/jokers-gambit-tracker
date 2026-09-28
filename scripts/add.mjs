// npm run bet:add
//   Interactive:  npm run bet:add
//   One line:     npm run bet:add -- "2026-09-28 | EPL | Arsenal v Tottenham | Over 2.5 goals | 1 | 1.95 | https://x.com/jokers_gambit/status/123"
//                 (optional 8th field = market type, 9th = notes)

import { loadBets, saveBets, nextId, isISODate, isTweetUrl, MARKET_TYPES, fmtOdds, fmtStake } from './lib/bets.mjs';
import { ask, confirm, done, fail, today, parseDateInput, parseStake, parseOdds } from './lib/cli.mjs';
import { guessMarket } from './lib/markets.mjs';
import { publish } from './lib/publish.mjs';

let bets;
try {
  bets = loadBets();
} catch (e) {
  fail(e.message);
}

const last = bets[bets.length - 1];
const oneLine = process.argv.slice(2).join(' ').trim();
let b;

if (oneLine) {
  const parts = oneLine.split('|').map((s) => s.trim());
  if (parts.length < 7) fail('One-line format needs 7 parts separated by |  →  date | league | fixture | bet | stake | odds | tweet URL');
  const [date, league, fixture, bet, stake, odds, tweet_url, market, notes] = parts;
  b = { date: parseDateInput(date), league, fixture, bet, stake_u: parseStake(stake), odds: parseOdds(odds), tweet_url, market_type: market || guessMarket(bet), notes: notes || '' };
} else {
  console.log('\nNew bet — press Enter to accept the [default].\n');
  let date;
  while (!date) {
    date = parseDateInput(await ask('Date (YYYY-MM-DD, "today", "sat", "sep 28")', 'today'));
    if (!date || !isISODate(date)) { console.log('  Could not read that date, try e.g. 2026-09-28'); date = null; }
  }
  const league = await ask('League', last?.league);
  const fixture = await ask('Fixture (e.g. Arsenal v Tottenham)');
  const bet = await ask('Bet (e.g. Over 2.5 goals)');
  let stake_u;
  while (!(stake_u > 0)) stake_u = parseStake(await ask('Stake in units', '1'));
  let odds;
  while (!(odds >= 1.01)) odds = parseOdds(await ask('Odds (decimal, e.g. 1.95)'));
  let tweet_url = await ask('Tweet URL of the pick (Enter to skip, add later with bet:link)');
  const guess = guessMarket(bet);
  console.log(`  Market types: ${MARKET_TYPES.map((m, i) => `${i + 1}=${m}`).join('  ')}`);
  const m = await ask('Market type (number or name)', guess);
  const market_type = /^\d+$/.test(m) ? MARKET_TYPES[Number(m) - 1] : m;
  const notes = await ask('Notes (optional)');
  b = { date, league, fixture, bet, stake_u, odds, tweet_url, market_type, notes };
}

b.tweet_url = (b.tweet_url || '').replace(/\?.*$/, '').replace('twitter.com', 'x.com');
if (!b.date || !isISODate(b.date)) fail(`Could not read the date "${b.date}". Use YYYY-MM-DD.`);
if (!MARKET_TYPES.includes(b.market_type)) fail(`Market type "${b.market_type}" is not one of: ${MARKET_TYPES.join(', ')}`);
if (!(b.stake_u > 0)) fail('Stake must be a number above 0');
if (!(b.odds >= 1.01)) fail('Odds must be decimal odds of 1.01 or more (e.g. 1.95)');
if (b.tweet_url && !isTweetUrl(b.tweet_url)) fail(`"${b.tweet_url}" doesn't look like a tweet link (https://x.com/.../status/...)`);
const dupe = b.tweet_url && bets.find((x) => x.tweet_url === b.tweet_url);

const bet = { id: nextId(bets), ...b, result: 'pending' };
console.log(`
  #${bet.id}  ${bet.date}  ${bet.league}
  ${bet.fixture}
  ${bet.bet} @${fmtOdds(bet.odds)}  ·  ${fmtStake(bet.stake_u)}  ·  ${bet.market_type}
  ${bet.tweet_url || '(no tweet link yet)'}${bet.notes ? `\n  Notes: ${bet.notes}` : ''}
`);
if (dupe) console.log(`! Bet #${dupe.id} already uses this tweet link.`);
if (!bet.tweet_url) console.log('! No tweet link — the log will show "Tweet link missing" until you add it.');

if (!(await confirm('Add this bet as PENDING and publish?'))) {
  console.log('Cancelled — nothing saved.');
  done();
  process.exit(0);
}
done();

try {
  saveBets([...bets, bet]);
  console.log(`✓ Added bet #${bet.id}`);
  publish(`Add #${bet.id}: ${bet.fixture} — ${bet.bet} @${fmtOdds(bet.odds)} (${fmtStake(bet.stake_u)})`);
} catch (e) {
  fail(e.message);
}
