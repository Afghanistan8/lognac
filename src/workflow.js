import { assess, daysUntilFollowUp, replacementCandidates, verifyClosure } from './clinical.js';

const now = () => new Date().toISOString();
const copy = (value) => structuredClone(value);

export function applyDecision(caseFile, input) {
  if (caseFile.phase !== 'awaiting_clinician') throw new Error('Run the review before recording decisions.');
  const finding = caseFile.findings.find((item) => item.id === input.findingId);
  if (!finding || finding.status !== 'open') throw new Error('Choose an open finding.');
  const reviewer = String(input.reviewer ?? '').trim();
  const note = String(input.note ?? '').trim();
  if (reviewer.length < 3 || note.length < 8) throw new Error('A named demo reviewer and a meaningful decision note are required.');
  if (!finding.actions.includes(input.action)) throw new Error('That action is not valid for this finding.');
  const next = copy(caseFile);
  const selected = next.findings.find((item) => item.id === input.findingId);
  const sourceId = `DECISION-${selected.id}`;

  if (input.action === 'align_to_order') {
    const medId = selected.id.replace(/^INSTRUCTION-(?:MISSING|MISMATCH)-/, '');
    const order = next.dischargeOrders.find((m) => m.id === medId);
    if (!order) throw new Error('The source order is missing.');
    const instruction = next.patientInstructions.find((m) => m.id === medId);
    const updated = { ...order, sourceId };
    if (instruction) Object.assign(instruction, updated);
    else next.patientInstructions.push(updated);
  } else if (input.action === 'remove_unordered_instruction') {
    const medId = selected.id.replace('EXTRA-INSTRUCTION-', '');
    if (next.dischargeOrders.some((m) => m.id === medId)) throw new Error('The instruction now has a discharge order; rerun the review.');
    next.patientInstructions = next.patientInstructions.filter((m) => m.id !== medId);
  } else if (input.action === 'replace_with_prior_order') {
    const unsafeId = selected.id.replace('ALLERGY-', '');
    const previous = replacementCandidates(next, unsafeId).find((m) => m.id === input.replacementId);
    if (!previous) throw new Error('Select a prior hospital order for the same recorded condition that does not match a confirmed allergy.');
    const supplyDays = Number(input.supplyDays);
    if (!Number.isInteger(supplyDays) || supplyDays < 1 || supplyDays > 30) throw new Error('The simulated clinician must confirm a supply duration of 1–30 days.');
    next.dischargeOrders = next.dischargeOrders.filter((m) => m.id !== unsafeId);
    next.patientInstructions = next.patientInstructions.filter((m) => m.id !== unsafeId);
    const replacement = { ...previous, sourceId, ongoing: false, supplyDays };
    next.dischargeOrders.push(replacement);
    next.patientInstructions.push({ ...replacement });
  } else if (input.action === 'record_not_in_use') {
    const home = next.homeMedications.find((m) => selected.id.startsWith(`ALERT-${m.id}-`));
    if (!home) throw new Error('The reported pack is missing.');
    home.status = 'not-in-use';
    home.reviewSourceId = sourceId;
  } else if (input.action === 'arrange_supply') {
    const medId = selected.id.replace('SUPPLY-', '');
    const order = next.dischargeOrders.find((m) => m.id === medId);
    const required = daysUntilFollowUp(next);
    const days = Number(input.supplyDays);
    if (!order || required === null || !Number.isInteger(days) || days < required || days > 365) {
      throw new Error(`Enter a clinician-approved supply duration of at least ${required ?? 'the planned'} days.`);
    }
    order.supplyDays = days;
    order.sourceId = sourceId;
  }

  const decision = { findingId: selected.id, action: input.action, note, reviewer, at: now(), sourceId };
  next.decisions[selected.id] = decision;
  next.reviewer = { name: reviewer, mode: 'simulated-clinician', lastReviewedAt: decision.at };
  next.documents.push({ id: sourceId, title: 'Simulated clinician decision', kind: 'decision', recordedAt: decision.at, excerpt: note });
  selected.status = 'resolved';
  next.events.push({ at: decision.at, kind: 'decision', text: `${selected.id} reviewed by ${reviewer}.` });
  if (next.findings.every((f) => f.status === 'resolved')) next.phase = 'ready_to_finalize';
  return next;
}

