const endpoint = 'https://ingest.neatlogs.com/v1/trace';

export function buildHttpTrace(caseFile, projectName) {
  if (!caseFile.synthetic || caseFile.phase !== 'finalized') {
    throw new Error('Only a finalized synthetic demo can be exported.');
  }
  if (!projectName?.trim()) throw new Error('NEATLOGS_PROJECT_NAME is required.');

  const children = [
    {
      name: caseFile.agentMode === 'model-planned' ? 'model_planner' : 'validated_local_planner',
      kind: 'AGENT',
      output: { mode: caseFile.agentMode, requiredChecks: ['reconcile', 'checkAlerts', 'checkContinuity'] }
    }
  ];

  let alertRetried = false;
  for (const event of caseFile.events) {
    if (event.kind === 'recovery' && event.text.includes('Safety lookup timed out')) {
      children.push({ name: 'checkAlerts', kind: 'TOOL', tool_name: 'checkAlerts', status: 'ERROR', error: 'Simulated alert-source timeout' });
      alertRetried = true;
    } else if (event.kind === 'tool') {
      const toolName = event.text.split(' ')[0];
      const spanName = alertRetried && toolName === 'checkAlerts' ? 'checkAlerts_retry' : toolName;
      children.push({ name: spanName, kind: 'TOOL', tool_name: toolName, output: event.text });
    } else if (event.kind === 'decision') {
      children.push({ name: 'simulated_clinician_decision', kind: 'TASK', output: event.text });
    } else if (event.kind === 'verification') {
      children.push({ name: 'document_consistency_gate', kind: 'GUARDRAIL', passed: true, output: event.text });
    } else if (event.kind === 'followup') {
      children.push({ name: 'due_time_reminder', kind: 'TASK', output: event.text });
    }
  }

  return {
    name: 'lognac_discharge_review_http',
    project: projectName.trim(),
    kind: 'WORKFLOW',
    input: { caseId: caseFile.id, synthetic: true },
    output: {
      phase: caseFile.phase,
      findings: caseFile.findings.length,
      decisions: Object.keys(caseFile.decisions).length,
      recoveryEvents: caseFile.events.filter((event) => event.kind === 'recovery').length
    },
    children
  };
}

export async function sendHttpTrace(trace, writeKey, fetcher = fetch) {
  if (!writeKey?.startsWith('nlw_')) throw new Error('NEATLOGS_WRITE_KEY must be a Neatlogs write key.');
  const response = await fetcher(endpoint, {
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: `Bearer ${writeKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(trace),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Neatlogs direct trace request failed with HTTP ${response.status}.`);
  const result = await response.json();
  if (result.success !== true || !/^[a-f0-9]{32}$/i.test(result.trace_id) || !Number.isInteger(result.spans)) {
    throw new Error('Neatlogs did not return a valid trace receipt.');
  }
  return { traceId: result.trace_id, spans: result.spans };
}
