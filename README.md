# Karteikasten

**English** · [Deutsch](README.de.md)

Study flashcards from CSV files, on your own computer. The app shows you each card just before you would forget it (FSRS-6 via the [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) library).

The app is available in English and German. Pick the language with the gear ⚙︎ at the top (see [Settings](#settings-appearance-and-language)).

## Getting started

You need Node.js 22.13 or newer (`node -v`).

Install the dependency once:

```bash
npm install
```

Start the server:

```bash
npm start
```

Then open <http://localhost:4321> in your browser.

Stop it with `Ctrl+C` in the terminal.

## Cards and question types

A CSV file with column 1 = front, column 2 = back. Commas, semicolons and tabs are recognised.

Question types per deck (Settings → Question type):

- **Automatic** (default): new cards as multiple choice, after that you type the answer.
- **Always type**, **Always multiple choice**, **Just reveal**.
- **Type, compare yourself**: you write your answer, the app shows the solution next to it, and you rate yourself.

When you type an answer, the app checks:

- **Short answers** (up to 60 characters) for a match, tolerating typos, accents and articles.
- **Long answers** by key terms. Terms you got are marked green, missing ones red.

The app picks the terms automatically (up to 7, preferring technical terms and nouns). It suggests "Good" from 60% of the terms, "Hard" from 30%, otherwise "Again".

You can also set the terms yourself with asterisks or bold on the back. Then only those count, and it takes 80% for "Good" and 50% for "Hard":

```
Photosynthesis;Conversion of *light energy* into **chemical energy**
```

If a term is followed by a translation in brackets, either one is enough: with `Scope (Reichweite)`, "Scope" counts just like "Reichweite". Brackets holding sources or examples ("vgl. …", "e.g. …", "such as …") are ignored.

The check only looks for the terms, not the meaning. The app does not recognise synonyms, so its rating is always just a suggestion.

## More new cards than the daily limit

The daily limit mainly protects the coming days, because every new card brings reviews later. So when today is going well, the app offers more new cards in packs of 5:

- **When:** today's regular new cards have come up, no review is left, and at least three quarters of today's new cards have left the learning phase. The offer appears above the card during a round, on the finish screen, and on a deck or subject as "5 more new".
- **Brake:** no offer if you knew less than 70% on the repeats of today's new cards (counted from 6 repeats), or if you already have twice your daily limit of new cards today. The finish screen says why.
- **Cost:** next to the button you see roughly how many reviews the pack brings over the next 7 days. This is based on your own history, or on a simulation while the history is still too short.
- **Mixing in:** the new cards go between the cards that are currently in the learning phase. If the deck belongs to a subject with a topic tree, they are taken from different branches in turn (from different sets for subjects without a tree), so similar items don't come back to back.

Background: new cards should first be recalled correctly a few times, after that spaced repetition matters most (Rawson & Dunlosky 2011). The size of a pack matters little as long as the spacing is right (Nakata & Webb 2016). Items with similar meanings interfere with each other when learned together. The thresholds 75%, 70% and "twice" are reasoned starting values and can be tuned from the history.

## Editing cards

Under **"Cards"** on each deck you see all cards with their box. You can search, edit, delete, add and suspend them. Editing keeps the progress. If you rewrite a question heavily, you can reset its progress with a checkbox.

- **Problem cards:** a card you have forgotten 4 times or more is marked as a problem card. That is usually down to the card itself: it is too long or asks too much at once. The "Problem cards" filter shows them all, most forgotten first.
- **Suspend:** a suspended card no longer comes up and does not count toward progress until you bring it back. Its progress is kept.
- **While studying:** after revealing, "Edit card" (key `E`) opens the card for corrections. Problem cards show a note with "Edit" and "Suspend".

## Subjects

Several card sets on one topic can be bundled into a **subject**, e.g. all sets of one lecture. **"Study subject"** starts a round across all sets. New cards are taken from the sets in turn, and each set keeps its own daily limit and settings.

**Many subjects at a glance:** as soon as there is a subject, tabs appear at the top: **Today**, one tab per subject (with the number of due cards), **No subject** and **Archive**. The app remembers the last tab you had open.

- **Today** shows one row per subject with its colour, due and new cards and progress. The sets stay collapsed; click the name to open the subject.
- **"Study everything"** studies everything due across all subjects, one subject after another rather than mixed, because switching between subjects all the time is tiring. Next to it you see roughly how long it will take, based on your past answer times.
- **Colour:** every subject has a colour (choose it under "Edit"). While studying, each card shows its subject and a coloured edge.
- **Archive:** "Archive" puts a finished subject to rest. It no longer counts toward today, "Study everything" or the "All done" badge. Its progress is kept, "Refresh" still studies it, and "Restore" makes it active again.

**Topic tree:** under "Edit" you can give a subject an outline. Build it directly in the editor (Enter: next branch, Tab: indent, Shift+Tab: outdent, buttons to move and delete) or paste it via "Paste as text", either as a tree (`├──`, `└──`) or as an indented list. Leftover `[cite: …]` markers are ignored. Every branch has a fixed ID; renaming and moving don't change it. Below the editor the app suggests new branches: names and technical terms that appear in several cards without a branch, e.g. "Brown & Hagel". One click adds the branch. The app assigns each card automatically to the branch whose terms it mentions most. The part before a colon ("Porter: …") counts double, and terms that appear in very many cards count less. Under "Topic tree" you see cards, due cards, progress and boxes per branch. The weakest branch is marked. Cards that don't fit any branch are listed below; often the tree is missing a branch for them.

**Assigning cards by hand:** in the tree view, "Show cards" expands the cards of a branch. With the menu next to each card you move it to another branch, to no branch, or back to automatic. "Check unsure assignments" lists cards that fit two branches almost equally well. One click on the right branch fixes it there. Manual assignments take priority, survive renaming and moving a branch, and are ignored if the branch is deleted.

Create a subject with **"New subject"**. Change which subject a set belongs to under "Edit" on the subject, in a set's settings, or right when importing. Deleting a subject keeps its sets.

## Progress and badges

- **Card box with boxes** (a deck's statistics): every card sits in one of five boxes, depending on how long it is expected to stick according to the algorithm (from under 1 day to over 3 months). Cards you know move up, forgotten ones fall back.
- **Progress per deck** in three stages: *started* (studied at least once), *learned* (got through the short learning steps, comes back only after days) and *solid* (sticks for at least 3 weeks). Plus the medals bronze (25%), silver (50%) and gold (75%).
- **Stamp after each card:** above the next card you see what your last rating did, e.g. "Learned ✓ – again in 1 day" or "Box 3 ↑ – now sticks for about 2 weeks".
- **Daily summary** on the overview: new cards started, learned, and moved up a stage.
- **Your progress on this card:** when revealing, the app shows your earlier ratings of this card, a comparison with your last answer ("Last time 3 of 7 terms, today 6 of 7") and, expandable, your last answer.

For every answer the app stores in its history (`log-<date>`): card, direction, rating, time, set, plus the typed text, the terms found and missing, the app's suggestion, the question type and how long the answer took. This is the basis for later improvements such as learned synonyms or personal thresholds.
- **16 badges** for regular practice and milestones, e.g. streaks, total answers, "All done" or the first card in box 5.

Only what matters is rewarded: regular practice and long-term retention. There are no points for "correct" ratings, because that would tempt you to rate cards better than they went. The algorithm would then plan intervals that are too long.

## Phone and computer at the same time

Several devices or tabs can study with the same server without overwriting each other:

- **Refreshing:** an open tab picks up new changes when you come back to it, every 30 seconds and before every round. A short note "Picked up changes from another device" appears.
- **Merging:** if two devices save almost at the same time, the server rejects the outdated version and the app merges both. Per card the latest rating wins, answers from both devices stay in the history, and the daily counters count both devices. For text changes the latest version wins.
- **Same card on two devices:** the rating given later counts.

Technically every stored document gets a version number (`/api/changes`, header `X-If-Rev`).

## Settings: appearance and language

The gear ⚙︎ at the top next to the date opens the app settings:

- **Appearance:** same as system, light or dark.
- **Language:** English or German (Deutsch). If you haven't picked one, the app follows your browser's language.

Both apply to the device you set them on. The cards themselves are not translated, only the app's own text.

## Where your data lives

All decks, your progress and the answer history are stored in `data/karteikasten.db` (SQLite).

## Backup and restore

- **Automatic:** on start and every hour after that, the server checks whether there is already a backup for today. If not, it creates `data/backups/karteikasten-<date>.json`. The last 14 days are kept.
- **Download:** on the overview under "Back up your data", "Download backup" downloads a file with all decks, your progress, the subjects and the history. Because the automatic copies are on the same computer, you should download a backup now and then and keep it somewhere else. The app shows when you last did this and highlights it after 30 days.
- **Restore:** "Restore from backup" takes a downloaded or automatic backup. The app first shows what's in it and asks you to confirm. The current state is saved first as `data/backups/vor-wiederherstellung-<time>.json`, so a mistake can be undone by restoring that file. The last 5 of these files are kept.
- **CSV export:** in a deck's settings, "Export as CSV" saves the cards as front;back. The file can be imported again or opened in Excel. It does not contain your progress; that's what the backup is for.

## Options

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `4321` | Another port, if 4321 is taken: `PORT=4322 npm start` |
| `HOST` | `127.0.0.1` | `HOST=0.0.0.0 npm start` makes the app reachable on your Wi-Fi, e.g. from your phone. There is no password, so only use this on a network you trust. |
| `DATA_DIR` | `./data` | Another location for the database. Don't put it in an iCloud folder. |
| `BACKUP_DIR` | `./data/backups` | Another folder for the automatic backups, e.g. on an external drive. Backups are single files and may also live in a cloud folder. |

## How it's built

- `server.js`: serves the app, stores JSON documents in SQLite (`/api/docs`) and creates backups (`/api/backup`, `/api/restore`). No framework, just Node built-ins.
- `public/index.html`: the whole app (import, studying, statistics, settings). German is the source language; the English texts are in `EN` at the end of the script. Always write new texts with `T("…")` or `Tn(…)` and add them to `EN`.
- `node_modules/ts-fsrs`: the learning algorithm, served by the server at `/vendor/ts-fsrs.js`. If it is missing, the app uses a built-in FSRS-5 version.
- `artifact/karteikasten.html`: the earlier version as a Claude artifact. It saves to the Claude account instead of locally and is not used by the server.

## Tests

```bash
npm test
```

The tests load the real app code from `public/index.html` and check the tricky parts: answer checking (typos, key terms, thresholds), scheduling (with ts-fsrs and with the built-in fallback), picking today's cards, problem cards, suspending and CSV export. On top of that they run the server in a throwaway folder: saving, automatic backup, restore and the protection against other websites. They also check that every text has an English version. Your real data is not touched. Run `npm test` before every merge. The tests also run on GitHub after every push, on Linux, Mac and Windows (`.github/workflows/test.yml`). The result is under the repository's "Actions" tab.

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), see [LICENSE](LICENSE).

Any noncommercial use is allowed: personal use, studying, research, hobby projects and teaching, as well as use by charitable organisations, educational institutions and public authorities. You may change and share the code as long as you include the license and the copyright notice. Commercial use is not allowed. If you'd like that, you can ask for a separate license.

Versions up to and including commit `e2c994d` (8 November 2026) were published under the MIT license and remain usable under MIT for everyone who received them back then.

The bundled library [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) is under its own MIT license.
