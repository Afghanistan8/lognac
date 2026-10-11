// A four-span, real synthetic workflow to isolate hosted trace finalization.
import './env.js';
import { init, trace, injectTraceContext, flush, shutdown } from 'neatlogs';
import { loadFixture } from './store.js';
import { runReview } from './agent.js';
import { applyDecision, createReport, checkReminder } from './workflow.js';

const reviewer = 'Dr Demo Reviewer (simulation)';
const note = 'Reviewed the cited fictional source record and approved this documented correction for the demo.';
const actions = [
  { findingId: 'INSTRUCTION-MISMATCH-M-AMLO', action: 'align_to_order' },
  { findingId: 'ALLERGY-M-AMOX', action: 'replace_with_prior_order', replacementId: 'M-DOXY', supplyDays: 5 },
  { findingId: 'ALERT-M-HEAL-WHO-2-2025-HEALMOXY', action: 'record_not_in_use' },
  { findingId: 'SUPPLY-M-AMLO', action: 'arrange_supply', supplyDays: 21 }
];
const singleSpan = process.argv.includes('--single');
const observed = (options, work) => singleSpan ? work() : trace(options, work);

if (!process.env.NEATLOGS_API_KEY) throw new Error('NEATLOGS_API_KEY is required.');
await init({
  apiKey: process.env.NEATLOGS_API_KEY,
  endpoint: process.env.NEATLOGS_ENDPOINT || undefined,
  workflowName: 'lognac-synthetic-discharge-review',
  tags: ['synthetic-demo', 'uk']
});

try {
  const summary = await trace({ kind: 'WORKFLOW', name: 'lognac_synthetic_discharge_review', captureInput: false }, async () => {
    const carrier = {};
    if (injectTraceContext(carrier)) {
      const id = carrier.traceparent?.match(/^00-([a-f0-9]{32})-/i)?.[1];
      if (id) console.log(`Neatlogs trace ID: ${id}`);
    }
    let caseFile = await loadFixture();
    await observed({ kind: 'AGENT', name: 'review_source_records', captureInput: false }, async () => {
      caseFile = await runReview(caseFile, { planner: null });
      return { findings: caseFile.findings.length, phase: caseFile.phase };
    });
    await observed({ kind: 'TOOL', name: 'record_simulated_reviewer_decisions', toolName: 'applyDecision', captureInput: false }, async () => {
      for (const action of actions) caseFile = applyDecision(caseFile, { ...action, reviewer, note });
      return { documentedDecisions: Object.keys(caseFile.decisions).length };
    });
    await observed({ kind: 'GUARDRAIL', name: 'verify_and_prepare_report', captureInput: false }, async () => {
      caseFile = createReport(caseFile);
      caseFile = checkReminder(caseFile, new Date(caseFile.reminder.at));
      return { finalized: caseFile.phase === 'finalized', reminderDue: caseFile.reminder.status === 'due' };
    });
    return { phase: caseFile.phase, findings: caseFile.findings.length, decisions: Object.keys(caseFile.decisions).length };
  });
  console.log(`FINAL ${summary.phase}: ${summary.findings} findings, ${summary.decisions} simulated decisions.`);
} finally {
  await flush();
  await shutdown();
}
