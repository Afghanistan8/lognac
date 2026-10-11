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
  sample.homeMedications[1].name = 'HEALMOXY';
  sample.homeMedications[1].batch = 'H026051';
  assert.equal(checkAlerts(sample).length, 1);
});

test('a missing batch on a reported product remains open until reviewed', async () => {
  let sample = await loadFixture();
  delete sample.homeMedications[1].batch;
  sample = await runReview(sample, { planner: null });
  const finding = sample.findings.find((item) => item.id === 'ALERT-M-HEAL-BATCH-UNKNOWN-WHO-2-2025-HEALMOXY');
  assert(finding);
  assert.match(finding.title, /needs batch verification/);
  sample = applyDecision(sample, {
    findingId: finding.id, action: 'record_not_in_use', reviewer: 'Dr Example (simulation)',
    note: 'Reviewed the reported pack and documented that it is not in use.'
  });
  assert(!assess(sample).some((item) => item.id === finding.id));
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
  const missingDecision = structuredClone(sample);
  delete missingDecision.decisions['ALLERGY-M-AMOX'];
  assert.equal(verifyClosure(missingDecision).ready, false);
  const missingSource = structuredClone(sample);
  missingSource.documents = missingSource.documents.filter((doc) => doc.id !== 'DOC-ALLERGY');
  assert.equal(verifyClosure(missingSource).ready, false);
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

test('graph links open concerns to the original evidence and retains corrected supply history', async () => {
  let sample = await runReview(await loadFixture(), { planner: null });
  let graph = buildGraph(sample);
  assert(graph.edges.some((e) => e.from === 'instruction:M-AMLO' && e.to === 'INSTRUCTION-MISMATCH-M-AMLO'));
  assert(graph.edges.some((e) => e.from === 'discharge:M-AMOX' && e.to === 'ALLERGY-M-AMOX'));
  assert(graph.edges.some((e) => e.from === 'discharge:M-AMLO' && e.to === 'SUPPLY-M-AMLO'));

  sample = applyDecision(sample, {
    findingId: 'SUPPLY-M-AMLO', action: 'arrange_supply', supplyDays: 21,
    reviewer: 'Dr Example (simulation)', note: 'Approved a supply of 21 days for the fictional case.'
  });
  graph = buildGraph(sample);
  assert(graph.nodes.some((node) => node.id === 'baseline:discharge:M-AMLO' && node.sourceId === 'DOC-DISCHARGE'));
  assert(graph.edges.some((e) => e.from === 'baseline:discharge:M-AMLO' && e.to === 'SUPPLY-M-AMLO'));
});

test('an active home medicine omitted at discharge requires a documented disposition', async () => {
  const fixture = await loadFixture();
  fixture.homeMedications.push({
    id: 'M-EXTRA-HOME', name: 'Example medicine', ingredient: 'example', strength: '1 mg',
    dose: '1 mg', route: 'oral', frequency: 'daily', status: 'active', sourceId: 'DOC-HISTORY'
  });
  fixture.hospitalOrders.push({
    id: 'M-EXTRA-HOME', name: 'Example medicine', ingredient: 'example', strength: '1 mg',
    dose: '1 mg', route: 'oral', frequency: 'daily', indicationId: 'C-HYP', sourceId: 'DOC-HOSPITAL'
  });
  const reviewed = await runReview(fixture, { planner: null });
  const finding = reviewed.findings.find((item) => item.id === 'HOME-OMISSION-M-EXTRA-HOME');
  assert.deepEqual(finding.actions, ['confirm_discontinued', 'restore_prior_order']);
  assert(buildGraph(reviewed).edges.some((edge) => edge.from === 'home:M-EXTRA-HOME' && edge.to === finding.id));
  assert.equal(verifyClosure({ ...reviewed, phase: 'ready_to_finalize' }).ready, false);

  const reviewer = 'Dr Example (simulation)';
  const note = 'Reviewed the home and inpatient records for this fictional case.';
  const stopped = applyDecision(reviewed, { findingId: finding.id, action: 'confirm_discontinued', reviewer, note });
  assert.equal(stopped.homeMedications.at(-1).status, 'discontinued-after-review');
  assert(!assess(stopped).some((item) => item.id === finding.id));
  assert.throws(() => applyDecision(reviewed, { findingId: finding.id, action: 'restore_prior_order', supplyDays: 1, reviewer, note }), /at least/);
  const continued = applyDecision(reviewed, { findingId: finding.id, action: 'restore_prior_order', supplyDays: 21, reviewer, note });
  assert(continued.dischargeOrders.some((medicine) => medicine.id === 'M-EXTRA-HOME' && medicine.supplyDays === 21));
  assert(continued.patientInstructions.some((medicine) => medicine.id === 'M-EXTRA-HOME'));
  assert(!assess(continued).some((item) => item.id === finding.id));
});
