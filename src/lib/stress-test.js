export function buildLocalStressTest(draft, personas) {
  const lower = (draft || '').toLowerCase();
  
  // Adaptivity checks based on draft content
  const hasUrgency = /(tonight|immediately|asap|overtime|urgent|now|weekend)/.test(lower);
  const hasShortDeadline = /(tomorrow|end of day|eod|morning)/.test(lower);
  const hasFlexibility = /(flexible|if possible|let me know|collaborate|discuss)/.test(lower);
  const hasDirectives = /(must|need to|required|mandatory)/.test(lower);
  
  const frictionFactors = {
    tone: hasDirectives && !hasFlexibility ? 80 : 30,
    deadlinePressure: hasShortDeadline ? 85 : 20,
    workloadImpact: hasUrgency ? 70 : 30,
    overtimeConcern: hasUrgency && !hasFlexibility ? 90 : 10,
    ambiguity: hasFlexibility ? 40 : 20,
    fairness: hasDirectives ? 60 : 30
  };

  const generatedPersonas = personas.map(p => {
    let concernScore = 10;
    let concernLevel = 'none';
    let objection = 'No major concerns.';
    let triggerPhrases = [];
    let reason = 'The message appears reasonable.';
    let suggestion = 'None needed.';

    if (p.name.includes('Developer') || p.role.includes('Engineer')) {
      if (hasShortDeadline || hasUrgency) {
        concernScore = 85;
        concernLevel = 'high';
        objection = 'Unrealistic deadlines lead to technical debt.';
        triggerPhrases = [hasUrgency ? 'urgent/tonight' : 'tomorrow'];
        reason = 'Engineers need time to properly implement and test.';
        suggestion = 'Provide more flexible timeline or reduce scope.';
      }
    } else if (p.name.includes('HR') || p.role.includes('People')) {
      if (hasUrgency && !hasFlexibility) {
        concernScore = 90;
        concernLevel = 'critical';
        objection = 'Mandatory overtime without notice is a wellness risk.';
        triggerPhrases = ['tonight', 'immediately'];
        reason = 'Employee burnout and compliance with work hour policies.';
        suggestion = 'Frame as an exceptional request and offer time off in lieu.';
      }
    } else if (p.name.includes('Product')) {
      if (hasDirectives && !hasFlexibility) {
        concernScore = 60;
        concernLevel = 'moderate';
        objection = 'This might demoralize the team right before launch.';
        triggerPhrases = ['must', 'need to'];
        reason = 'Morale is important for sustained productivity.';
        suggestion = 'Acknowledge the team\'s hard work in the message.';
      }
    }
    
    return {
      name: p.name,
      role: p.role,
      concernScore,
      concernLevel,
      objection,
      triggerPhrases,
      reason,
      suggestion
    };
  });

  return {
    intentSummary: "Attempting to communicate a status or request to the team.",
    frictionFactors,
    personas: generatedPersonas,
    rewrite: hasUrgency || hasShortDeadline 
      ? "I know this is short notice, but if anyone has capacity to help look into this today, it would be hugely appreciated. We can adjust other priorities to make room."
      : "Just wanted to share an update on our progress and align on next steps."
  };
}
