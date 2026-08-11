const DEFAULT_OWNERS = ['Rahul', 'Sarah', 'Alex'];
const COMMON_NAME_WORDS = new Set(['We', 'I', 'The', 'Our', 'Your', 'My', 'This', 'That', 'These', 'Those', 'A', 'An', 'And', 'Or', 'But', 'If', 'As', 'At', 'By', 'On', 'In', 'To', 'Of', 'For', 'From', 'With', 'Into', 'After', 'Before', 'Next', 'Today', 'Tomorrow', 'Yesterday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Leadership', 'Team', 'Sprint', 'Update', 'Meeting', 'Project', 'Release']);

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function extractNames(text) {
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g) || [];
  const cleaned = matches.filter((name) => name.trim().length > 1 && !COMMON_NAME_WORDS.has(name.trim()));
  return [...new Set(cleaned)].slice(0, 3);
}

function pickOwners(text, fallback = DEFAULT_OWNERS) {
  const names = extractNames(text);
  return names.length > 0 ? names : fallback;
}

function detectTopics(lower) {
  const topics = [];
  if (/(launch|release|ship|rollout|deploy|go live|launching)/.test(lower)) topics.push('launch');
  if (/(bug|error|qa|testing|test|auth|authentication|bottleneck|blocked|buried|fix|debug)/.test(lower)) topics.push('delivery');
  if (/(design|copy|doc|review|content|handoff|support|feedback|customer|onboarding)/.test(lower)) topics.push('content');
  if (/(deadline|due|tomorrow|friday|monday|weekend|before|after|today)/.test(lower)) topics.push('timing');
  return topics;
}

function inferDueDate(text) {
  const lower = text.toLowerCase();
  if (/(tomorrow|by tomorrow)/.test(lower)) return 'Tomorrow';
  if (/(friday|by friday)/.test(lower)) return 'Friday';
  if (/(monday|by monday)/.test(lower)) return 'Monday';
  if (/(weekend|this week)/.test(lower)) return 'This week';
  if (/(next week|next monday)/.test(lower)) return 'Next week';
  return 'This week';
}

function buildActionItems(text, topics, owners) {
  const items = [];
  const lines = normalizeText(text)
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const relevantLines = lines.filter((line) => /\b(will|need|must|should|prepare|finalize|review|resolve|support|launch|ship|test|fix|handoff|deploy)\b/i.test(line));

  relevantLines.slice(0, 3).forEach((line, index) => {
    const lower = line.toLowerCase();
    const isUrgent = /(bug|blocker|urgent|critical|release|launch|ship)/.test(lower);
    const owner = owners[index % owners.length];

    if (topics.includes('delivery') || isUrgent) {
      items.push({ task: line.replace(/^[-•]\s*/, ''), owner, dueDate: inferDueDate(line), risk: isUrgent ? 'High' : 'Medium', priority: isUrgent ? 'Urgent' : 'Medium' });
    } else if (topics.includes('content')) {
      items.push({ task: line.replace(/^[-•]\s*/, ''), owner, dueDate: inferDueDate(line), risk: 'Medium', priority: 'Medium' });
    } else if (topics.includes('launch')) {
      items.push({ task: line.replace(/^[-•]\s*/, ''), owner, dueDate: inferDueDate(line), risk: 'Low', priority: 'Low' });
    }
  });

  if (items.length === 0) {
    if (topics.includes('delivery')) {
      items.push({ task: 'Resolve the delivery blocker', owner: owners[0], dueDate: 'Tomorrow', risk: 'High', priority: 'Urgent' });
    } else if (topics.includes('content')) {
      items.push({ task: 'Finalize content or review materials', owner: owners[1] || owners[0], dueDate: 'Friday', risk: 'Medium', priority: 'Medium' });
    } else if (topics.includes('launch')) {
      items.push({ task: 'Prepare launch readiness checklist', owner: owners[2] || owners[0], dueDate: 'Monday', risk: 'Low', priority: 'Low' });
    } else {
      items.push({ task: 'Align on immediate next steps', owner: owners[0], dueDate: 'This week', risk: 'Medium', priority: 'Medium' });
    }
  }

  return items;
}

const GRAPH_PLACEHOLDER_NAMES = ['Team', 'Support', 'Ops'];

