import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assess, verifyClosure } from '../src/clinical.js';
import { runReview } from '../src/agent.js';
import { applyDecision, createReport } from '../src/workflow.js';
import { buildGraph } from '../src/graph.js';

const fixture = async () => JSON.parse(await readFile(new URL('../data/third-case.json', import.meta.url), 'utf8'));

test('a silent home-to-discharge dose change needs a source-linked clinician decision', async () => {
  const original = await fixture();
  const initial = assess(original);
  assert.equal(initial.length, 1);
  assert.equal(initial[0].id, 'HOME-CHANGE-M-AMLO');
  assert.equal(initial[0].type, 'home_regimen_change');
  assert.deepEqual(initial[0].sourceIds, ['DOC-HISTORY', 'DOC-DISCHARGE']);

  const reviewed = await runReview(original, { planner: null });
  assert.equal(reviewed.phase, 'awaiting_clinician');
  assert.equal(verifyClosure(reviewed).ready, false);
  const graph = buildGraph(reviewed);
  assert(graph.edges.some((edge) => edge.from === 'home:M-AMLO' && edge.to === 'HOME-CHANGE-M-AMLO'));
  assert(graph.edges.some((edge) => edge.from === 'discharge:M-AMLO' && edge.to === 'HOME-CHANGE-M-AMLO'));

  const decided = applyDecision(reviewed, {
    findingId: 'HOME-CHANGE-M-AMLO', action: 'confirm_change', reviewer: 'Dr Example (simulation)',
    note: 'Reviewed the source history and discharge draft; approved the documented fictional change.'
  });
  assert.equal(verifyClosure(decided).ready, true);
  assert.equal(assess(decided).length, 0);
  const report = createReport(decided);
  assert.match(report.report.text, /5 mg/);
  assert.match(report.report.text, /10 mg/);
  assert.match(report.report.text, /confirm_change/);

  const alteredAfterDecision = structuredClone(decided);
  alteredAfterDecision.dischargeOrders[0].dose = '20 mg';
  alteredAfterDecision.patientInstructions[0].dose = '20 mg';
  assert.equal(verifyClosure(alteredAfterDecision).ready, false);
  const replacedSourceAfterDecision = structuredClone(decided);
  replacedSourceAfterDecision.dischargeOrders[0].sourceId = 'DOC-HOSPITAL';
  assert.equal(verifyClosure(replacedSourceAfterDecision).ready, false);

  const renamedOrder = await fixture();
  renamedOrder.dischargeOrders[0].id = 'M-AMLO-DISCHARGE';
  renamedOrder.patientInstructions[0].id = 'M-AMLO-DISCHARGE';
  const renamedReview = await runReview(renamedOrder, { planner: null });
  assert.equal(renamedReview.findings[0].orderId, 'M-AMLO-DISCHARGE');
  assert(buildGraph(renamedReview).edges.some((edge) => edge.from === 'discharge:M-AMLO-DISCHARGE' && edge.to === 'HOME-CHANGE-M-AMLO'));
  const renamedDecision = applyDecision(renamedReview, {
    findingId: 'HOME-CHANGE-M-AMLO', action: 'confirm_change', reviewer: 'Dr Example (simulation)',
    note: 'Reviewed the fictional history and differently identified discharge order.'
  });
  assert.equal(verifyClosure(renamedDecision).ready, true);
});
