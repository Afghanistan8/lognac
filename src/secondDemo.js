import './env.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { injectTraceContext, trace } from 'neatlogs';
import { initializeAgent, closeAgent, runReview } from './agent.js';
import { applyDecision, checkReminder, createReport } from './workflow.js';
import { buildGraph } from './graph.js';

const reviewer = 'Dr Demo Reviewer (simulation)';
const note = 'Reviewed the cited fictional source records; the draft change is a simulated clinician decision.';
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
  let caseFile = JSON.parse(await readFile(new URL('../data/second-case.json', import.meta.url), 'utf8'));
  caseFile = await runReview(caseFile);
  console.log(`Case ${caseFile.id}; agent mode ${caseFile.agentMode}`);
  for (const finding of caseFile.findings) console.log(`OPEN ${finding.id}: ${finding.title}`);
  const actions = [
    { findingId: 'INSTRUCTION-MISSING-M-AMLO', action: 'align_to_order' },
    { findingId: 'EXTRA-INSTRUCTION-M-IBU', action: 'remove_unordered_instruction' },
    { findingId: 'HOME-OMISSION-M-METF', action: 'restore_prior_order', supplyDays: 21 }
  ];
  for (const action of actions) {
    caseFile = await observed('TASK', 'simulated_clinician_decision', () =>
      applyDecision(caseFile, { ...action, reviewer, note }));
  }
  caseFile = await observed('GUARDRAIL', 'document_consistency_gate', () => createReport(caseFile));
  caseFile = await observed('TASK', 'due_time_reminder', () =>
    checkReminder(caseFile, new Date(caseFile.reminder.at)));
  const graph = buildGraph(caseFile);
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(new URL('../.local/second-case-evidence.json', import.meta.url), JSON.stringify({
    caseId: caseFile.id, phase: caseFile.phase, agentMode: caseFile.agentMode,
    findings: caseFile.findings.map(({ id, title, status, sourceIds }) => ({ id, title, status, sourceIds })),
    decisions: caseFile.decisions, report: caseFile.report, reminder: caseFile.reminder,
    graph: { nodes: graph.nodes.length, edges: graph.edges.length }
  }, null, 2));
  console.log(`FINAL ${caseFile.phase}; ${caseFile.findings.length} decisions; ${graph.nodes.length} graph nodes; ${graph.edges.length} source links; reminder ${caseFile.reminder.status}.`);
  console.log(caseFile.report.text);
}

await initializeAgent();
try {
  await observed('WORKFLOW', 'complete_second_discharge_review', run);
} finally {
  await closeAgent();
}