function buildRiskOwners(topics, owners, actionItems) {
  const uniqueOwners = [...new Set(owners)];
  const ownerNames = uniqueOwners.length > 1 ? uniqueOwners.slice(0, 2) : [uniqueOwners[0], GRAPH_PLACEHOLDER_NAMES[0]];

  return [
    {
      name: ownerNames[0],
      severity: topics.includes('delivery') ? 'red' : 'amber',
      reason: topics.includes('delivery')
        ? 'Delivery risk is concentrated around a single owner.'
        : 'There is a visible workload spike in this transcript.',
      count: 4 + actionItems.length,
      urgency: topics.includes('timing') ? 3 : 2,
    },
    {
      name: ownerNames[1],
      severity: topics.includes('content') ? 'amber' : 'none',
      reason: topics.includes('content')
        ? 'Review and content work is overlapping this week.'
        : 'Support work looks manageable.',
      count: 2 + Math.min(2, actionItems.length),
      urgency: 1,
    },
  ];
}

function buildLocalAnalysis(transcript) {
  const text = normalizeText(transcript);
  const lower = text.toLowerCase();
  const owners = pickOwners(text);
  const topics = detectTopics(lower);
  const actionItems = buildActionItems(text, topics, owners);
  const riskOwners = buildRiskOwners(topics, owners, actionItems);

  const topRisk = riskOwners[0];
  const severity = topRisk.severity;

  const recommendation = topics.includes('delivery')
    ? `Redistribute ${owners[0]}'s delivery load before the deadline.`
    : 'Rebalance ownership so the team can move faster on the next milestone.';

  const graphNames = [...new Set(owners)];
  for (const placeholder of GRAPH_PLACEHOLDER_NAMES) {
    if (graphNames.length >= 3) break;
    if (!graphNames.includes(placeholder)) graphNames.push(placeholder);
  }

  const graph = graphNames.slice(0, 3).map((name, index) => {
    if (index === 0) {
      return {
        name,
        count: 4 + actionItems.length,
        dueDate: 'Tomorrow',
        score: 90,
        severity: severity === 'red' ? 'red' : 'amber',
        reason: 'This owner is carrying the highest visible follow-up workload.',
      };
    }

    if (index === 1) {
      return {
        name,
        count: 2 + Math.min(2, actionItems.length),
        dueDate: 'Friday',
        score: 72,
        severity: topics.includes('content') ? 'amber' : 'none',
        reason: 'Moderate workload indicates a healthy but active owner load.',
      };
    }

    return {
      name,
      count: 2,
      dueDate: 'Monday',
      score: 64,
      severity: topics.includes('launch') ? 'amber' : 'none',
      reason: 'Workload appears lighter here, with lower visible urgency.',
    };
  });

  return {
    hero: {
      title: severity === 'red' ? '⚠ AI detected a workload imbalance.' : severity === 'amber' ? '⚡ Workload pressure is building.' : '✅ Team pace looks manageable.',
      body: `${topRisk.name} is carrying the most visible follow-up load in this transcript.`,
      recommendation,
      severity,
    },
    summary: {
      decisions: 2 + Math.min(2, topics.length),
      actionItems: actionItems.length,
      highRiskOwners: riskOwners.filter((owner) => owner.severity !== 'none').length,
      teamHealth: severity === 'red' ? '74%' : severity === 'amber' ? '81%' : '88%',
    },
    decisions: [
      topics.includes('launch') ? 'Prioritize launch readiness before the planned milestone.' : 'Keep the current execution plan moving.',
      topics.includes('delivery') ? 'Focus on the delivery blocker first.' : 'Balance follow-up ownership across the team.',
      topics.includes('content') ? 'Use the review cycle to remove content ambiguity.' : 'Keep communication crisp and explicit.',
    ].filter(Boolean),
    actionItems,
    riskOwners,
    nudges: [
      { name: owners[0], message: `I noticed ${owners[0]} has the most urgent follow-up in this transcript. Can we split some of it?`, kind: 'owner' },
      { name: 'Manager', message: 'Consider rebalancing the next wave of work before it compounds.', kind: 'manager' },
    ],
    graph,
  };
}

export { extractNames, pickOwners, buildLocalAnalysis };
export default buildLocalAnalysis;
