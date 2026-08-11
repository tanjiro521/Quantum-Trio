import { buildLocalAnalysis, extractNames, pickOwners } from '../src/lib/analysis.js';

const MAX_TRANSCRIPT_LENGTH = 6000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 6;
const CLAUDE_TIMEOUT_MS = 18_000;
const requestCounts = new Map();
const GENERIC_NAME_TERMS = new Set([
  'leadership', 'lead', 'leads', 'leader', 'team', 'teams', 'sprint', 'update', 'meeting', 'project', 'planning', 'review', 'deadline', 'release', 'launch',
  'customer', 'support', 'qa', 'testing', 'blocker', 'risk', 'task', 'tasks', 'work', 'today', 'tomorrow', 'yesterday',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
]);

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function normalizeName(name) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
}

function isGenericName(name) {
  const normalized = normalizeName(name).toLowerCase();
  if (!normalized) return true;
  if (GENERIC_NAME_TERMS.has(normalized)) return true;
  return normalized.split(/\s+/).some((token) => GENERIC_NAME_TERMS.has(token));
}

function buildPrompt(transcript) {
  return `You are a workload intelligence assistant for Pulse.
Return valid JSON with this contract:
{
  "hero": {"title": string, "body": string, "recommendation": string, "severity": "none" | "amber" | "red"},
  "summary": {"decisions": number, "actionItems": number, "highRiskOwners": number, "teamHealth": string},
  "decisions": string[],
  "actionItems": [{"task": string, "owner": string, "dueDate": string, "risk": "High" | "Medium" | "Low", "priority": string}],
  "riskOwners": [{"name": string, "severity": "none" | "amber" | "red", "reason": string, "count": number, "urgency": number}],
  "nudges": [{"name": string, "message": string, "kind": "owner" | "manager"}],
  "graph": [{"name": string, "count": number, "dueDate": string, "score": number, "severity": "none" | "amber" | "red", "reason": string}]
}
Analyze this transcript and follow the contract exactly. Use only real person names from the transcript when populating owner names and graph labels. If a name is generic, do not use it. Do not output markdown, only raw JSON.
${transcript}`;
}

function normalizePayloadNames(payload, transcript) {
  const people = [...new Set([...extractNames(transcript), ...pickOwners(transcript)])].filter((name) => !!normalizeName(name));
  const pool = people.length > 0 ? people : ['Rahul', 'Sarah', 'Alex'];
  const used = new Set();

  const repairName = (candidate) => {
    const normalized = normalizeName(candidate);
    if (!normalized || isGenericName(normalized) || used.has(normalized)) {
      const replacement = pool.find((person) => !used.has(person) && !isGenericName(person));
      if (replacement) {
        used.add(replacement);
        return replacement;
      }
      return normalized || pool[0];
    }

    used.add(normalized);
    return normalized;
  };

  const normalizeSeverity = (value) => {
    const severity = String(value || '').trim().toLowerCase();
    if (['red', 'danger'].includes(severity)) return 'red';
    if (['amber', 'warning', 'yellow'].includes(severity)) return 'amber';
    return 'none';
  };

  if (payload?.hero && typeof payload.hero === 'object') {
    payload.hero = {
      ...payload.hero,
      severity: normalizeSeverity(payload.hero.severity),
    };
  }

  if (Array.isArray(payload.riskOwners)) {
    payload.riskOwners = payload.riskOwners.map((item) => ({
      ...item,
      name: repairName(item.name),
      severity: normalizeSeverity(item.severity),
    }));
  }

  if (Array.isArray(payload.graph)) {
    payload.graph = payload.graph.map((item) => ({
      ...item,
      name: repairName(item.name),
      severity: normalizeSeverity(item.severity),
    }));
  }

  return payload;
}

