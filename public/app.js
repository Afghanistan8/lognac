let caseFile = null;
let reviewerName = '';

const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (value) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(value)) : 'Not recorded';
const statusText = { new: 'Not reviewed', awaiting_clinician: 'Clinician review needed', ready_to_finalize: 'Ready to verify', finalized: 'Finalized' };

function notify(message, error = false) {
  $('#notice').innerHTML = `<div class="notice ${error ? 'error' : ''}">${escapeHtml(message)}</div>`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { $('#notice').innerHTML = ''; }, 6500);
}

async function api(path, data) {
  const response = await fetch(path, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'The request failed.');
  return value;
}

function medicineCell(medicine) {
  if (!medicine) return '<span class="subtle">—</span>';
  return `${escapeHtml(medicine.dose)}<small>${escapeHtml(medicine.frequency)}${medicine.status ? ` · ${escapeHtml(medicine.status)}` : ''}</small>`;
}

function medRow(id) {
  const home = caseFile.homeMedications.find((m) => m.id === id);
  const hospital = caseFile.hospitalOrders.find((m) => m.id === id);
  const order = caseFile.dischargeOrders.find((m) => m.id === id);
  const instruction = caseFile.patientInstructions.find((m) => m.id === id);
  const medicine = order || instruction || hospital || home;
  return `<tr><td><strong>${escapeHtml(medicine.name)}</strong><small>${escapeHtml(medicine.ingredient)} · ${escapeHtml(medicine.route)}</small></td>
  <td>${medicineCell(home)}</td><td>${medicineCell(hospital)}</td><td>${medicineCell(order)}</td>
  <td>${order && !instruction ? '<span class="severity">Missing</span>' : medicineCell(instruction)}</td></tr>`;
}

function priorOrderCandidates(finding) {
  const unsafe = caseFile.dischargeOrders.find((m) => finding.id === `ALLERGY-${m.id}`);
  if (!unsafe?.indicationId) return [];
  return caseFile.hospitalOrders.filter((candidate) => candidate.id !== unsafe.id &&
    candidate.indicationId === unsafe.indicationId &&
    !caseFile.patient.allergies.some((allergy) => allergy.status === 'confirmed' &&
      [allergy.ingredient, allergy.class].some((term) => term && [candidate.ingredient, candidate.class].some((value) => value?.toLowerCase() === term.toLowerCase()))));
}

