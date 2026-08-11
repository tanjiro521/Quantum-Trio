import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalAnalysis } from './analysis.js';

test('buildLocalAnalysis returns transcript-specific action items', () => {
  const launchResult = buildLocalAnalysis('We are launching next week and need QA coverage before release.');
  const supportResult = buildLocalAnalysis('We are helping customers and reviewing support feedback this week.');

  assert.equal(launchResult.summary.actionItems > 0, true);
  assert.equal(supportResult.summary.actionItems > 0, true);
  assert.equal(launchResult.decisions.some((item) => item.includes('launch')), true);
  assert.equal(supportResult.decisions.some((item) => item.includes('review')), true);
});
