// npm run bet:settle
//   Interactive:  npm run bet:settle          (pick from the list of pending bets)
//   One line:     npm run bet:settle -- 72 w  (bet id + w / l / p / void; several: -- 72 w 73 l)

import { loadBets, saveBets, computePL, fmtU, fmtOdds, fmtStake, dayLabel, shortDate } from './lib/bets.mjs';
import { ask, confirm, done, fail, parseResult } from './lib/cli.mjs';
import { publish } from './lib/publish.mjs';

let bets;
try {
  bets = loadBets();
} catch (e) {
  fail(e.message);
}

const settled = [];
const line = (b) => `#${b.id}  ${dayLabel(b.date)} ${shortDate(b.date)}  ${b.fixture} — ${b.bet} @${fmtOdds(b.odds)} (${fmtStake(b.stake_u)})`;

function settle(id, res) {
  const b = bets.find((x) => x.id === id);
  if (!b) throw new Error(`There is no bet #${id}`);
  if (b.result !== 'pending') throw new Error(`Bet #${id} is already settled as ${b.result.toUpperCase()} — settled bets are never changed`);
  const result = parseResult(res);
  if (!result) throw new Error(`"${res}" is not a result — use w, l, p or void`);
  b.result = result;
  b.pl_units = computePL(b.stake_u, b.odds, result);
  settled.push(b);
  console.log(`  → #${b.id} ${result.toUpperCase()}  ${fmtU(b.pl_units)}`);
}

const args = process.argv.slice(2);
try {
  if (args.length) {
    if (args.length % 2) throw new Error('Give pairs of: bet id and result, e.g.  npm run bet:settle -- 72 w 73 l');
    for (let i = 0; i < args.length; i += 2) settle(Number(String(args[i]).replace('#', '')), args[i + 1]);
  } else {
    for (;;) {
      const pending = bets.filter((b) => b.result === 'pending');
      if (!pending.length) {
        console.log('\nNo pending bets.');
        break;
      }
      console.log('\nPending bets:');
      pending.forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}) ${line(b)}`));
      const pickRaw = await ask('\nWhich bet? (list number, or #id; Enter to finish)');
      if (!pickRaw) break;
      const b = pickRaw.startsWith('#') ? pending.find((x) => x.id === Number(pickRaw.slice(1))) : pending[Number(pickRaw) - 1];
      if (!b) {
        console.log('  Not in the list.');
        continue;
      }
      console.log(`  ${line(b)}`);
      const r = await ask('Result: w = win, l = loss, p = push, void');
      try {
        settle(b.id, r);
      } catch (e) {
        console.log(`  ${e.message}`);
      }
    }
  }
} catch (e) {
  fail(e.message);
}

if (!settled.length) {
  console.log('Nothing settled.');
  done();
  process.exit(0);
}

console.log('\nAbout to record:');
settled.forEach((b) => console.log(`  ${line(b)}  →  ${b.result.toUpperCase()} ${fmtU(b.pl_units)}`));
const ok = args.length ? true : await confirm('Settled bets can never be changed afterwards. Save and publish?');
done();
if (!ok) {
  console.log('Cancelled — nothing saved.');
  process.exit(0);
}

try {
  saveBets(bets);
  const msg = settled.length === 1
    ? `Settle #${settled[0].id}: ${settled[0].result.toUpperCase()} ${fmtU(settled[0].pl_units)}`
    : `Settle ${settled.map((b) => `#${b.id} ${b.result.toUpperCase()}`).join(', ')}`;
  publish(msg);
} catch (e) {
  fail(e.message);
}
