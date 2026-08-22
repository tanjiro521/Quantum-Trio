import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { buildLocalAnalysis } from './lib/analysis';

const sampleTranscripts = {
  clean: `Leadership sync
- Rahul will own authentication testing by Thursday.
- Sarah will finalize onboarding copy by Friday.
- Alex will coordinate rollout with support.
- We need to ship the new onboarding experience before the weekend.
- The main risk is that auth testing is concentrated on one person.`,
  messy: `We had a lot going on today. Alex mentioned the launch checklist and Rahul said he is already buried with auth bugs. Sarah has the design review next week but also needs to help on docs. We need to make sure the release doesn't slip because testing is still a bottleneck. Maybe we push one item to next week and ask someone else to help with QA.`,
};

const fallbackAnalysis = (transcript) => buildLocalAnalysis(transcript);

function isValidAnalysisPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const validSeverity = ['none', 'amber', 'red'];
  const validActionRisk = ['High', 'Medium', 'Low'];
  const validNudgeKinds = ['owner', 'manager'];

  if (!payload.hero || typeof payload.hero.title !== 'string' || typeof payload.hero.body !== 'string' || typeof payload.hero.recommendation !== 'string' || !validSeverity.includes(payload.hero.severity)) {
    return false;
  }

  if (!payload.summary || typeof payload.summary.decisions !== 'number' || typeof payload.summary.actionItems !== 'number' || typeof payload.summary.highRiskOwners !== 'number' || typeof payload.summary.teamHealth !== 'string') {
    return false;
  }

  if (!Array.isArray(payload.decisions) || payload.decisions.some((item) => typeof item !== 'string')) {
    return false;
  }

  if (!Array.isArray(payload.actionItems) || payload.actionItems.some((item) => typeof item !== 'object' || typeof item.task !== 'string' || typeof item.owner !== 'string' || typeof item.dueDate !== 'string' || !validActionRisk.includes(item.risk) || typeof item.priority !== 'string')) {
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

function AnimatedCounter({ value, accent, suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(Number(value));
      return undefined;
    }

    let frame = 0;
    const duration = 700;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setDisplayValue(Math.round(progress * Number(value)));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, reducedMotion]);

  return (
    <span className="counter" style={{ color: accent }}>
      {displayValue}
      {suffix}
    </span>
  );
}

