import './env.js';
import { initializeAgent, closeAgent, runReview } from './agent.js';
import { loadFixture } from './store.js';
import { applyDecision, checkReminder, createReport } from './workflow.js';
import { buildHttpTrace, sendHttpTrace } from './httpTrace.js';

const writeKey = process.env.NEATLOGS_WRITE_KEY;
const projectName = process.env.NEATLOGS_PROJECT_NAME;
const dryRun = process.argv.includes('--dry-run');
if ((!writeKey && !dryRun) || !projectName) throw new Error('Set NEATLOGS_WRITE_KEY and NEATLOGS_PROJECT_NAME in the ignored .env file.');

// This command tests the independent JSON route without emitting another OTLP trace.
delete process.env.NEATLOGS_API_KEY;

const failure = process.argv.includes('--failure');
const reviewer = 'Dr Demo Reviewer (simulation)';
const note = 'Reviewed the cited fictional source record and approved this documented correction for the demo.';
const actions = [
  { findingId: 'INSTRUCTION-MISMATCH-M-AMLO', action: 'align_to_order' },
  { findingId: 'ALLERGY-M-AMOX', action: 'replace_with_prior_order', replacementId: 'M-DOXY', supplyDays: 5 },
  { findingId: 'ALERT-M-HEAL-WHO-2-2025-HEALMOXY', action: 'record_not_in_use' },
  { findingId: 'SUPPLY-M-AMLO', action: 'arrange_supply', supplyDays: 21 }
];

await initializeAgent();
try {
  let caseFile = await loadFixture();
  caseFile = await runReview(caseFile, { injectFailure: failure });
  for (const action of actions) caseFile = applyDecision(caseFile, { ...action, reviewer, note });
  caseFile = createReport(caseFile);
  caseFile = checkReminder(caseFile, new Date(caseFile.reminder.at));
  const trace = buildHttpTrace(caseFile, projectName);
  if (dryRun) {
    console.log(`Dry run: ${trace.name} with ${trace.children.length} child spans.`);
    console.log(trace.children.map((span) => `${span.name}${span.status === 'ERROR' ? ' (simulated error)' : ''}`).join(' -> '));
  } else {
    const result = await sendHttpTrace(trace, writeKey);
    console.log(`Neatlogs JSON receipt: ${result.traceId} (${result.spans} spans).`);
    console.log('Check this exact trace in Neatlogs; a receipt alone does not prove finalization.');
  }
} finally {
  await closeAgent();
}
