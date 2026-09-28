// Best-guess market type from the bet text. The add command always shows the guess so it can be corrected.
const RULES = [
  ['parlay/SGP', /\b(sgp|parlay|acca|accumulator|bet ?builder|same.?game|treble|double(?! chance)|\d+-?fold|\d+ ?leg)\b|\s\+\s|&/i],
  ['team total', /\b(team total|tt|team goals|team shots|team over|team under)\b/i],
  ['player prop', /\b(anytime|first goalscorer|last goalscorer|scorer|goalscorer|shots?|sot|assists?|to be booked|carded|card|saves|tackles|fouls|passes|header)\b/i],
  ['BTTS', /\b(btts|both teams to score|gg)\b/i],
  ['handicap', /\b(handicap|ah|spread|eh)\b|(^|\s)[+-]\d+(\.\d+)?(\s|$)/i],
  ['double chance', /\b(double chance|dc|1x|x2|win or draw)\b/i],
  ['over/under', /\b(over|under|o\d|u\d|total goals|goals? over|corners?)\b/i],
  ['match result', /\b(ml|moneyline|to win|win|draw|dnb|draw no bet|1x2)\b/i],
];

export function guessMarket(text) {
  for (const [type, re] of RULES) if (re.test(text)) return type;
  return 'other';
}
