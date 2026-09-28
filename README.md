# 🃏 Joker's Gambit — public bet record

The site at **thejokersgambit.com**. Every bet posted before kickoff, every bet on the sheet — audit any row.

- All bets live in one file: `data/bets.json`. The site is rebuilt from it every time you publish.
- You never edit that file by hand. You use the three commands below.
- P/L is always calculated from stake × odds × result. Nobody types it in.
- Once a bet is settled it's locked. A settled bet can't be changed or deleted — the publish step refuses.
- Every change is saved to a public, timestamped history on GitHub. That history is the proof.

All commands are typed in **Terminal** (Mac) or **PowerShell** (Windows), inside this folder.
To open Terminal in this folder on a Mac: open Terminal, type `cd ` (with a space), drag the `jg-tracker` folder onto the window, press Enter.

---

## Daily workflow

### 1. Post the pick on X, then add it

```
npm run bet:add
```

It asks for each piece in turn: date, league, fixture, bet, stake, odds, tweet URL, market type (it guesses — press Enter to accept), notes.
Press Enter to accept anything in `[brackets]`. For the date you can type `today`, `sat`, `sep 28` or `2026-09-28`.

**Faster — all on one line** (fields separated by `|`, in this order: date | league | fixture | bet | stake | odds | tweet URL):

```
npm run bet:add -- "today | EPL | Arsenal v Tottenham | Over 2.5 goals | 1 | 1.95 | https://x.com/jokers_gambit/status/1234567890"
```

It shows you the bet, asks "Add this bet as PENDING and publish?", and when you press Enter the live site updates within about a minute.

### 2. After the match, settle it

```
npm run bet:settle
```

It lists your pending bets. Type the list number, then `w` (win), `l` (loss), `p` (push) or `void`. Settle as many as you like, press Enter on an empty line to finish, and confirm. P/L is calculated for you.

