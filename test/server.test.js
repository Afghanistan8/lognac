import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve, sep } from 'node:path';

async function availablePort() {
  const server = createServer();
  await new Promise((done, reject) => server.once('error', reject).listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

test('local browser workflow runs to a verified report and rejects cross-origin changes', async (t) => {
  const root = process.cwd();
  const auditRoot = resolve(root, '.local');
  await mkdir(auditRoot, { recursive: true });
  const work = await mkdtemp(join(auditRoot, 'audit-http-'));
  assert(resolve(work).startsWith(`${auditRoot}${sep}`));
  await cp(join(root, 'data'), join(work, 'data'), { recursive: true });
  await cp(join(root, 'public'), join(work, 'public'), { recursive: true });
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [join(root, 'src', 'server.js')], {
    cwd: work,
    env: {
      ...process.env, PORT: String(port), NEATLOGS_API_KEY: '', MODEL_API_KEY: '', MODEL_NAME: '',
      ALLOWED_DEMO_EMAIL: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    child.kill();
    if (child.exitCode === null) {
      await Promise.race([
        new Promise((done) => child.once('exit', done)),
        new Promise((done) => setTimeout(done, 3000))
      ]);
    }
    await rm(work, { recursive: true, force: true });
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  await Promise.race([
    new Promise((done, reject) => {
      const timer = setInterval(() => {
        if (output.includes('Lognac demo:')) { clearInterval(timer); done(); }
        else if (child.exitCode !== null) { clearInterval(timer); reject(new Error(`Demo server stopped: ${output}`)); }
      }, 25);
      child.once('error', (error) => { clearInterval(timer); reject(error); });
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Demo server did not start: ${output}`)), 5000))
  ]);
  const get = async (path) => fetch(`${base}${path}`);
  const post = async (path, value = {}, headers = {}) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value)
  });
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/app.js')).status, 200);
  assert.equal((await get('/styles.css')).status, 200);
  assert.equal((await get('/favicon.svg')).status, 200);
  assert.equal((await (await get('/api/case')).json()).phase, 'new');
  assert.equal((await post('/api/reset', {}, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await fetch(`${base}/api/reset`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  const foreignHostStatus = await new Promise((done, reject) => {
    const req = httpRequest(`${base}/api/reset`, {
      method: 'POST', headers: { Host: 'unrelated.example', 'Content-Type': 'application/json' }
    }, (res) => { res.resume(); done(res.statusCode); });
    req.once('error', reject);
    req.end('{}');
  });
  assert.equal(foreignHostStatus, 403);
  let response = await post('/api/run', { injectFailure: true }, { Origin: base });
  assert.equal(response.status, 200);
  let state = await response.json();
  assert.equal(state.findings.length, 4);
  assert(state.events.some((event) => event.kind === 'recovery'));
  assert.equal((await post('/api/finalize')).status, 400);
  const reviewer = 'Dr Example (simulation)';
  const note = 'Reviewed the cited source and approved this fictional correction.';
  for (const decision of [
    { findingId: 'INSTRUCTION-MISMATCH-M-AMLO', action: 'align_to_order' },
    { findingId: 'ALLERGY-M-AMOX', action: 'replace_with_prior_order', replacementId: 'M-DOXY', supplyDays: 5 },
    { findingId: 'ALERT-M-HEAL-WHO-2-2025-HEALMOXY', action: 'record_not_in_use' },
    { findingId: 'SUPPLY-M-AMLO', action: 'arrange_supply', supplyDays: 21 }
  ]) {
    response = await post('/api/decision', { ...decision, reviewer, note });
    assert.equal(response.status, 200);
  }
  state = await (await post('/api/finalize')).json();
  assert.equal(state.phase, 'finalized');
  assert.match(state.report.text, /0 unresolved discrepancy checks/);
  const graph = await (await get('/api/graph')).json();
  assert(graph.nodes.some((node) => node.id === 'baseline:discharge:M-AMLO'));
  assert(graph.edges.some((edge) => edge.from === 'baseline:instruction:M-AMLO' && edge.to === 'INSTRUCTION-MISMATCH-M-AMLO'));
  assert.equal((await post('/api/notify', { recipient: 'test@example.com' })).status, 400);
  state = await (await post('/api/reminder/check', { demoAt: state.reminder.at })).json();
  assert.equal(state.reminder.status, 'due');
  state = await (await post('/api/reminder/ack')).json();
  assert.equal(state.reminder.status, 'acknowledged');
  assert.equal((await (await post('/api/reset')).json()).phase, 'new');
});