function decisionFields(finding) {
  const action = finding.actions?.[0];
  if (!action) return '<p>Care-plan clarification is required before this case can be finalized.</p>';
  const candidates = action === 'replace_with_prior_order' ? priorOrderCandidates(finding) : [];
  const options = action === 'replace_with_prior_order'
    ? `<div class="field"><label>Prior hospital order for the same condition</label><select data-replacement="${escapeHtml(finding.id)}">${candidates.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)} — ${escapeHtml(m.dose)}</option>`).join('')}</select><small>Candidate source record only; the simulated clinician must confirm suitability.</small></div><div class="field"><label>Clinician-approved course, days</label><input data-supply="${escapeHtml(finding.id)}" type="number" min="1" max="30" placeholder="e.g. 5"></div>`
    : action === 'arrange_supply'
      ? `<div class="field"><label>Approved supply duration, days</label><input data-supply="${escapeHtml(finding.id)}" type="number" min="1" max="365" placeholder="e.g. 21"></div>`
      : '';
  const labels = {
    align_to_order: 'Approve aligned instructions',
    remove_unordered_instruction: 'Remove stray draft instruction',
    replace_with_prior_order: 'Approve replacement',
    record_not_in_use: 'Confirm pack not in use',
    arrange_supply: 'Confirm continuity plan'
  };
  return `<div class="decision-form">
    ${options}
    <div class="field wide"><label for="note-${escapeHtml(finding.id)}">Clinician decision and reasoning</label><textarea id="note-${escapeHtml(finding.id)}" data-note="${escapeHtml(finding.id)}" placeholder="Record what was checked and the reason for this decision."></textarea></div>
    <button class="btn secondary wide" type="button" data-resolve="${escapeHtml(finding.id)}" data-action="${escapeHtml(action)}" ${action === 'replace_with_prior_order' && !candidates.length ? 'disabled' : ''}>${escapeHtml(labels[action])}</button>
  </div>`;
}

function findingCard(finding) {
  const decision = caseFile.decisions[finding.id];
  return `<article class="finding ${escapeHtml(finding.severity)} ${finding.status === 'resolved' ? 'resolved' : ''}">
    <div class="finding-top"><div><h3>${escapeHtml(finding.title)}</h3><p>${escapeHtml(finding.detail)}</p></div><span class="severity">${finding.status === 'resolved' ? 'Resolved' : escapeHtml(finding.severity)}</span></div>
    <div class="source-list">Evidence: ${finding.sourceIds.map(escapeHtml).join(' · ')}${finding.alertUrl ? ` · <a href="${escapeHtml(finding.alertUrl)}" target="_blank" rel="noreferrer">WHO notice ↗</a>` : ''}</div>
    ${decision ? `<div class="resolved-note"><strong>${escapeHtml(decision.reviewer)}</strong> · ${date(decision.at)}<br>${escapeHtml(decision.note)}</div>` : decisionFields(finding)}
  </article>`;
}

function render() {
  const c = caseFile;
  const open = c.findings.filter((f) => f.status === 'open').length;
  const critical = c.findings.filter((f) => f.status === 'open' && f.severity === 'critical').length;
  $('#case-content').innerHTML = `
    <div class="case-head">
      <div><span class="status ${escapeHtml(c.phase)}">${escapeHtml(statusText[c.phase] || c.phase)}</span><h2>${escapeHtml(c.patient.name)}</h2><p>${escapeHtml(c.id)} · Fictional record · ${escapeHtml(c.jurisdiction)}</p></div>
      <div class="head-actions">
        ${c.phase === 'new' ? '<button class="btn" data-command="run">Run agent review</button><button class="btn ghost" data-command="run-failure">Show failure recovery</button>' : ''}
        ${c.phase === 'ready_to_finalize' ? '<button class="btn" data-command="finalize">Verify & finalize report</button>' : ''}
        <button class="btn ghost" data-command="reset">Reset demo</button>
      </div>
    </div>
    <div class="grid">
      <div class="stack">
        <section class="card"><div class="card-label"><h3>Medication comparison</h3><span class="subtle">Across four source stages</span></div>
          <div class="table-scroll"><table class="med-table"><thead><tr><th>Medicine</th><th>Home record</th><th>In hospital</th><th>Discharge order</th><th>Patient draft</th></tr></thead><tbody>${[...new Set([...c.homeMedications, ...c.hospitalOrders, ...c.dischargeOrders, ...c.patientInstructions].map((m) => m.id))].map(medRow).join('')}</tbody></table></div>
        </section>
        <section id="findings"><div class="section-title"><div><div class="eyebrow">AGENT REVIEW</div><h2>Findings & decisions</h2></div><p>${open} open · ${critical} critical</p></div>
          ${c.findings.length ? `<div class="card" style="margin-bottom:12px"><div class="field"><label for="reviewer-name">Simulated clinician reviewer</label><input id="reviewer-name" value="${escapeHtml(reviewerName)}" placeholder="Enter reviewer name before approving any change"></div><p class="subtle" style="margin:8px 0 0">Demo approval only. A real deployment requires authenticated clinical roles.</p></div>${c.findings.map(findingCard).join('')}` : '<div class="empty-state">Run the agent to compare all sources. The agent will stop for clinician decisions on any discrepancy.</div>'}
        </section>
        <section class="card" id="report"><div class="card-label"><h3>Written clinical review</h3><span class="subtle">Primary view</span></div>
          ${c.report ? `<div class="report-paper">${escapeHtml(c.report.text)}</div><div style="margin-top:14px"><button class="btn ghost" data-command="download">Download text report</button></div>` : '<div class="empty-state">The final narrative is generated after each concern has a documented clinician decision and the source records agree.</div>'}
        </section>
        <section class="card"><div class="card-label"><h3>Source documents</h3><span class="subtle">Click-through evidence</span></div>
          ${c.documents.map((d) => `<details style="border-top:1px solid #edf1ee;padding:10px 0"><summary style="cursor:pointer;font-weight:700;font-size:12px">${escapeHtml(d.title)} <span class="subtle">· ${date(d.recordedAt)}</span></summary><p style="font-size:12px;color:#5e7572;margin:8px 0 0">${escapeHtml(d.excerpt)}<br><span class="subtle">${escapeHtml(d.id)}</span></p></details>`).join('')}
        </section>
      </div>
      <div class="stack">
        <section class="card"><div class="patient-id">PATIENT PROFILE · ${escapeHtml(c.patient.id)}</div><div class="patient-name">${escapeHtml(c.patient.name)}</div><div class="patient-meta">Age ${escapeHtml(c.patient.age)} · synthetic case</div>
          <div class="keyline"></div><div class="mini-title">Recorded conditions</div><div class="pills">${c.patient.conditions.map((x) => `<span class="pill">${escapeHtml(x.label)}</span>`).join('')}</div>
          <div style="height:17px"></div><div class="mini-title">Recorded allergies</div><div class="pills">${c.patient.allergies.map((x) => `<span class="pill warning">${escapeHtml(x.ingredient)} · ${escapeHtml(x.reaction)}</span>`).join('')}</div>
        </section>
        <section class="card"><h3>Safety source coverage</h3><p class="subtle">Allergy evidence: ${escapeHtml(c.patient.allergies.map((a) => a.sourceId).join(', '))}. Product notice: <a href="${escapeHtml(c.alerts[0]?.url || 'https://www.who.int/teams/regulation-prequalification/incidents-and-SF/full-list-of-who-medical-product-alerts')}" target="_blank" rel="noreferrer">WHO ${escapeHtml(c.alerts[0]?.id || 'alert catalogue')} ↗</a> (curated demo fixture, issued ${escapeHtml(c.alerts[0]?.issuedAt?.slice(0, 10) || 'date unknown')}).</p><p class="subtle">Current UK <a href="https://www.gov.uk/drug-device-alerts" target="_blank" rel="noreferrer">MHRA alerts ↗</a> need manual review. No live or exhaustive safety search is claimed.</p></section>
        <section class="card" id="followup"><div class="card-label"><h3>Follow-up</h3><span class="subtle">From care plan</span></div><div class="mini-title">Responsible care team</div><strong>${escapeHtml(c.followUp.owner)}</strong><div style="height:15px"></div><div class="mini-title">Review due</div><div class="followup-date">${date(c.followUp.dueAt)}</div>
          <p class="subtle">Source: ${escapeHtml(c.followUp.sourceId)} · ${escapeHtml(c.followUp.timeZone)}</p>
          ${c.reminder ? `<div class="callout">Reminder: <strong>${escapeHtml(c.reminder.status)}</strong>${c.reminder.acknowledgedAt ? ` · acknowledged ${date(c.reminder.acknowledgedAt)}` : ''}<br>Email delivery: <strong>${escapeHtml(c.reminder.delivery?.status || 'pending configuration / due time')}</strong></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn ghost" data-command="simulate-due">Simulate due time</button>${c.reminder.status === 'due' ? '<button class="btn secondary" data-command="ack">Acknowledge</button>' : ''}</div>` : '<div class="callout">A reminder is scheduled only after clinician review and final verification.</div>'}
        </section>
        <section class="card"><h3>Audit trail</h3>${c.events.length ? `<div class="timeline">${[...c.events].reverse().slice(0, 8).map((e) => `<div class="event">${escapeHtml(e.text)}<time>${date(e.at)}</time></div>`).join('')}</div>` : '<div class="empty-state">Actions and decisions will appear here.</div>'}</section>
        <section class="card"><h3>Email delivery</h3><p class="subtle">Only fictional reports can be sent. Delivery requires your configured SMTP service and an allowed demo recipient.</p>
          ${c.notification?.status === 'sent' ? `<div class="callout">Sent to ${escapeHtml(c.notification.recipient)} at ${date(c.notification.at)}<br>Receipt: ${escapeHtml(c.notification.messageId)}</div>` : c.report ? '<div class="field"><label for="recipient">Approved test email</label><input id="recipient" type="email" placeholder="Must match ALLOWED_DEMO_EMAIL"></div><div style="margin-top:10px"><button class="btn secondary" data-command="send">Send synthetic report</button></div>' : '<div class="empty-state">Finalize the written report before sending.</div>'}
        </section>
      </div>
    </div>`;
  $('#reviewer-name')?.addEventListener('input', (event) => { reviewerName = event.target.value; });
}

async function refresh() {
  caseFile = await api('/api/case');
  render();
}

async function command(name) {
  if (name === 'run' || name === 'run-failure') {
    caseFile = await api('/api/run', { injectFailure: name === 'run-failure' });
    notify(`${caseFile.findings.length} evidence-backed finding(s) identified. ${caseFile.agentMode === 'model-planned' ? 'Model planner active.' : 'Validated local planner active.'}`);
  } else if (name === 'reset') { caseFile = await api('/api/reset', {}); notify('Demo reset to the original fictional records.'); }
  else if (name === 'finalize') { caseFile = await api('/api/finalize', {}); notify('Written report verified and finalized.'); }
  else if (name === 'simulate-due') { caseFile = await api('/api/reminder/check', { demoAt: caseFile.reminder.at }); notify('Simulated clock reached the care-plan due time.'); }
  else if (name === 'ack') { caseFile = await api('/api/reminder/ack', {}); notify('Follow-up acknowledgement recorded.'); }
  else if (name === 'send') { caseFile = await api('/api/notify', { recipient: $('#recipient').value }); notify('Synthetic report emailed; delivery receipt recorded.'); }
  else if (name === 'download') {
    const blob = new Blob([caseFile.report.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `lognac-${caseFile.id}.txt`; link.click(); URL.revokeObjectURL(url);
    return;
  }
  render();
}

async function resolveFinding(button) {
  const findingId = button.dataset.resolve;
  const action = button.dataset.action;
  const note = $(`[data-note="${findingId}"]`)?.value ?? '';
  const replacementId = $(`[data-replacement="${findingId}"]`)?.value;
  const supplyDays = $(`[data-supply="${findingId}"]`)?.value;
  caseFile = await api('/api/decision', { findingId, action, reviewer: reviewerName, note, replacementId, supplyDays });
  notify('Clinician simulation recorded. The source comparison was updated.');
  render();
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-command],[data-resolve]');
  if (!button) return;
  button.disabled = true;
  try {
    if (button.dataset.command) await command(button.dataset.command);
    else await resolveFinding(button);
  } catch (error) { notify(error.message, true); button.disabled = false; }
});

function drawGraph(graph) {
  const groups = { patient: 0, condition: 0, allergy: 0, alert: 0, home: 1, hospital: 2, discharge: 3, instruction: 4, finding: 5, resolved: 5, decision: 6, followup: 6 };
  const columns = [[], [], [], [], [], [], []];
  for (const node of graph.nodes) columns[node.type === 'superseded' ? (groups[node.stage] ?? 3) : (groups[node.type] ?? 0)].push(node);
  const positions = new Map();
  const medicineIds = [...new Set(graph.nodes.filter((node) => ['home', 'hospital', 'discharge', 'instruction', 'superseded'].includes(node.type)).map((node) => node.id.split(':').at(-1)))];
  const height = Math.max(760, medicineIds.length * 145 + 165, columns[0].length * 100 + 85);
  columns.forEach((items, col) => {
    if (col === 0) items.forEach((node, row) => positions.set(node.id, { x: 25, y: 100 + row * 100 }));
    else if (col >= 1 && col <= 4) items.forEach((node) => {
      const medIndex = medicineIds.indexOf(node.id.split(':').at(-1));
      const sameLane = items.filter((other) => other.id.split(':').at(-1) === node.id.split(':').at(-1));
      const offset = sameLane.length > 1 ? (sameLane.indexOf(node) * 60 - 30) : 0;
      positions.set(node.id, { x: 25 + col * 185, y: 145 + medIndex * 145 + offset });
    });
    else items.forEach((node, row) => positions.set(node.id, { x: 25 + col * 185, y: node.type === 'followup' ? 100 : 205 + (node.type === 'decision' ? columns[6].filter((item) => item.type === 'decision').indexOf(node) : row) * 145 }));
  });
  const headers = ['PATIENT & SAFETY', 'HOME', 'HOSPITAL', 'DISCHARGE', 'PATIENT DRAFT', 'FINDINGS', 'DECISIONS'];
  const guides = headers.map((label, col) => `<g><rect x="${15 + col * 185}" y="57" width="178" height="${height - 70}" rx="12" fill="${col % 2 ? '#f3f8f5' : '#f9fbf9'}"/><text x="${25 + col * 185}" y="34" class="graph-column-label">${label}</text></g>`).join('');
  const edgeSvg = graph.edges.map((edge) => {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    if (!a || !b) return '';
    const x1 = a.x + 160, y1 = a.y + 27, x2 = b.x, y2 = b.y + 27;
    return `<path class="graph-edge" d="M${x1} ${y1} C${x1 + 28} ${y1}, ${x2 - 28} ${y2}, ${x2} ${y2}"><title>${escapeHtml(edge.label)}</title></path>`;
  }).join('');
  const nodeSvg = graph.nodes.map((node) => {
    const p = positions.get(node.id);
    const label = node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label;
    return `<g class="graph-node ${escapeHtml(node.type)}" data-node="${escapeHtml(node.id)}" transform="translate(${p.x} ${p.y})"><rect width="160" height="54"></rect><text x="10" y="22">${escapeHtml(label)}</text><text x="10" y="40" style="font-size:9px;opacity:.65">${escapeHtml(node.type.toUpperCase())}</text></g>`;
  }).join('');
  $('#graph-canvas').innerHTML = `<svg width="1330" height="${height}" role="img" aria-label="Patient evidence relationship graph across home, hospital, discharge, instructions and review">${guides}${edgeSvg}${nodeSvg}</svg>`;
  $('#graph-canvas').onclick = (event) => {
    const element = event.target.closest('[data-node]');
    if (!element) return;
    const node = graph.nodes.find((n) => n.id === element.dataset.node);
    const documentSource = caseFile.documents.find((d) => d.id === node.id);
    const finding = caseFile.findings.find((f) => f.id === node.id);
    const linkedSource = caseFile.documents.find((d) => d.id === node.sourceId);
    const detail = documentSource?.excerpt || finding?.detail || `${node.note ? `${node.note} ` : ''}Stage: ${node.type}. Source: ${node.sourceId || node.sourceIds?.join(', ') || 'case record'}${linkedSource ? `. ${linkedSource.excerpt}` : ''}${node.batch ? `. Batch: ${node.batch}` : ''}${node.status ? `. Status: ${node.status}` : ''}`;
    $('#graph-detail').innerHTML = `<strong>${escapeHtml(node.label)}</strong>${escapeHtml(detail)}`;
  };
}

$('#graph-toggle').addEventListener('click', async () => {
  try { drawGraph(await api('/api/graph')); $('#graph-panel').hidden = false; }
  catch (error) { notify(error.message, true); }
});
$('#graph-close').addEventListener('click', () => { $('#graph-panel').hidden = true; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') $('#graph-panel').hidden = true; });
refresh().catch((error) => notify(error.message, true));
