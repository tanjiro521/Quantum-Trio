import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalAnalysis } from './analysis.js';

test('analysis changes based on transcript content', () => {
  const launchSummary = buildLocalAnalysis('We are launching next week and need QA coverage before release.');
  const supportSummary = buildLocalAnalysis('We are helping support and processing customer feedback this week.');

  assert.notEqual(launchSummary.hero.title, supportSummary.hero.title);
  assert.notEqual(launchSummary.actionItems[0].task, supportSummary.actionItems[0].task);
  assert.notEqual(launchSummary.graph[0].name, supportSummary.graph[0].name);
});
