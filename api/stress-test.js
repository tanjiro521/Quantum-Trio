import { buildLocalStressTest } from '../src/lib/stress-test.js';

const MAX_DRAFT_LENGTH = 6000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 6;
const CLAUDE_TIMEOUT_MS = 18_000;
const requestCounts = new Map();

const DEFAULT_PERSONAS = [
  { name: 'Senior Developer', role: 'Engineering Lead' },
  { name: 'HR / People Representative', role: 'Human Resources' },
  { name: 'Product Lead', role: 'Product Management' }
];

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function buildPrompt(draft, meetingContext, personas) {
  return `You are a workplace communication simulation assistant.
Return valid JSON with this contract:
{
  "intentSummary": "string",
  "frictionFactors": {
    "tone": 0-100,
    "deadlinePressure": 0-100,
    "workloadImpact": 0-100,
    "overtimeConcern": 0-100,
    "ambiguity": 0-100,
    "fairness": 0-100
  },
  "personas": [
    {
      "name": "string",
      "role": "string",
      "concernScore": 0-100,
      "concernLevel": "none|moderate|high|critical",
      "objection": "string",
      "triggerPhrases": ["string"],
      "reason": "string",
      "suggestion": "string"
    }
  ],
  "rewrite": "string"
}

Analyze this draft message.
Draft:
"""
${draft}
"""
Meeting Context (optional):
${JSON.stringify(meetingContext || {})}

Simulate these personas reading it:
${JSON.stringify(personas)}

Rules:
1. Every persona's objection and reason MUST be grounded in specific words or phrases actually present in the draft, referenced via triggerPhrases.
2. Reject generic filler like "this may be concerning".
3. What in this specific draft triggered the concern?
4. Why does this persona's role make them care about it?
5. If a persona has no real concern, concernLevel should be "none" with a brief honest reason, not a stretched objection.
6. The rewrite should preserve the original intent while lowering friction.
7. Do not output markdown, only raw JSON.`;
}

function isValidStressTestPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.intentSummary !== 'string') return false;
  if (!payload.frictionFactors || typeof payload.frictionFactors !== 'object') return false;
  if (!Array.isArray(payload.personas)) return false;
  if (typeof payload.rewrite !== 'string') return false;
  
  const factors = ['tone', 'deadlinePressure', 'workloadImpact', 'overtimeConcern', 'ambiguity', 'fairness'];
  for (const factor of factors) {
    if (typeof payload.frictionFactors[factor] !== 'number') return false;
  }
  
  const validLevels = ['none', 'moderate', 'high', 'critical'];
  for (const p of payload.personas) {
    if (typeof p.name !== 'string' || typeof p.role !== 'string' || typeof p.concernScore !== 'number') return false;
    if (!validLevels.includes(p.concernLevel)) return false;
    if (typeof p.objection !== 'string' || typeof p.reason !== 'string' || typeof p.suggestion !== 'string') return false;
    if (!Array.isArray(p.triggerPhrases)) return false;
  }
  
  return true;
}

async function callAnthropic(model, draft, meetingContext, personas) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const response = await fetch(process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': process.env.ANTHROPIC_API_VERSION || '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: 'You are a workplace communication expert. Always return valid JSON, no markdown, and use the exact contract described.',
        messages: [{ role: 'user', content: buildPrompt(draft, meetingContext, personas) }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API request failed (${response.status}): ${errorBody}`);
    }

    const payload = await response.json();
    const completion = payload?.completion || payload;
    const content = completion?.content || payload?.content;
    const firstContent = Array.isArray(content) ? content[0] : content;
    const text = (
      firstContent?.text ||
      firstContent?.value ||
      firstContent?.answer ||
      completion?.text ||
      payload?.text ||
      '{}'
    ).toString();

    try {
      return JSON.parse(text.trim());
    } catch (parseError) {
      throw new Error(`Anthropic returned invalid JSON: ${parseError.message}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Anthropic API request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { draft, meetingContext, personas = [] } = req.body || {};
  if (!draft || typeof draft !== 'string' || !draft.trim()) {
    return res.status(400).json({ error: 'A draft is required.' });
  }

  if (draft.length > MAX_DRAFT_LENGTH) {
    return res.status(400).json({ error: `Draft is too large.` });
  }

  const clientIp = getClientIp(req);
  const now = Date.now();
  const entry = requestCounts.get(clientIp) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count += 1;
  requestCounts.set(clientIp, entry);

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Rate limit exceeded.' });
  }

  const mergedPersonas = [...DEFAULT_PERSONAS];
  for (const p of personas) {
      if (!mergedPersonas.find(mp => mp.name === p.name)) {
          mergedPersonas.push(p);
      }
  }

  const fallbackResult = { ...buildLocalStressTest(draft, mergedPersonas), fallback: true };
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return res.status(200).json({ ...fallbackResult, demoMode: true, fallbackReason: 'No Anthropic API key configured.' });
  }

  const primaryModel = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  const fallbackModel = process.env.ANTHROPIC_FALLBACK_MODEL || 'claude-3-5-sonnet-latest';

  try {
    const primaryResult = await callAnthropic(primaryModel, draft, meetingContext, mergedPersonas);
    if (isValidStressTestPayload(primaryResult)) {
      return res.status(200).json({ ...primaryResult, fallback: false, demoMode: false });
    }
    throw new Error('Primary Anthropic response did not match the expected contract.');
  } catch (primaryError) {
    console.warn(`[pulse] Primary model ${primaryModel} failed:`, primaryError.message);
    try {
      const fallbackResultPayload = await callAnthropic(fallbackModel, draft, meetingContext, mergedPersonas);
      if (isValidStressTestPayload(fallbackResultPayload)) {
        return res.status(200).json({ ...fallbackResultPayload, fallback: false, demoMode: false });
      }
      throw new Error('Fallback Anthropic response did not match the expected contract.');
    } catch (fallbackError) {
      return res.status(200).json({ ...fallbackResult, demoMode: false, fallbackReason: fallbackError.message });
    }
  }
}
