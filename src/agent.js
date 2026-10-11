import OpenAI from 'openai';
import { init, trace, wrapOpenAI, flush, shutdown } from 'neatlogs';
import { checkAlerts, checkContinuity, reconcile } from './clinical.js';

let telemetryReady = false;
let modelClient = null;

export async function initializeAgent() {
  if (process.env.NEATLOGS_API_KEY) {
    await init({
      apiKey: process.env.NEATLOGS_API_KEY,
      endpoint: process.env.NEATLOGS_ENDPOINT || undefined,
      workflowName: 'lognac-discharge-review',
      tags: ['synthetic-demo', 'uk'],
      // Keep patient content out of custom tool spans. Only synthetic model
      // prompts are allowed in this prototype.
    });
    telemetryReady = true;
  }
  if (process.env.MODEL_API_KEY && process.env.MODEL_NAME) {
    const client = new OpenAI({
      apiKey: process.env.MODEL_API_KEY,
      baseURL: process.env.MODEL_BASE_URL || undefined,
      timeout: 15_000,
      maxRetries: 0
    });
    modelClient = telemetryReady ? wrapOpenAI(client) : client;
  }
}

export async function closeAgent() {
  if (telemetryReady) { await flush(); await shutdown(); }
}

async function observed(kind, name, work) {
  if (!telemetryReady) return work();
  return trace({ kind, name, captureInput: false, captureOutput: false }, work);
}

async function chooseTool(remaining, outcomes, events, planner) {
  if (!planner) return { name: remaining[0], modelSelected: false };
  try {
    const completion = await observed('AGENT', 'choose_next_review_tool', () =>
      planner.chat.completions.create({
        model: process.env.MODEL_NAME,
        temperature: 0,
        messages: [
          { role: 'system', content: 'You plan a synthetic medication reconciliation workflow. Choose exactly one tool from the allowed list. Reply with only its name. You cannot skip a required tool or give treatment advice.' },
          { role: 'user', content: JSON.stringify({ allowed: remaining, completed: outcomes }) }
        ]
      }));
    const choice = String(completion.choices?.[0]?.message?.content ?? '').trim();
    if (remaining.includes(choice)) return { name: choice, modelSelected: true };
    events.push({ at: new Date().toISOString(), kind: 'recovery', text: 'Planner returned an invalid tool; controller selected the next required tool.' });
  } catch {
    events.push({ at: new Date().toISOString(), kind: 'recovery', text: 'Planner was unavailable; controller continued with the validated required tools.' });
  }
  return { name: remaining[0], modelSelected: false };
}

export async function runReview(caseFile, { injectFailure = false, planner = modelClient } = {}) {
  if (!caseFile.synthetic) throw new Error('This prototype accepts synthetic cases only.');
  if (caseFile.phase !== 'new') return caseFile;
  return observed('WORKFLOW', 'discharge_review', async () => {
    const tools = { reconcile, checkAlerts, checkContinuity };
    const remaining = Object.keys(tools);
    const outcomes = {};
    const findings = [];
    const events = [...caseFile.events];
    caseFile.reviewBaseline = {
      dischargeOrders: structuredClone(caseFile.dischargeOrders),
      patientInstructions: structuredClone(caseFile.patientInstructions)
    };
    let failedOnce = false;
    let modelPlanned = true;
    while (remaining.length) {
      const { name, modelSelected } = await chooseTool(remaining, outcomes, events, planner);
      modelPlanned &&= modelSelected;
      let result;
      try {
        result = await observed('TOOL', name, () => {
          if (injectFailure && name === 'checkAlerts' && !failedOnce) {
            failedOnce = true;
            throw new Error('Simulated alert-source timeout');
          }
          return tools[name](caseFile);
        });
      } catch (error) {
        if (!injectFailure || !failedOnce || name !== 'checkAlerts') throw error;
        events.push({ at: new Date().toISOString(), kind: 'recovery', text: 'Safety lookup timed out once; retried the required check.' });
        result = await observed('TOOL', 'checkAlerts_retry', () => tools[name](caseFile));
      }
      findings.push(...result);
      outcomes[name] = { findings: result.length, highestSeverity: result[0]?.severity ?? 'none' };
      events.push({ at: new Date().toISOString(), kind: 'tool', text: `${name} completed: ${result.length} finding(s).` });
      remaining.splice(remaining.indexOf(name), 1);
    }
    caseFile.findings = findings;
    caseFile.events = events;
    caseFile.phase = findings.length ? 'awaiting_clinician' : 'ready_to_finalize';
    caseFile.agentMode = modelPlanned ? 'model-planned' : 'validated-local-planner';
    return caseFile;
  });
}
