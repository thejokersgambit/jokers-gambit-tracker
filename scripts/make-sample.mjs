// Generates FAKE bets in data/sample/bets.json for design previews only. Never used for the live site.
import path from 'node:path';
import { ROOT, saveBets, addDays } from './lib/bets.mjs';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const games = [
  ['EPL', 'Arsenal v Tottenham'], ['EPL', 'Liverpool v Chelsea'], ['EPL', 'Man City v Newcastle'], ['EPL', 'Aston Villa v Brighton'],
  ['La Liga', 'Real Madrid v Sevilla'], ['La Liga', 'Barcelona v Villarreal'], ['Serie A', 'Inter v Roma'], ['Serie A', 'Napoli v Atalanta'],
  ['Bundesliga', 'Leverkusen v Dortmund'], ['Ligue 1', 'PSG v Lyon'], ['UCL', 'Bayern v Benfica'], ['MLS', 'Toronto FC v Inter Miami'],
];
const markets = [
  ['BTTS', () => 'BTTS — Yes'], ['over/under', () => `Over ${pick(['2.5', '3.5', '1.5'])} goals`],
  ['team total', (f) => `${f.split(' v ')[0]} over 1.5 team goals`], ['player prop', () => `${pick(['Saka', 'Salah', 'Haaland', 'Kane', 'Lautaro'])} anytime scorer`],
  ['parlay/SGP', (f) => `SGP: ${f.split(' v ')[0]} win + over 2.5`], ['handicap', (f) => `${f.split(' v ')[1]} +1.5 AH`],
];

const bets = [];
let id = 1;
for (let d = '2026-06-12'; d <= '2026-09-28'; d = addDays(d, 1)) {
  if (d > '2026-07-19' && d < '2026-08-15') continue; // off-season gap
  const n = rnd() < 0.45 ? 0 : rnd() < 0.7 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const wc = d <= '2026-07-19';
    const [league, fixture] = wc ? ['World Cup', pick(['Canada v Mexico', 'Brazil v Japan', 'France v USA', 'England v Morocco'])] : pick(games);
    const [market_type, betFn] = pick(markets);
    const odds = Math.round((market_type === 'parlay/SGP' ? 3 + rnd() * 3 : 1.6 + rnd() * 1.2) * 100) / 100;
    const r = rnd();
    const result = d >= '2026-09-27' ? 'pending' : r < 0.52 ? 'win' : r < 0.94 ? 'loss' : r < 0.97 ? 'push' : 'void';
    bets.push({
      id: id++, date: d, league, fixture, market_type, bet: betFn(fixture), stake_u: pick([1, 1, 1, 0.5, 2]), odds, result,
      tweet_url: `https://x.com/jokers_gambit/status/${1800000000000000000 + id}`, notes: '',
    });
  }
}
saveBets(bets, path.join(ROOT, 'data', 'sample', 'bets.json'));
console.log(`Wrote ${bets.length} fake bets to data/sample/bets.json`);
