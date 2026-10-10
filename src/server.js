import './env.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import { initializeAgent, closeAgent, runReview } from './agent.js';
import { buildGraph } from './graph.js';
import { loadCase, resetCase, saveCase } from './store.js';
import { acknowledgeReminder, applyDecision, checkReminder, createReport } from './workflow.js';

const port = Number(process.env.PORT || 3000);
const host = '127.0.0.1'; // Synthetic-only local prototype; never expose real records.
const publicDir = join(process.cwd(), 'public');
let writes = Promise.resolve();

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_768) throw new Error('Request exceeds the demo limit.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function mutate(update) {
  const run = writes.then(async () => {
    const current = await loadCase();
    const next = await update(current);
    await saveCase(next);
    return next;
  });
  writes = run.catch(() => {});
  return run;
}

function mailTransport(recipient) {
  const allowed = process.env.ALLOWED_DEMO_EMAIL;
  if (!allowed || recipient !== allowed) throw new Error('Recipient must match ALLOWED_DEMO_EMAIL.');
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (![SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM].every(Boolean)) {
    throw new Error('SMTP is not configured. The report remains local and unsent.');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    requireTLS: Number(SMTP_PORT) !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendSyntheticReport(caseFile, recipient) {
  if (!caseFile.synthetic || caseFile.phase !== 'finalized' || !caseFile.report) throw new Error('Only a finalized fictional report may be emailed.');
  const transporter = mailTransport(recipient);
  const message = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject: 'Lognac fictional discharge review',
    text: caseFile.report.text
  });
  return { at: new Date().toISOString(), recipient, status: 'sent', messageId: message.messageId };
}

async function deliverDueReminder() {
  if (!process.env.ALLOWED_DEMO_EMAIL || !process.env.SMTP_HOST) return;
  await mutate(async (current) => {
    if (!current.synthetic || current.phase !== 'finalized' || current.reminder?.status !== 'due' || current.reminder.delivery) return current;
    const next = structuredClone(current);
    try {
      const recipient = process.env.ALLOWED_DEMO_EMAIL;
      const message = await mailTransport(recipient).sendMail({
        from: process.env.SMTP_FROM,
        to: recipient,
        subject: 'Lognac fictional care-team follow-up due',
        text: `FICTIONAL DEMO CASE ${next.id}\n\nA follow-up assigned to ${next.reminder.owner} is due at ${next.reminder.at}. Review the local Lognac case and record acknowledgement. No real patient information is included.`
      });
      next.reminder.delivery = { status: 'sent', at: new Date().toISOString(), recipient, messageId: message.messageId };
      next.events.push({ at: next.reminder.delivery.at, kind: 'delivery', text: 'Synthetic follow-up reminder emailed to the approved demo recipient.' });
    } catch (error) {
      next.reminder.delivery = { status: 'failed', at: new Date().toISOString() };
      next.events.push({ at: next.reminder.delivery.at, kind: 'delivery', text: 'Synthetic follow-up email failed; manual review is required.' });
      console.error('Reminder email:', error.message);
    }
    return next;
  });
}

async function staticFile(res, pathname) {
  const files = { '/': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'] };
  const entry = files[pathname];
  if (!entry) return json(res, 404, { error: 'Not found.' });
  const bytes = await readFile(join(publicDir, entry[0]));
  res.writeHead(200, {
    'Content-Type': `${entry[1]}; charset=utf-8`,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; object-src 'none'"
  });
  res.end(bytes);
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    if (req.method === 'GET' && url.pathname === '/api/case') return json(res, 200, await loadCase());
    if (req.method === 'GET' && url.pathname === '/api/graph') return json(res, 200, buildGraph(await loadCase()));
    if (req.method === 'POST' && url.pathname === '/api/run') {
      const input = await body(req);
      return json(res, 200, await mutate((c) => runReview(c, { injectFailure: input.injectFailure === true })));
    }
    if (req.method === 'POST' && url.pathname === '/api/decision') {
      const input = await body(req);
      return json(res, 200, await mutate((c) => applyDecision(c, input)));
    }
    if (req.method === 'POST' && url.pathname === '/api/finalize') {
      return json(res, 200, await mutate(createReport));
    }
    if (req.method === 'POST' && url.pathname === '/api/reminder/check') {
      const input = await body(req);
      const clock = input.demoAt ? new Date(input.demoAt) : new Date();
      if (!Number.isFinite(clock.getTime())) throw new Error('Invalid demo time.');
      await mutate((c) => checkReminder(c, clock));
      await deliverDueReminder();
      return json(res, 200, await loadCase());
    }
    if (req.method === 'POST' && url.pathname === '/api/reminder/ack') {
      return json(res, 200, await mutate(acknowledgeReminder));
    }
    if (req.method === 'POST' && url.pathname === '/api/notify') {
      const input = await body(req);
      const next = await mutate(async (c) => {
        if (c.notification?.status === 'sent') throw new Error('This report was already emailed.');
        const receipt = await sendSyntheticReport(c, String(input.recipient || '').trim());
        const updated = structuredClone(c);
        updated.notification = receipt;
        updated.events.push({ at: receipt.at, kind: 'delivery', text: 'Synthetic report was emailed to the approved demo recipient.' });
        return updated;
      });
      return json(res, 200, next);
    }
    if (req.method === 'POST' && url.pathname === '/api/reset') {
      const next = await mutate(() => resetCase());
      return json(res, 200, next);
    }
    if (req.method === 'GET') return staticFile(res, url.pathname);
    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    return json(res, 400, { error: error.message || 'Request failed.' });
  }
}

await initializeAgent();
const server = createServer(handler);
server.listen(port, host, () => console.log(`Lognac demo: http://${host}:${port}`));
const timer = setInterval(async () => {
  try {
    const current = await loadCase();
    if (current.phase === 'finalized' && ['scheduled', 'due'].includes(current.reminder?.status) && Date.now() >= Date.parse(current.reminder.at)) {
      if (current.reminder.status === 'scheduled') await mutate((c) => checkReminder(c));
      await deliverDueReminder();
    }
  } catch (error) { console.error('Reminder check:', error.message); }
}, 60_000);
async function stop() { clearInterval(timer); server.close(); await closeAgent(); }
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
