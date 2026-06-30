# AI Recommendation — Setup

This adds an **"AI Recommendation"** card to the DSS section. It sends the dashboard's
**already-computed statistics** (mean, median, skewness, top menus, hot/iced split,
chi-square association, etc.) to a **Claude Haiku** model and shows fresh, plain-language
recommendations. It runs *alongside* the existing rule-based "Performance & Recommendations"
section — it does not replace it.

## Architecture (why a Cloud Function?)

The dashboard is a **static site** (GitHub Pages), so an Anthropic API key can **never** live
in the browser. Instead:

```
Browser (read-only)                Firebase Cloud Function           Anthropic
─────────────────────              ───────────────────────           ─────────
1. hash the current stats
2. read  /aiRecs/<hash>  ◀───────  (admin SDK writes here)
   └─ hit?  show it.
   └─ miss? POST stats ──────────▶ 3. call Claude Haiku ───────────▶ 4. recommendations
                                   5. write /aiRecs/<hash>
                                   6. return JSON  ───────────────▶  show it
```

- The **API key stays server-side** (a Cloud Function secret).
- The client **only reads** `/aiRecs` (same security model as `/signal` — the client never writes).
- Results are **cached by a hash of the data**, so the same data + language reuses the cached
  answer (cheap + reproducible); it only regenerates when the data actually changes or the user
  clicks **Regenerate**.
- The model is fed the **pre-computed numbers** and told to *interpret, not recalculate* — this
  keeps it from hallucinating statistics.

## Prerequisites

- **Firebase Blaze (pay-as-you-go) plan** — Cloud Functions require it for outbound network calls.
  (The free Spark plan cannot call the Anthropic API.)
- Firebase CLI: `npm install -g firebase-tools` then `firebase login`.
- An **Anthropic API key** from https://console.anthropic.com/.
- Node.js 20.

## Steps

### 1. Install function dependencies
```bash
cd functions
npm install
cd ..
```

### 2. Set the API key as a secret (never commit it)
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
# paste your sk-ant-... key when prompted
```

### 3. Deploy the function (and DB rules)
```bash
firebase deploy --only functions,database
```
After deploy, the CLI prints the function URL, e.g.:
```
https://asia-southeast1-coffee-dashboard-3ff7f.cloudfunctions.net/aiRecommendation
```

### 4. Wire the URL into the site
Paste that URL into `config.js`:
```js
"aiFnUrl": "https://asia-southeast1-coffee-dashboard-3ff7f.cloudfunctions.net/aiRecommendation",
```
Commit + push. The **AI Recommendation card appears only when `aiFnUrl` is set** (so the live
site stays clean until it's configured).

## Cost & model notes

- Model: **`claude-haiku-4-5`** — cheap and fast; plenty for summarizing pre-computed metrics.
  To upgrade wording quality, change `MODEL` in `functions/index.js` to `claude-opus-4-8`.
- Each **Regenerate** = one API call. Caching by data-hash means repeated views are free.
- `maxInstances: 5` in `functions/index.js` caps concurrency so a runaway can't rack up cost.

## Rate limiting

A single rule on **both** sides: **one generation every 3 minutes** (a cooldown — no daily cap).

**Frontend** (`app.jsx`, `AI_COOLDOWN_S = 180`):
- After a generation the button shows a `m:ss` countdown and is disabled until it expires.
- The cooldown deadline is stored in `localStorage` (`cd_ai_until`), so a page reload doesn't reset it.
- Honors a backend `429` (uses its `retryAfterSec` for the countdown).

**Backend** (`functions/index.js`, `AI_COOLDOWN_MS = 180000`):
- Per-IP last-generation timestamp in an admin-only Realtime DB path (IPs are hashed, never stored raw).
- An **atomic transaction** checks-and-sets the timestamp; within the 3-minute window it aborts (no write)
  and returns HTTP `429` with `{ error, retryAfterSec }`. **Fails open** if the DB hiccups.

Change the window by editing those two constants (keep them in sync), then
`firebase deploy --only functions` for the backend. The frontend cooldown is UX (a determined user can
clear `localStorage`); the **backend** is the authoritative guard.

## Files added

| File | Purpose |
|---|---|
| `functions/index.js` | The Cloud Function (secure Claude proxy + DB cache writer). |
| `functions/package.json` | Function dependencies (`@anthropic-ai/sdk`, `firebase-admin/functions`). |
| `firebase.json`, `.firebaserc` | Firebase project config (functions + database rules). |
| `database.rules.json` | Adds public-read `/aiRecs` (client reads; only the function writes). |
| `config.js` | New `aiFnUrl` key. |
| `app.jsx`, `styles.css` | The AI Recommendation card UI (TH/EN). |

## Local testing

```bash
cd functions && npm run serve     # Firebase emulator (needs the secret available locally)
```
Or test the deployed function directly:
```bash
curl -X POST "$AI_FN_URL" -H "Content-Type: application/json" \
  -d '{"hash":"test123","lang":"en","stats":{"spendPerCustomer":{"mean":120,"median":120,"skewness":2.8,"shape":"right-skewed"},"topMenus":[{"menu":"Espresso","cups":108,"pct":32.5}]}}'
```

## Graceful degradation

If the function is unreachable or errors, the card shows a retry message and the rule-based
"Performance & Recommendations" section is unaffected — the AI layer is purely additive.