function isValidAnalysisPayload(payload) {
  const validSeverity = ['none', 'amber', 'red'];
  const validRisk = ['High', 'Medium', 'Low'];
  const validNudgeKinds = ['owner', 'manager'];

  if (!payload || typeof payload !== 'object') return false;
  if (!payload.hero || typeof payload.hero.title !== 'string' || typeof payload.hero.body !== 'string' || typeof payload.hero.recommendation !== 'string' || !validSeverity.includes(payload.hero.severity)) {
    return false;
  }

  if (!payload.summary || typeof payload.summary.decisions !== 'number' || typeof payload.summary.actionItems !== 'number' || typeof payload.summary.highRiskOwners !== 'number' || typeof payload.summary.teamHealth !== 'string') {
    return false;
  }

  if (!Array.isArray(payload.decisions) || payload.decisions.some((item) => typeof item !== 'string')) return false;
  if (!Array.isArray(payload.actionItems) || payload.actionItems.some((item) => typeof item !== 'object' || typeof item.task !== 'string' || typeof item.owner !== 'string' || typeof item.dueDate !== 'string' || !validRisk.includes(item.risk) || typeof item.priority !== 'string')) {
    return false;
  }

  if (!Array.isArray(payload.riskOwners) || payload.riskOwners.some((item) => typeof item !== 'object' || typeof item.name !== 'string' || !validSeverity.includes(item.severity) || typeof item.reason !== 'string' || typeof item.count !== 'number' || typeof item.urgency !== 'number')) {
    return false;
  }

  if (!Array.isArray(payload.nudges) || payload.nudges.some((item) => typeof item !== 'object' || typeof item.name !== 'string' || typeof item.message !== 'string' || !validNudgeKinds.includes(item.kind))) {
    return false;
  }

  if (!Array.isArray(payload.graph) || payload.graph.some((item) => typeof item !== 'object' || typeof item.name !== 'string' || typeof item.reason !== 'string' || typeof item.count !== 'number' || typeof item.dueDate !== 'string' || typeof item.score !== 'number' || !validSeverity.includes(item.severity))) {
    return false;
  }

  const names = payload.graph.map((item) => item.name);
  return new Set(names).size === names.length;
}

async function callAnthropic(model, transcript) {
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
        system: 'You are a precise summarizer. Always return valid JSON, no markdown, and use the exact contract described.',
        messages: [{ role: 'user', content: buildPrompt(transcript) }],
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
      throw new Error(`Anthropic returned invalid JSON: ${parseError.message} | raw response: ${text.slice(0, 200)}`);
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

  const { transcript } = req.body || {};
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'A transcript is required.' });
  }

  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return res.status(400).json({ error: `Transcript is too large. Please reduce to ${MAX_TRANSCRIPT_LENGTH} characters or less.` });
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
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' });
  }

  const fallbackResult = { ...buildLocalAnalysis(transcript), fallback: true };
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.warn('ANTHROPIC_API_KEY is not configured. Serving local demo analysis for this request.');
    return res.status(200).json({ ...fallbackResult, demoMode: true, fallbackReason: 'No Anthropic API key configured.' });
  }

  const primaryModel = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  const fallbackModel = process.env.ANTHROPIC_FALLBACK_MODEL || 'claude-3-5-sonnet-latest';

  try {
    const primaryResult = await callAnthropic(primaryModel, transcript);
    const normalized = normalizePayloadNames(primaryResult, transcript);
    if (isValidAnalysisPayload(normalized)) {
      return res.status(200).json({ ...normalized, fallback: false, demoMode: false });
    }

    throw new Error('Primary Anthropic response did not match the expected contract after repair.');
  } catch (primaryError) {
    console.warn(`[pulse] Primary model ${primaryModel} failed:`, primaryError.message);

    try {
      const fallbackResultPayload = await callAnthropic(fallbackModel, transcript);
      const normalizedFallback = normalizePayloadNames(fallbackResultPayload, transcript);
      if (isValidAnalysisPayload(normalizedFallback)) {
        return res.status(200).json({ ...normalizedFallback, fallback: false, demoMode: false });
      }

      throw new Error('Fallback Anthropic response did not match the expected contract after repair.');
    } catch (fallbackError) {
      console.error('[pulse] Anthropic analysis failed after fallback:', fallbackError.message);
      return res.status(200).json({
        ...fallbackResult,
        demoMode: false,
        fallbackReason: fallbackError.message,
      });
    }
  }
}
