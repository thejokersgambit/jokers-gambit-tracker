# Joker's Gambit tracker — notes for Claude

## Odds rule

- The odds for every bet are the **price as posted on X**, normally American (e.g. `-114`, `+105`), not the decimal on the bookmaker's slip. The owner's slips are decimal (UK bookmaker) and can differ slightly from the posted price, because American odds are rounded to a whole number. A few early posts give a decimal instead (e.g. `2.61x`); use that decimal as posted.
- Before adding a bet, open the X post and read the posted price from it. Enter the posted American price directly in `npm run bet:add`; the add script already converts `+105` / `-114` to decimal at three places.
- If the owner only sends a slip, ask them for the posted American price rather than using the slip's decimal.
- Units (`pl_units`) stay computed from stake, odds and result, rounded to two places per bet. Never typed by hand.
- The site shows odds as American, worked out from the stored decimal (`fmtAmerican`).

## Notes

- Notes never appear on the website: not on the log, the weekly sheet, the recap images, or the `bets.csv` / `bets.json` downloads. They stay only in `data/bets.json` as private working notes.
- Don't add notes to the site, and don't add a notes column or field to anything public.
