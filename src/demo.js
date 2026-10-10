import './env.js';
import { injectTraceContext, trace } from 'neatlogs';
import { initializeAgent, closeAgent, runReview } from './agent.js';
import { buildGraph } from './graph.js';
import { loadFixture } from './store.js';
import { applyDecision, checkReminder, createReport } from './workflow.js';

const failure = process.argv.includes('--failure');
const reviewer = 'Dr Demo Reviewer (simulation)';
const note = 'Reviewed the cited fictional source record and approved this documented correction for the demo.';

const telemetryReady = Boolean(process.env.NEATLOGS_API_KEY);
const observed = (kind, name, work) => telemetryReady
  ? trace({ kind, name, captureInput: false, captureOutput: false }, work)
  : work();

async function runDemo() {
  if (telemetryReady) {
    const carrier = {};
    if (injectTraceContext(carrier)) {
      const traceId = carrier.traceparent?.match(/^00-([a-f0-9]{32})-/i)?.[1];
      if (traceId) console.log(`Neatlogs trace ID: ${traceId}`);
    }
  }
  let caseFile = await loadFixture();
  console.log(`Lognac synthetic case: ${caseFile.id}`);
  caseFile = await runReview(caseFile, { injectFailure: failure });
  console.log(`Agent mode: ${caseFile.agentMode}`);
  for (const finding of caseFile.findings) console.log(`OPEN ${finding.severity.toUpperCase()} ${finding.id}: ${finding.title}`);
  const actions = [
    { findingId: 'INSTRUCTION-MISMATCH-M-AMLO', action: 'align_to_order' },
    { findingId: 'ALLERGY-M-AMOX', action: 'replace_with_prior_order', replacementId: 'M-DOXY', supplyDays: 5 },
    { findingId: 'ALERT-M-HEAL-WHO-2-2025-HEALMOXY', action: 'record_not_in_use' },
    { findingId: 'SUPPLY-M-AMLO', action: 'arrange_supply', supplyDays: 21 }
  ];
  for (const action of actions) {
    caseFile = await observed('TASK', 'simulated_clinician_decision', () =>
      applyDecision(caseFile, { ...action, reviewer, note }));
  }
  caseFile = await observed('GUARDRAIL', 'document_consistency_gate', () => createReport(caseFile));
  caseFile = await observed('TASK', 'due_time_reminder', () =>
    checkReminder(caseFile, new Date(caseFile.reminder.at)));
  const graph = buildGraph(caseFile);
  console.log(`FINAL ${caseFile.phase}: ${caseFile.findings.length} documented decisions; ${graph.nodes.length} graph nodes; ${graph.edges.length} source links.`);
  if (failure) console.log(`Recovery events: ${caseFile.events.filter((event) => event.kind === 'recovery').length}`);
  console.log('\n' + caseFile.report.text);
}

await initializeAgent();
try {
  await observed('WORKFLOW', 'complete_discharge_review', runDemo);
} finally {
  await closeAgent();
}
