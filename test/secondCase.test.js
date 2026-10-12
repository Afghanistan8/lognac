import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runReview } from '../src/agent.js';
import { assess, verifyClosure } from '../src/clinical.js';
import { applyDecision, checkReminder, createReport } from '../src/workflow.js';
import { buildGraph } from '../src/graph.js';

test('second synthetic case catches a missing home medicine and closes only after all three review decisions', async () => {
  const fixture = JSON.parse(await readFile(new URL('../data/second-case.json', import.meta.url), 'utf8'));
  let caseFile = await runReview(fixture, { planner: null });
  assert.deepEqual(caseFile.findings.map(({ id }) => id), [
    'INSTRUCTION-MISSING-M-AMLO', 'EXTRA-INSTRUCTION-M-IBU', 'HOME-OMISSION-M-METF'
  ]);
  assert.throws(() => createReport(caseFile), /clinician decisions/i);
  const reviewer = 'Dr Example (simulation)';
  const note = 'Reviewed the original fictional source records and documented the draft decision.';
  for (const action of [
    { findingId: 'INSTRUCTION-MISSING-M-AMLO', action: 'align_to_order' },
    { findingId: 'EXTRA-INSTRUCTION-M-IBU', action: 'remove_unordered_instruction' },
    { findingId: 'HOME-OMISSION-M-METF', action: 'restore_prior_order', supplyDays: 21 }
  ]) caseFile = applyDecision(caseFile, { ...action, reviewer, note });
  assert.equal(verifyClosure(caseFile).ready, true);
  assert.equal(assess(caseFile).length, 0);
  assert.deepEqual(caseFile.patientInstructions.map(({ id }) => id).sort(), ['M-AMLO', 'M-METF']);
  assert(buildGraph(caseFile).edges.some(({ from, to }) => from === 'home:M-METF' && to === 'HOME-OMISSION-M-METF'));
  caseFile = createReport(caseFile);
  assert.match(caseFile.report.text, /None recorded in the fictional source data/);
  assert.match(caseFile.report.text, /0 unresolved discrepancy checks/);
  caseFile = checkReminder(caseFile, new Date(caseFile.reminder.at));
  assert.equal(caseFile.reminder.status, 'due');
});
