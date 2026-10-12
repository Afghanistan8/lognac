import './env.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { injectTraceContext, trace } from 'neatlogs';
import { initializeAgent, closeAgent, runReview } from './agent.js';
import { applyDecision, createReport } from './workflow.js';
import { assess } from './clinical.js';
import { buildGraph } from './graph.js';

const observed = (kind, name, work) => process.env.NEATLOGS_API_KEY
  ? trace({ kind, name, captureInput: false, captureOutput: false }, work)
  : work();

async function run() {
  if (process.env.NEATLOGS_API_KEY) {
    const carrier = {};
    if (injectTraceContext(carrier)) {
      const traceId = carrier.traceparent?.match(/^00-([a-f0-9]{32})-/i)?.[1];
      if (traceId) console.log(`Neatlogs trace ID: ${traceId}`);
    }
  }
  let caseFile = JSON.parse(await readFile(new URL('../data/third-case.json', import.meta.url), 'utf8'));
  caseFile = await runReview(caseFile);
  const finding = caseFile.findings.find((item) => item.id === 'HOME-CHANGE-M-AMLO');
  if (!finding || caseFile.findings.length !== 1) throw new Error('The fictional dose change was not isolated as expected.');
  console.log(`OPEN ${finding.id}: ${finding.detail}`);
  const before = buildGraph(caseFile);
  caseFile = await observed('TASK', 'simulated_clinician_change_review', () =>
    applyDecision(caseFile, {
      findingId: finding.id, action: 'confirm_change', reviewer: 'Dr Demo Reviewer (simulation)',
      note: 'Reviewed the fictional home history and discharge draft; confirmed this change for the demo case.'
    }));
  caseFile = await observed('GUARDRAIL', 'document_consistency_gate', () => createReport(caseFile));
  const after = buildGraph(caseFile);
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(new URL('../.local/dose-change-evidence.json', import.meta.url), JSON.stringify({
    caseId: caseFile.id, phase: caseFile.phase, agentMode: caseFile.agentMode,
    discrepancy: finding.id, homeDose: caseFile.homeMedications[0].dose,
    dischargeDose: caseFile.dischargeOrders[0].dose,
    decision: caseFile.decisions[finding.id], residual: assess(caseFile).length,
    report: caseFile.report,
    beforeGraph: before, afterGraph: after
  }, null, 2));
  console.log(`FINAL ${caseFile.phase}; 1 source-linked decision; 0 unresolved checks; ${after.nodes.length} graph nodes; ${after.edges.length} links.`);
}

await initializeAgent();
try {
  await observed('WORKFLOW', 'complete_dose_change_review', run);
} finally {
  await closeAgent();
}