export function createReport(caseFile) {
  if (caseFile.phase !== 'ready_to_finalize') throw new Error('All findings require clinician decisions first.');
  const validation = verifyClosure(caseFile);
  if (!validation.ready) throw new Error(validation.reasons.join(' '));
  const next = copy(caseFile);
  const at = now();
  const lines = [
    'LOGNAC | SYNTHETIC DISCHARGE REVIEW',
    `Case: ${next.id}   Generated: ${at}`,
    `Patient: ${next.patient.name} (${next.patient.id}) — FICTIONAL DEMO RECORD`,
    '',
    'CLINICAL HISTORY',
    ...next.patient.conditions.map((c) => `• ${c.label} — ${c.status}; source ${c.sourceId}`),
    '',
    'RECORDED ALLERGIES',
    ...next.patient.allergies.map((a) => `• ${a.ingredient}: ${a.reaction} (${a.status}); source ${a.sourceId}`),
    '',
    'MEDICATION HISTORY AND INPATIENT RECORD',
    ...next.homeMedications.map((m) => `• Home: ${m.name} ${m.dose}, ${m.frequency}; ${m.status}; source ${m.sourceId}${m.batch ? `; batch ${m.batch}` : ''}`),
    ...next.hospitalOrders.map((m) => `• Hospital: ${m.name} ${m.dose}, ${m.frequency}; source ${m.sourceId}`),
    '',
    'SIMULATED CLINICIAN-REVIEWED DISCHARGE INSTRUCTIONS',
    ...next.patientInstructions.map((m) => `• ${m.name}: ${m.dose}, ${m.route}, ${m.frequency}; source ${m.sourceId}`),
    '',
    'REVIEWED CONCERNS AND DECISIONS',
    ...next.findings.map((f) => {
      const d = next.decisions[f.id];
      return `• ${f.title}\n  Evidence: ${f.sourceIds.join(', ')}\n  Simulated decision: ${d.action} by ${d.reviewer} at ${d.at}. ${d.note}`;
    }),
    '',
    'FOLLOW-UP',
    `• Responsible team: ${next.followUp.owner}`,
    `• Appointment/review due: ${next.followUp.dueAt} (${next.followUp.timeZone})`,
    '• Reminder is scheduled for the care-plan time; delivery and clinician acknowledgement are separate statuses.',
    '',
    'VERIFICATION',
    `• ${assess(next).length} unresolved discrepancy checks after documented corrections.`,
    '• Candidate alternatives came only from prior hospital orders for the same recorded condition; a simulated clinician selected the draft change.',
    '• Report is a synthetic workflow artifact, not a prescription or independent clinical advice.'
  ];
  next.report = { at, text: lines.join('\n'), approvedBy: next.reviewer.name, version: 1 };
  next.reminder = { at: next.followUp.dueAt, owner: next.followUp.owner, status: 'scheduled', delivery: null, acknowledgedAt: null };
  next.phase = 'finalized';
  next.events.push({ at, kind: 'verification', text: 'Final document consistency check passed and written report generated.' });
  return next;
}

export function checkReminder(caseFile, clock = new Date()) {
  if (caseFile.phase !== 'finalized' || !caseFile.reminder) throw new Error('Finalize the case first.');
  if (!Number.isFinite(clock.getTime())) throw new Error('Invalid demo time.');
  const next = copy(caseFile);
  if (next.reminder.status === 'scheduled' && clock.getTime() >= Date.parse(next.reminder.at)) {
    next.reminder.status = 'due';
    next.reminder.triggeredAt = clock.toISOString();
    next.events.push({ at: clock.toISOString(), kind: 'followup', text: 'Follow-up is due; care-team reminder requires acknowledgement.' });
  }
  return next;
}

export function acknowledgeReminder(caseFile) {
  if (caseFile.phase !== 'finalized' || caseFile.reminder?.status !== 'due') throw new Error('A follow-up reminder must be due before acknowledgement.');
  const next = copy(caseFile);
  next.reminder.status = 'acknowledged';
  next.reminder.acknowledgedAt = now();
  next.events.push({ at: next.reminder.acknowledgedAt, kind: 'followup', text: 'Care team acknowledged the follow-up reminder.' });
  return next;
}
