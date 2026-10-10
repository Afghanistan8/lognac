import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/store.js';
import { assess, checkAlerts, replacementCandidates, verifyClosure } from '../src/clinical.js';
import { runReview } from '../src/agent.js';
import { applyDecision, createReport, acknowledgeReminder, checkReminder } from '../src/workflow.js';
import { buildGraph } from '../src/graph.js';

test('flags a recorded allergy, exact WHO batch, wrong instruction and ongoing supply gap', async () => {
  const sample = await loadFixture();
  const ids = assess(sample).map((f) => f.id);
  assert(ids.includes('ALLERGY-M-AMOX'));
  assert(ids.includes('INSTRUCTION-MISMATCH-M-AMLO'));
  assert(ids.includes('ALERT-M-HEAL-WHO-2-2025-HEALMOXY'));
  assert(ids.includes('SUPPLY-M-AMLO'));
  assert(!ids.includes('SUPPLY-M-AMOX'), 'short antibiotic course is not treated as an ongoing supply gap');
});

test('WHO notice is not generalized to another batch or brand', async () => {
  const sample = await loadFixture();
  sample.homeMedications[1].batch = 'UNRELATED';
  assert.equal(checkAlerts(sample).length, 0);
  sample.homeMedications[1].batch = '023011';
  sample.homeMedications[1].name = 'Another brand';
  assert.equal(checkAlerts(sample).length, 0);
});

test('replacement candidates must match the indication and avoid a confirmed allergy', async () => {
  const sample = await loadFixture();
  assert.deepEqual(replacementCandidates(sample, 'M-AMOX').map((m) => m.id), ['M-DOXY']);
  sample.hospitalOrders[1].indicationId = 'C-HYP';
  assert.deepEqual(replacementCandidates(sample, 'M-AMOX'), []);
});

test('unmatched instructions and unknown ongoing supply fail closed', async () => {
  const sample = await loadFixture();
  sample.patientInstructions.push({ ...sample.patientInstructions[1], id: 'M-EXTRA', name: 'Unordered medicine' });
  delete sample.dischargeOrders[0].supplyDays;
  const ids = assess(sample).map((finding) => finding.id);
  assert(ids.includes('EXTRA-INSTRUCTION-M-EXTRA'));
  assert(ids.includes('SUPPLY-M-AMLO'));
  assert.equal(verifyClosure(sample).ready, false);
});

test('case cannot close until clinician decisions correct the source documents', async () => {
  let sample = await runReview(await loadFixture());
  assert.equal(sample.phase, 'awaiting_clinician');
  assert.throws(() => createReport(sample), /clinician decisions/i);
  const reviewer = 'Dr Example (simulation)';
  const note = 'Checked the original source and approved this correction for the fictional case.';
  const actions = [
    { findingId: 'INSTRUCTION-MISMATCH-M-AMLO', action: 'align_to_order' },
    { findingId: 'ALLERGY-M-AMOX', action: 'replace_with_prior_order', replacementId: 'M-DOXY', supplyDays: 5 },
    { findingId: 'ALERT-M-HEAL-WHO-2-2025-HEALMOXY', action: 'record_not_in_use' },
    { findingId: 'SUPPLY-M-AMLO', action: 'arrange_supply', supplyDays: 21 }
  ];
  for (const action of actions) sample = applyDecision(sample, { ...action, reviewer, note });
  assert.equal(sample.phase, 'ready_to_finalize');
  assert.equal(verifyClosure(sample).ready, true);
  sample = createReport(sample);
  assert.equal(sample.phase, 'finalized');
  assert.match(sample.report.text, /FICTIONAL DEMO RECORD/);
  assert.match(sample.report.text, /Doxycycline/);
  assert(!sample.patientInstructions.some((m) => m.id === 'M-AMOX'));
  assert(buildGraph(sample).nodes.some((n) => n.id === 'baseline:discharge:M-AMOX'));
  assert(buildGraph(sample).nodes.some((n) => n.id === 'baseline:instruction:M-AMLO'));
  assert.equal(sample.reminder.status, 'scheduled');
  assert.throws(() => acknowledgeReminder(sample), /must be due/);
  sample = checkReminder(sample, new Date(sample.reminder.at));
  assert.equal(sample.reminder.status, 'due');
  sample = acknowledgeReminder(sample);
  assert.equal(sample.reminder.status, 'acknowledged');
});

test('invalid clinical resolution cannot bypass the closure gate', async () => {
  const sample = await runReview(await loadFixture());
  const note = 'Reviewed the original source document for the fictional patient.';
  assert.throws(() => applyDecision(sample, { findingId: 'ALLERGY-M-AMOX', action: 'align_to_order', reviewer: 'Dr Example', note }), /not valid/);
  assert.throws(() => applyDecision(sample, { findingId: 'SUPPLY-M-AMLO', action: 'arrange_supply', reviewer: 'Dr Example', note, supplyDays: 1 }), /at least/);
  assert.throws(() => applyDecision(sample, { findingId: 'ALLERGY-M-AMOX', action: 'replace_with_prior_order', replacementId: 'M-AMLO', supplyDays: 5, reviewer: 'Dr Example', note }), /same recorded condition/);
  assert.equal(verifyClosure(sample).ready, false);
});

test('agent retries a failed safety tool and records recovery', async () => {
  const sample = await runReview(await loadFixture(), { injectFailure: true });
  assert(sample.findings.some((f) => f.type === 'safety_alert'));
  assert(sample.events.some((e) => e.kind === 'recovery' && /timed out/.test(e.text)));
});

test('evidence graph keeps medication stages and source links distinct', async () => {
  const graph = buildGraph(await loadFixture());
  assert(graph.nodes.some((n) => n.id === 'home:M-AMLO'));
  assert(graph.nodes.some((n) => n.id === 'hospital:M-AMLO'));
  assert(graph.nodes.some((n) => n.id === 'discharge:M-AMLO'));
  assert(graph.nodes.some((n) => n.id === 'instruction:M-AMLO'));
  assert(graph.edges.some((e) => e.from === 'discharge:M-AMLO' && e.to === 'instruction:M-AMLO'));
});
