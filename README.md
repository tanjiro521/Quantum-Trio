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

## How Pulse Works — Technical Overview

Pulse transforms an unstructured meeting transcript into actionable workplace intelligence through a simple AI-powered pipeline.

### 1. Transcript Input
The user provides a meeting transcript through the React-based web interface. The transcript can contain conversations, decisions, responsibilities, deadlines, and team discussions in natural language.

### 2. AI Analysis
The transcript is sent to the application's analysis endpoint. The backend securely communicates with the Anthropic Claude API using an environment variable stored outside the source code.

Claude analyzes the transcript and extracts structured information such as:
- Decisions made during the meeting
- Action items and their owners
- Deadlines and responsibilities
- Team workload
- Risk indicators
- Suggested follow-up nudges

### 3. Structured Intelligence
The AI response is converted into structured data that the frontend can interpret and display. Pulse calculates workload and risk information from the extracted action items to identify potential overload and accountability gaps.

### 4. Visualization
The React frontend transforms the analysis into an interactive dashboard containing:
- Decisions
- Action items
- Team workload visualization
- Risk analysis
- AI-generated follow-up nudges

This turns a long, messy meeting transcript into a concise view of **what was decided, who needs to do what, where the risks are, and what should happen next.**

### 5. Reliability & Fallback
Pulse is designed to remain usable even when the external AI service is unavailable. A local fallback analysis mechanism (`src/lib/analysis.js`) can provide demo analysis instead of leaving the user with a completely failed experience.

### Technical Stack

- **Frontend:** React + Vite
- **Styling:** plain CSS and Framer Motion
- **Backend/API:** Vercel Serverless Functions (`api/`) — local development uses an Express-based dev server (`server.js`)
- **AI:** Anthropic Claude API
- **Deployment:** Vercel
- **Version Control:** Git + GitHub

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
