import './env.js';
import { initializeAgent, closeAgent, runReview } from './agent.js';
import { buildGraph } from './graph.js';
import { loadFixture } from './store.js';
import { applyDecision, checkReminder, createReport } from './workflow.js';

const failure = process.argv.includes('--failure');
const reviewer = 'Dr Demo Reviewer (simulation)';
const note = 'Reviewed the cited fictional source record and approved this documented correction for the demo.';

await initializeAgent();
try {
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
  for (const action of actions) caseFile = applyDecision(caseFile, { ...action, reviewer, note });
  caseFile = createReport(caseFile);
  caseFile = checkReminder(caseFile, new Date(caseFile.reminder.at));
  const graph = buildGraph(caseFile);
  console.log(`FINAL ${caseFile.phase}: ${caseFile.findings.length} documented decisions; ${graph.nodes.length} graph nodes; ${graph.edges.length} source links.`);
  if (failure) console.log(`Recovery events: ${caseFile.events.filter((event) => event.kind === 'recovery').length}`);
  console.log('\n' + caseFile.report.text);
} finally {
  await closeAgent();
}