One-liner: `npm run bet:settle -- 72 w` (bet #72 won). Several at once: `npm run bet:settle -- 72 w 73 l 74 p`.

### 3. Forgot the tweet link?

```
npm run bet:link
```

It walks through every bet that has no tweet link and lets you paste each one. A link can be added to a settled bet, but never swapped for a different one.

**That's it.** Each command saves, checks, rebuilds and uploads by itself. You never touch git.

---

## Recap images for X / Instagram

```
npm run recap:week
npm run recap:month
```

Each makes a 1200×675 PNG in the `exports/` folder (it opens with Finder → jg-tracker → exports).
By default you get the latest week or month. For a specific one:

```
npm run recap:week -- 2026-09-14
npm run recap:month -- 2026-08
```

(Any date inside the week works. Weeks run Monday to Sunday.)

---

## Other commands

| Command | What it does |
|---|---|
| `npm run check` | Checks the data file is valid and nothing settled has been changed. Changes nothing. |
| `npm run publish` | Re-uploads. Use it if a command said "Upload failed" (e.g. you were offline). |
| `npm run dev` | Preview the site on your own computer at http://localhost:4321 (press Ctrl+C to stop). |
| `npm run preview:sample` | Preview the design with obviously fake data (red "SAMPLE" banner). Never goes live. |
| `npm run import` | One-time migration from the old Google Sheet. See "Migration" below. |

---

## Rules the system enforces

The publish step compares your change against the last published version and **refuses** if:

- a settled bet's date, fixture, bet, stake, odds, result, P/L or notes changed,
- a settled bet went back to pending,
- a bet was removed,
- a P/L number doesn't match stake × odds × result.

If you ever see "Integrity check failed", nothing went live. To throw away the bad local change:

```
git checkout data/bets.json
```

**P/L maths:** win = stake × (odds − 1); loss = −stake; push / void / pending = 0.
**ROI** = total P/L ÷ units staked on settled win/loss bets (push and void stakes come back, so they don't count).
**Win rate** = wins ÷ (wins + losses). **Streak** = current run of wins or losses (pushes and voids are skipped).
**Season** starts on the date in `site.config.json` (`season_start`). Bets before it still count in "All-time" and the log.

---

## If something goes wrong

| You see | Do this |
|---|---|
| `npm: command not found` | Node isn't installed. Install the LTS version from https://nodejs.org |
| `Upload failed (are you online?)` | Your change is saved on this computer. Reconnect and run `npm run publish`. |
| `Integrity check failed` | Read the message. Nothing went live. Undo with `git checkout data/bets.json`. |
| `Cannot find module 'satori'` (recap only) | Run `npm install` once. |
| The live site didn't change | Wait 1–2 minutes. Then check vercel.com → your project → Deployments for a red ✗. |
| You settled a bet wrong | It's locked by design. Don't edit the file. Post a correction on X, and ask a developer to add a clearly marked correction note. |

---

## First-time setup (done once)

### A. GitHub (stores the data and its public history)

1. Create an account at https://github.com if you don't have one.
2. Install the GitHub command-line tool from https://cli.github.com (Mac: download the macOS installer, open it, click through).
3. In Terminal, run `gh auth login` and pick: **GitHub.com → HTTPS → Yes (authenticate Git) → Login with a web browser**. Copy the code it shows, press Enter, paste the code in the browser, approve.
4. Then the repo gets created and uploaded (Claude did this for you during setup):
   `gh repo create jokers-gambit-tracker --public --source . --push`

The repo should be **public**. That's the point: anyone can open `data/bets.json` on GitHub → "History" and see every bet was added before kickoff and never touched after settling.

### B. Vercel (hosts the website, free)

1. Go to https://vercel.com and sign in **with GitHub**, or connect GitHub under Account Settings → Authentication.
2. Make sure the scope switcher (top-left) says **jokers-gambit**.
3. Click **Add New… → Project**. Under "Import Git Repository", click **Install** / **Adjust GitHub App Permissions** if the repo isn't listed. Give it access to `jokers-gambit-tracker`.
4. Click **Import** next to `jokers-gambit-tracker`. Leave every setting as it is — this repo's `vercel.json` already tells Vercel what to do. Click **Deploy**.
5. In about 30 seconds you get a `…vercel.app` link. That's the live site. From now on every command above updates it automatically.

### C. Custom domain (thejokersgambit.com at Porkbun)

**In Vercel:** Project → **Settings → Domains** → type `thejokersgambit.com` → **Add**. Choose the recommended option (add `thejokersgambit.com` and redirect `www` to it). Vercel then shows the DNS records it wants — **if they differ from the ones below, use Vercel's.**

**In Porkbun:** log in → **Domain Management** → hover `thejokersgambit.com` → **DNS** (or "Details" → "DNS Records").

1. **Delete** Porkbun's default parking records first: any `ALIAS` or `CNAME` pointing at `uixie.porkbun.com` / `pixie.porkbun.com`, and any `A` record on the bare domain.
2. Add:

| Type | Host | Answer / Value | TTL |
|---|---|---|---|
| `A` | *(leave blank)* | `76.76.21.21` | 600 |
| `CNAME` | `www` | `cname.vercel-dns.com` | 600 |

3. Leave Porkbun's nameservers as they are, and turn off any "URL Forwarding" for the domain.

Back in Vercel → Domains, both entries turn green within minutes (worst case a few hours). HTTPS is set up automatically.

---

## Moving to a Windows PC

1. Install **Node.js LTS** (https://nodejs.org), **Git for Windows** (https://git-scm.com) and the **GitHub CLI** (https://cli.github.com).
2. Open PowerShell and run `gh auth login` (same answers as above), then:
   ```
   gh repo clone jokers-gambit-tracker
   cd jokers-gambit-tracker
   npm install
   ```
3. Everything else is identical. Nothing here is Mac-specific.

---

## Migration from the old Google Sheet (one time)

1. Put each tab's CSV export in `data/import/` (Google Sheets: File → Download → Comma-separated values).
2. `npm run import` reads them and **recomputes every P/L**. The sheet's own P/L is used only as a cross-check.
3. Every disagreement, unreadable cell or likely duplicate is listed in `data/import/REPORT.md`, and the import refuses to write until each one is resolved in `data/import/corrections.json`. Each resolution is recorded with a reason, and the fix is noted on the bet itself.
4. The original CSVs, the report and the corrections stay in the repo permanently as part of the audit trail.

---

## Files, for reference

```
data/bets.json          ← THE record (one bet per line). Only the commands write to it.
data/import/            ← original sheet exports, import report, corrections (audit trail)
site.config.json        ← season start date, handle, domain, footer line, market types
site/                   ← stylesheet, fonts, icons, log-page filter script
scripts/                ← the commands (plain Node, no AI, no paid services)
exports/                ← recap PNGs (not uploaded)
```
