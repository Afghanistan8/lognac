import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHttpTrace, sendHttpTrace } from '../src/httpTrace.js';

test('direct trace represents an actual synthetic recovery run without case narrative', () => {
  const caseFile = {
    id: 'CASE-UK-001', synthetic: true, phase: 'finalized', agentMode: 'validated-local-planner',
    findings: [{ id: 'F-1' }], decisions: { 'F-1': {} },
    events: [
      { kind: 'tool', text: 'reconcile completed: 1 finding(s).' },
      { kind: 'recovery', text: 'Safety lookup timed out once; retried the required check.' },
      { kind: 'tool', text: 'checkAlerts completed: 0 finding(s).' },
      { kind: 'verification', text: 'Final document consistency check passed.' }
    ]
  };
  const trace = buildHttpTrace(caseFile, "Asuzu's project");
  assert.equal(trace.project, "Asuzu's project");
  assert.equal(trace.output.recoveryEvents, 1);
  assert.deepEqual(trace.children.map((span) => span.name), [
    'validated_local_planner', 'reconcile', 'checkAlerts', 'checkAlerts_retry', 'document_consistency_gate'
  ]);
  assert.equal(trace.children[2].status, 'ERROR');
  assert.equal(trace.children.at(-1).passed, true);
  assert.equal(JSON.stringify(trace).includes('Amira'), false);
  assert.throws(() => buildHttpTrace({ ...caseFile, synthetic: false }, 'demo'), /synthetic/);
});

test('direct trace requires write-key receipt and reports HTTP errors without echoing credentials', async () => {
  let request;
  const receipt = await sendHttpTrace({ name: 'test' }, 'nlw_test', async (_url, options) => {
    request = options;
    return { ok: true, json: async () => ({ success: true, trace_id: 'a'.repeat(32), spans: 2 }) };
  });
  assert.deepEqual(receipt, { traceId: 'a'.repeat(32), spans: 2 });
  assert.equal(request.method, 'POST');
  await assert.rejects(() => sendHttpTrace({ name: 'test' }, 'bad', async () => {}), /write key/);
  await assert.rejects(
    () => sendHttpTrace({ name: 'test' }, 'nlw_test', async () => ({ ok: false, status: 401 })),
    /HTTP 401/
  );
});