function AmbientBackground({ reducedMotion }) {
  return (
    <motion.div
      className="ambient-layer"
      aria-hidden="true"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={reducedMotion ? { opacity: 0.6 } : { opacity: 1, x: [-10, 8, -6, 0], y: [-6, 10, 4, -2], rotate: [-6, 8, -4, 0] }}
      transition={reducedMotion ? { duration: 0.2 } : { duration: 18, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
    >
      <motion.div className="ambient-orb orb-one" animate={reducedMotion ? { scale: 1 } : { scale: [1, 1.04, 1.02, 1], x: [0, 12, -8, 6] }} transition={reducedMotion ? { duration: 0.2 } : { duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="ambient-orb orb-two" animate={reducedMotion ? { scale: 1 } : { scale: [1, 1.06, 1.03, 1], y: [0, -10, 8, -4] }} transition={reducedMotion ? { duration: 0.2 } : { duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="ambient-orb orb-three" animate={reducedMotion ? { scale: 1 } : { scale: [1, 1.03, 1.05, 1], x: [0, -10, 10, -4] }} transition={reducedMotion ? { duration: 0.2 } : { duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
    </motion.div>
  );
}

function TeamPulseGraph({ nodes, reducedMotion, activeNode, setActiveNode }) {
  const positions = [
    { cx: 160, cy: 76 },
    { cx: 86, cy: 162 },
    { cx: 236, cy: 162 },
  ];

  return (
    <div className="pulse-graph-shell">
      <svg viewBox="0 0 320 240" className="pulse-graph" role="img" aria-label="Team workload graph">
        <line x1="160" y1="76" x2="86" y2="162" />
        <line x1="160" y1="76" x2="236" y2="162" />
        <line x1="86" y1="162" x2="236" y2="162" />
        {nodes.map((node, index) => {
          const position = positions[index];
          const radius = 18 + node.count * 3.4;
          const color = node.severity === 'red' ? '#EF4444' : node.severity === 'amber' ? '#F59E0B' : '#14B8A6';
          const ringAnimator = reducedMotion ? {} : {
            scale: [1, 1.05, 1],
            y: [0, -5, 0],
            x: [0, 2, 0],
          };

          return (
            <g key={node.name}>
              {node.severity !== 'none' ? (
                <motion.circle
                  cx={position.cx}
                  cy={position.cy}
                  r={radius + 8}
                  className={`pulse-ring ${node.severity.toLowerCase()}`}
                  animate={ringAnimator}
                  transition={reducedMotion ? { duration: 0.2 } : { duration: 1.8 + index * 0.12, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                />
              ) : null}
              <motion.g
                whileHover={{ scale: 1.06, y: -3 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                onMouseEnter={() => setActiveNode(node.name)}
                onMouseLeave={() => setActiveNode(null)}
              >
                <motion.circle
                  cx={position.cx}
                  cy={position.cy}
                  r={radius}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  animate={reducedMotion ? {} : { y: [0, -3, 0], x: [0, 1, 0] }}
                  transition={reducedMotion ? { duration: 0.2 } : { duration: 2.1 + index * 0.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                />
              </motion.g>
              <text x={position.cx} y={position.cy - radius - 10} className="node-label">{node.name}</text>
              <text x={position.cx} y={position.cy + 4} className="node-metric">{node.count} tasks</text>
              <text x={position.cx} y={position.cy + 24} className="node-metric">Due {node.dueDate}</text>
            </g>
          );
        })}
      </svg>
      {activeNode ? (
        <div className="graph-tooltip">
          <strong>{activeNode}</strong>
          <p>{nodes.find((node) => node.name === activeNode)?.reason || 'Top owner in this transcript.'}</p>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const [transcript, setTranscript] = useState(sampleTranscripts.clean);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [activeGraphNode, setActiveGraphNode] = useState(null);

  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' or 'stressTest'
  const [draft, setDraft] = useState('');
  const [stressLoading, setStressLoading] = useState(false);
  const [stressError, setStressError] = useState('');
  const [stressResult, setStressResult] = useState(null);
  
  const generateDraft = () => {
    if (!analysis) return;
    const decisions = analysis.decisions.join('. ');
    const actions = analysis.actionItems.map(i => `${i.owner} will ${i.task}`).join(', ');
    const newDraft = `Based on today's meeting, ${decisions}. ${actions}.`;
    setDraft(newDraft);
    setActiveTab('stressTest');
  };

  const calculateFrictionScore = (factors) => {
    if (!factors) return 0;
    let score = 0;
    const weights = { tone: 0.2, deadlinePressure: 0.3, workloadImpact: 0.2, overtimeConcern: 0.15, ambiguity: 0.1, fairness: 0.05 };
    for (const key in weights) {
      if (factors[key]) {
        score += factors[key] * weights[key];
      }
    }
    return Math.round(score);
  };

  const frictionScore = stressResult ? calculateFrictionScore(stressResult.frictionFactors) : null;
  const commRiskSeverity = frictionScore === null ? 'none' : frictionScore >= 70 ? 'red' : frictionScore >= 40 ? 'amber' : 'none';

  const handleStressTest = async () => {
    if (!draft.trim()) {
      setStressError('Please enter a draft message.');
      return;
    }
    setStressLoading(true);
    setStressError('');
    try {
      const response = await fetch('/api/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Stress test failed.');
      setStressResult(data);
    } catch (err) {
      setStressError(err.message);
    } finally {
      setStressLoading(false);
    }
  };

  const requestIdRef = useRef(0);
  const reducedMotion = useReducedMotion();

  const loadingMessages = [
    'Analyzing meeting...',
    'Extracting decisions...',
    'Finding action items...',
    'Calculating workload...',
    'Generating AI recommendations...',
  ];

  useEffect(() => {
    if (!loading) return undefined;
    const interval = window.setInterval(() => {
      setLoadingPhase((previous) => (previous + 1) % loadingMessages.length);
    }, 1250);
    return () => window.clearInterval(interval);
  }, [loading, loadingMessages.length]);

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError('Please paste a transcript before analyzing.');
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    setLoading(true);
    setError('');
    setActiveGraphNode(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error('The analysis service returned an error.');
      }

      const payload = await response.json();
      if (!isValidAnalysisPayload(payload)) {
        throw new Error('The analysis response was malformed or incomplete.');
      }

      if (currentRequestId === requestIdRef.current) {
        setAnalysis(payload);
        if (payload.fallback) {
          setError(payload.demoMode
            ? 'No Anthropic key is configured. Showing local demo analysis.'
            : `Anthropic call failed. Showing local fallback analysis instead. ${payload.fallbackReason ?? ''}`.trim());
        }
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        console.warn('Falling back to local analysis.', err);
        setAnalysis(fallbackAnalysis(transcript));
        setError('The AI response was malformed. Showing fallback analysis instead.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
        setLoadingPhase(0);
      }
    }
  };

  const handleSample = (sampleKey) => {
    setTranscript(sampleTranscripts[sampleKey]);
    setError('');
  };

  const summaryCards = useMemo(() => {
    if (!analysis) {
      return [
        { title: 'Decisions Found', value: '0', detail: 'Waiting for a transcript', accent: '#2DA8D8', trend: [14, 24, 36] },
        { title: 'Action Items', value: '0', detail: 'Waiting for a transcript', accent: '#2DA8D8', trend: [18, 28, 42] },
        { title: 'High-Risk Owners', value: '0', detail: 'Waiting for a transcript', accent: '#F59E0B', trend: [10, 20, 32] },
        { title: 'Team Health', value: '—', detail: 'Waiting for a transcript', accent: '#14B8A6', trend: [20, 30, 44] },
        { title: 'Communication Risk', value: '—', detail: 'Not tested yet', accent: '#14B8A6', trend: [16, 24, 34] },
      ];
    }

    const communicationRiskAccent = commRiskSeverity === 'red' ? '#EF4444' : commRiskSeverity === 'amber' ? '#F59E0B' : '#14B8A6';

    return [
      { title: 'Decisions Found', value: analysis.summary.decisions.toString(), detail: 'From this transcript', accent: '#2DA8D8', trend: [24, 42, 60] },
      { title: 'Action Items', value: analysis.summary.actionItems.toString(), detail: 'Current workload signal', accent: '#2DA8D8', trend: [20, 36, 52] },
      { title: 'High-Risk Owners', value: analysis.summary.highRiskOwners.toString(), detail: 'Need attention', accent: '#F59E0B', trend: [12, 24, 40] },
      { title: 'Team Health', value: analysis.summary.teamHealth, detail: 'For this transcript', accent: '#14B8A6', trend: [18, 30, 46] },
      { title: 'Communication Risk', value: stressResult ? frictionScore.toString() : '—', detail: stressResult ? 'Friction score / 100' : 'Not tested yet', accent: stressResult ? communicationRiskAccent : '#14B8A6', trend: [16, 24, 34], riskSeverity: stressResult ? commRiskSeverity : null },
    ];
  }, [analysis, commRiskSeverity, frictionScore, stressResult]);

  const heroTone = analysis?.hero?.severity === 'red' ? 'warning' : analysis?.hero?.severity === 'amber' ? 'warning-amber' : 'success';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div>
          <div className="brand-block">
            <div className="brand-mark">P</div>
            <div>
              <h1>Pulse</h1>
              <p>Meeting-to-Workload Intelligence</p>
            </div>
          </div>

          <motion.div className="sidebar-meta" initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <span className="sidebar-pill">One flow</span>
            <span className="sidebar-pill">Live synthesis</span>
          </motion.div>

          <div className="sidebar-note">
            Paste a transcript, surface decisions, risks, and owners in one polished view.
          </div>
        </div>

        <div className="sidebar-footer">Built for premium launch demos</div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle navigation">
              ☰
            </button>
            <div>
              <h2>Workspace Pulse</h2>
              <p>Turn every meeting into actionable workload intelligence.</p>
            </div>
          </div>

          
            <div className="topbar-actions">
              <div className="search-pill" style={{ cursor: 'pointer', background: activeTab === 'analysis' ? 'rgba(45, 168, 216, 0.1)' : 'transparent' }} onClick={() => setActiveTab('analysis')}>📊 Analysis</div>
              <div className="search-pill" style={{ cursor: 'pointer', background: activeTab === 'stressTest' ? 'rgba(45, 168, 216, 0.1)' : 'transparent' }} onClick={() => setActiveTab('stressTest')}>🧪 Stress Test</div>

            <div className="search-pill">⌕ Review</div>
            <div className="icon-pill">🔔</div>
            <div className="avatar-pill">MG</div>
          </div>
        </header>

        <main className="content-stack">
          <AmbientBackground reducedMotion={reducedMotion} />
 {activeTab === 'analysis' && (


          <motion.section className="hero-card" initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} whileHover={{ y: -3, scale: 1.005 }}>
            <div className="hero-copy">
              <p className="eyebrow">AI workspace intelligence</p>
              <h3>Paste a meeting transcript</h3>
              <p>One analysis extracts decisions, tasks, workload risk, and follow-up recommendations.</p>
            </div>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Paste your meeting transcript or notes here..."
              aria-label="Meeting transcript input"
            />
            <div className="hero-actions">
              <motion.button type="button" className="primary-btn" onClick={handleAnalyze} disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 280, damping: 18 }}>
                {loading ? 'Analyzing…' : 'Analyze Meeting'}
              </motion.button>
              <motion.button type="button" className="secondary-btn" onClick={() => handleSample('clean')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>Try Clean Sample</motion.button>
              <motion.button type="button" className="secondary-btn" onClick={() => handleSample('messy')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>Try Messy Sample</motion.button>
            </div>
            {error ? <div className="error-box">{error}</div> : null}
          </motion.section>

          )}
<AnimatePresence mode="wait">

          {activeTab === 'stressTest' && (
            <motion.div className="results-shell" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <section className="hero-card card">
                <div className="hero-copy">
                  <p className="eyebrow">Stress Test</p>
                  <h3>Test your follow-up message</h3>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Draft your follow-up message..."
                  style={{ minHeight: '120px' }}
                />
                <div className="hero-actions" style={{ marginTop: '16px' }}>
                  <button className="primary-btn" onClick={handleStressTest} disabled={stressLoading}>{stressLoading ? 'Testing...' : 'Stress Test'}</button>
                </div>
                {stressError && <div className="error-box" style={{ marginTop: '16px' }}>{stressError}</div>}
              </section>
              
              {stressResult && (
                <section className="results-grid" style={{ marginTop: '24px' }}>
                  <div className="card">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Friction Score</p>
                        <h3>{frictionScore}/100 - {frictionScore >= 70 ? 'CRITICAL' : frictionScore >= 40 ? 'MODERATE' : 'LOW'}</h3>
                      </div>
                    </div>
                    <p style={{ fontStyle: 'italic', fontSize: '0.9em', opacity: 0.8, marginTop: '8px' }}>
                      Simulated stakeholder perspectives to help you think through the message — not a prediction of any individual's actual reaction.
                    </p>
                  </div>
                  
                  {stressResult.personas.map(p => (
                    <div className="card" key={p.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <strong style={{ display: 'block' }}>{p.name}</strong>
                          <span style={{ fontSize: '0.85em', opacity: 0.7 }}>{p.role}</span>
                        </div>
                        <span className={"badge " + (p.concernLevel === 'none' ? 'low' : p.concernLevel === 'moderate' ? 'medium' : p.concernLevel === 'high' ? 'high' : 'urgent')}>{p.concernLevel.toUpperCase()}</span>
                      </div>
                      {p.concernLevel !== 'none' && (
                        <>
                          <p><strong>Objection:</strong> {p.objection}</p>
                          <p><strong>Triggers:</strong> {p.triggerPhrases.map(t => <span key={t} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', margin: '0 4px', fontSize: '0.85em' }}>{t}</span>)}</p>
                          <p style={{ marginTop: '8px' }}><strong>Suggestion:</strong> {p.suggestion}</p>
                        </>
                      )}
                      {p.concernLevel === 'none' && (
                         <p>{p.reason}</p>
                      )}
                    </div>
                  ))}
                  
                  <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Suggested Rewrite</p>
                        <h3>Lower Friction Alternative</h3>
                      </div>
                    </div>
                    <p style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>{stressResult.rewrite}</p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button className="secondary-btn" onClick={() => navigator.clipboard.writeText(stressResult.rewrite)}>Copy Rewrite</button>
                      <button className="secondary-btn" onClick={() => { setDraft(stressResult.rewrite); setStressResult(null); }}>Edit & Retest</button>
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          )}

            {activeTab === 'analysis' && (loading ? (
              <motion.section key="loading" className="loading-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-live="polite">
                <motion.div className="loading-orb" animate={reducedMotion ? { scale: 1 } : { scale: [1, 1.06, 1], y: [0, -4, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }} />
                <AnimatePresence mode="wait">
                  <motion.h3 key={loadingMessages[loadingPhase]} className="loading-phase" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                    {loadingMessages[loadingPhase]}
                  </motion.h3>
                </AnimatePresence>
                <p>Pulse is correlating decisions, owners, and deadlines.</p>
              </motion.section>
            ) : analysis ? (
              
              <motion.div key="results" className="results-shell" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                   <motion.button type="button" className="primary-btn" onClick={generateDraft} whileHover={{ scale: 1.02 }}>Draft Follow-up Message</motion.button>
                </div>

                <motion.section className={`hero-insight card ${heroTone}`} initial={reducedMotion ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.25 }}>
                  <div className="hero-insight-icon">{heroTone === 'warning' ? '⚠' : '✓'}</div>
                  <div>
                    <p className="eyebrow">AI insight</p>
                    <h3>{analysis.hero.title}</h3>
                    <p>{analysis.hero.body}</p>
                    <p className="recommendation">Recommendation: {analysis.hero.recommendation}</p>
                  </div>
                </motion.section>

                <section className="summary-grid">
                  {summaryCards.map((card, index) => (
                    <motion.article
                      key={card.title}
                      className="card summary-card"
                      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.26, delay: index * 0.07 }}
                      whileHover={{ y: -3, scale: 1.01 }}
                    >
                      <div className="summary-icon" style={{ color: card.accent }}>
                        {card.title.includes('Decisions') ? '🧠' : card.title.includes('Action') ? '✓' : card.title.includes('High') ? '⚠' : '💚'}
                      </div>
                      <div className="summary-copy">
                        <h4>{card.value === '—' ? card.value : card.riskSeverity ? <><AnimatedCounter value={card.value} accent={card.accent} suffix="/100" /> <span className={`badge ${card.riskSeverity}`}>{card.riskSeverity === 'none' ? 'LOW' : card.riskSeverity.toUpperCase()}</span></> : <AnimatedCounter value={card.value.replace(/[^0-9]/g, '')} accent={card.accent} suffix={card.value.includes('%') ? '%' : ''} />}</h4>
                        <p>{card.title}</p>
                        <span>{card.detail}</span>
                      </div>
                      <div className="summary-trend" aria-hidden="true">
                        {card.trend.map((height, trendIndex) => (
                          <span key={`${card.title}-${trendIndex}`} style={{ height: `${height}%`, backgroundColor: card.accent }} />
                        ))}
                      </div>
                    </motion.article>
                  ))}
                </section>

                <motion.section className="card graph-card" initial={reducedMotion ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.3, delay: 0.08 }}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Team pulse graph</p>
                      <h3>Owner load for this transcript</h3>
                    </div>
                  </div>
                  <TeamPulseGraph nodes={analysis.graph} reducedMotion={reducedMotion} activeNode={activeGraphNode} setActiveNode={setActiveGraphNode} />
                </motion.section>

                <section className="results-grid">
                  <motion.article className="card" initial={reducedMotion ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.22, delay: 0.1 }} whileHover={{ y: -2, scale: 1.004 }}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Decisions</p>
                        <h3>Key decisions</h3>
                      </div>
                    </div>
                    <ul className="bullet-list">
                      {analysis.decisions.map((decision) => (
                        <li key={decision}>{decision}</li>
                      ))}
                    </ul>
                  </motion.article>

                  <motion.article className="card" initial={reducedMotion ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.22, delay: 0.14 }} whileHover={{ y: -2, scale: 1.004 }}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Action items</p>
                        <h3>Owned next steps</h3>
                      </div>
                    </div>
                    <div className="action-list">
                      {analysis.actionItems.map((item) => (
                        <div key={item.task} className="action-item">
                          <div>
                            <strong>{item.task}</strong>
                            <p>{item.owner} • Due {item.dueDate}</p>
                          </div>
                          <span className={`badge ${item.risk.toLowerCase()}`}>{item.risk}</span>
                        </div>
                      ))}
                    </div>
                  </motion.article>
                </section>

                <section className="results-grid lower-grid">
                  <motion.article className="card" initial={reducedMotion ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.22, delay: 0.18 }} whileHover={{ y: -2, scale: 1.004 }}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Risk analysis</p>
                        <h3>Why workload is uneven</h3>
                      </div>
                    </div>
                    <div className="risk-list">
                      {analysis.riskOwners.map((owner) => (
                        <div key={owner.name} className="risk-item">
                          <div className="risk-meta">
                            <strong>{owner.name}</strong>
                            <span className={`badge ${owner.severity.toLowerCase()}`}>{owner.severity}</span>
                          </div>
                          <p>{owner.reason}</p>
                          <small>{owner.count} urgent tasks • {owner.urgency} overlapping deadlines</small>
                        </div>
                      ))}
                    </div>
                  </motion.article>

                  <motion.article className="card" initial={reducedMotion ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.22 }} transition={{ duration: 0.22, delay: 0.22 }} whileHover={{ y: -2, scale: 1.004 }}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">AI nudges</p>
                        <h3>Guidance for the team</h3>
                      </div>
                    </div>
                    <div className="nudges-list">
                      {analysis.nudges.map((nudge) => (
                        <div key={`${nudge.name}-${nudge.kind}`} className={`nudge-bubble ${nudge.kind}`}>
                          <strong>{nudge.name}</strong>
                          <p>{nudge.message}</p>
                        </div>
                      ))}
                    </div>
                  </motion.article>
                </section>
              </motion.div>
            ) : null)}
          </AnimatePresence>
        </main>

        <footer className="footer">
          Built with React + Claude • Meeting-to-Workload Intelligence • Hackathon MVP
        </footer>
      </div>
    </div>
  );
}

export default App;
