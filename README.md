# Pulse — Meeting-to-Workload Intelligence

Pulse turns a raw meeting transcript into a single-glance team-health snapshot. It extracts decisions, action items, workload risks, and owner load from transcript text using AI.

## How it works
1. Paste a meeting transcript (or use a preloaded sample).
2. Click **Analyze Meeting** — the backend sends the text to Claude (Anthropic) for structured extraction.
3. Results render as summary stats, decision bullets, action item cards, a team pulse graph, risk analysis, and AI nudges.
4. When no Anthropic key is configured, the app serves a local demo analysis so you can test the full UI without an API.

## Tech stack
- **Frontend:** React + Vite, plain CSS, Framer Motion
- **Backend:** Vercel serverless function (`api/analyze.js`) calling Anthropic Claude
- **Local dev:** Express server (`server.js`) via `npm run dev`
- **No database. No auth. No real third-party integrations.**

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Create `.env.local` with your Anthropic key:
   ```env
   ANTHROPIC_API_KEY=your_key_here
   # ANTHROPIC_MODEL=claude-haiku-4-5
   # ANTHROPIC_FALLBACK_MODEL=claude-3-5-sonnet-latest
   # ANTHROPIC_API_VERSION=2023-06-01
   # PORT=3002
   ```
3. Start both frontend and backend together:
   ```bash
   npm run dev
   ```
4. Open **http://localhost:3003**

Without `ANTHROPIC_API_KEY`, the app runs in local demo mode and returns mock analysis — the UI works fully.

## Deploy to Vercel
1. Push this repo to GitHub.
2. In Vercel, import the GitHub repo.
3. **Before the first deploy**, set these in **Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - `ANTHROPIC_MODEL` = `claude-haiku-4-5` (optional, this is the default)
   - `ANTHROPIC_FALLBACK_MODEL` = `claude-3-5-sonnet-latest` (optional)
4. Vercel auto-detects: `api/` folder becomes serverless functions, Vite builds to `dist/`.
5. No special build command is needed — Vercel uses the default settings.

## API Contract

**POST** `/api/analyze`

Request:
```json
{ "transcript": "string (max 6000 chars)" }
```

Response:
```json
{
  "hero": { "title": "string", "body": "string", "recommendation": "string", "severity": "none|amber|red" },
  "summary": { "decisions": "number", "actionItems": "number", "highRiskOwners": "number", "teamHealth": "string" },
  "decisions": ["string"],
  "actionItems": [{ "task": "string", "owner": "string", "dueDate": "string", "risk": "High|Medium|Low", "priority": "string" }],
  "riskOwners": [{ "name": "string", "severity": "none|amber|red", "reason": "string", "count": "number", "urgency": "number" }],
  "nudges": [{ "name": "string", "message": "string", "kind": "owner|manager" }],
  "graph": [{ "name": "string", "count": "number", "dueDate": "string", "score": "number", "severity": "none|amber|red", "reason": "string" }],
  "fallback": true,
  "demoMode": true
}
```

## Notes
- `node_modules/`, `dist/`, `.vite/`, `.env`, `.env.local`, `.env*.local` are in `.gitignore`.
- The backend has a simple in-memory rate limiter (6 requests/minute per IP).
- Transcript max length: 6000 characters.
- `server.js` is for **local development only** — it is never deployed to Vercel.
