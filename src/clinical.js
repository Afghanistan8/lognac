// Clinical demo logic. This module never issues a prescription or changes a patient record.
const clean = (value) => String(value ?? '').trim().toLowerCase();
const same = (a, b) => clean(a) === clean(b);

export function daysUntilFollowUp(caseFile) {
  const discharge = caseFile.documents.find((doc) => doc.id === 'DOC-DISCHARGE');
  const start = Date.parse(discharge?.recordedAt ?? '');
  const due = Date.parse(caseFile.followUp?.dueAt ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return null;
  return Math.ceil((due - start) / 86_400_000);
}

// These are source-record candidates for a simulated clinician, not treatment
// recommendations. A candidate must already have a hospital order for the same
// recorded condition and must not match a confirmed ingredient/class allergy.
export function replacementCandidates(caseFile, unsafeId) {
  const unsafe = caseFile.dischargeOrders.find((m) => m.id === unsafeId);
  if (!unsafe?.indicationId) return [];
  return caseFile.hospitalOrders.filter((candidate) =>
    candidate.id !== unsafe.id &&
    candidate.indicationId === unsafe.indicationId &&
    !caseFile.patient.allergies.some((allergy) => allergy.status === 'confirmed' &&
      (same(allergy.ingredient, candidate.ingredient) || same(allergy.class, candidate.ingredient) ||
       (allergy.class && candidate.class && same(allergy.class, candidate.class))))
  );
}

export function reconcile(caseFile) {
  const findings = [];
  const orders = new Map(caseFile.dischargeOrders.map((m) => [m.id, m]));
  const instructions = new Map(caseFile.patientInstructions.map((m) => [m.id, m]));
  for (const [label, medicines] of [['discharge order', caseFile.dischargeOrders], ['patient instruction', caseFile.patientInstructions]]) {
    const seen = new Set();
    for (const medicine of medicines) {
      if (seen.has(medicine.id)) findings.push({
        id: `DUPLICATE-${label.replaceAll(' ', '-').toUpperCase()}-${medicine.id}`, type: 'duplicate_record', severity: 'high',
        title: `Duplicate ${label} for ${medicine.name}`,
        detail: 'Ambiguous source records must be corrected before this case can be finalized.',
        sourceIds: [medicine.sourceId], status: 'open', actions: []
      });
      seen.add(medicine.id);
    }
  }
  for (const order of caseFile.dischargeOrders) {
    const instruction = instructions.get(order.id);
    if (!instruction) {
      findings.push({
        id: `INSTRUCTION-MISSING-${order.id}`, type: 'missing_instruction', severity: 'high',
        title: `${order.name} is missing from patient instructions`,
        detail: 'The discharge order has no matching patient-facing instruction. A clinician must confirm the intended instruction.',
        sourceIds: [order.sourceId, 'DOC-INSTRUCTIONS'], status: 'open',
        actions: ['align_to_order']
      });
    } else if (!['name', 'ingredient', 'strength', 'dose', 'route', 'frequency'].every((field) => same(order[field], instruction[field]))) {
      findings.push({
        id: `INSTRUCTION-MISMATCH-${order.id}`, type: 'instruction_mismatch', severity: 'high',
        title: `${order.name} instructions differ from discharge order`,
        detail: `Discharge order draft: ${order.dose}, ${order.route}, ${order.frequency}. Patient draft: ${instruction.dose}, ${instruction.route}, ${instruction.frequency}.`,
        sourceIds: [order.sourceId, instruction.sourceId], status: 'open',
        actions: ['align_to_order']
      });
    }
    const allergy = caseFile.patient.allergies.find((a) => a.status === 'confirmed' &&
      (same(a.ingredient, order.ingredient) || same(a.class, order.ingredient) ||
       (order.class && same(a.class, order.class))));
    if (allergy) {
      findings.push({
        id: `ALLERGY-${order.id}`, type: 'allergy', severity: 'critical',
        title: `${order.name} conflicts with a recorded allergy`,
        detail: `Recorded reaction: ${allergy.reaction}. This requires an immediate clinician review; the agent cannot choose a replacement.`,
        sourceIds: [allergy.sourceId, order.sourceId], status: 'open',
        actions: ['replace_with_prior_order']
      });
    }
  }
  for (const instruction of caseFile.patientInstructions) {
    if (orders.has(instruction.id)) continue;
    findings.push({
      id: `EXTRA-INSTRUCTION-${instruction.id}`, type: 'extra_instruction', severity: 'high',
      title: `${instruction.name} appears in patient instructions without a discharge order`,
      detail: 'A clinician must confirm whether the patient-facing instruction is intended or remove the stray draft.',
      sourceIds: [instruction.sourceId, 'DOC-DISCHARGE'], status: 'open',
      actions: ['remove_unordered_instruction']
    });
  }
  return findings;
}

export function checkAlerts(caseFile) {
  const findings = [];
  for (const medicine of caseFile.homeMedications) {
    if (!['active', 'patient-reported'].includes(medicine.status)) continue;
    for (const alert of caseFile.alerts) {
      if (!same(alert.product, medicine.name) || !same(alert.strength, medicine.strength)) continue;
      if (!medicine.batch || !alert.batches.includes(medicine.batch)) continue;
      findings.push({
        id: `ALERT-${medicine.id}-${alert.id}`, type: 'safety_alert', severity: 'critical',
        title: `Reported ${medicine.name} pack matches a WHO product alert`,
        detail: `Product ${medicine.name}, batch ${medicine.batch}; patient reported obtaining it in ${medicine.obtainedIn ?? 'an unknown location'}. The alert describes falsified packs identified in ${alert.identifiedIn.join(' and ')}. Confirm the physical pack and seek clinician review.`,
        sourceIds: [medicine.sourceId, alert.id], alertUrl: alert.url, status: 'open',
        actions: ['record_not_in_use']
      });
    }
  }
  return findings;
}

export function checkContinuity(caseFile) {
  const days = daysUntilFollowUp(caseFile);
  if (days === null) {
    return [{
      id: 'FOLLOWUP-UNKNOWN', type: 'followup_unknown', severity: 'high',
      title: 'Follow-up timing needs clarification',
      detail: 'The approved care plan has no valid follow-up time after discharge.',
      sourceIds: ['DOC-CAREPLAN'], status: 'open', actions: []
    }];
  }
  const findings = [];
  for (const medicine of caseFile.dischargeOrders) {
    if (!medicine.ongoing) continue;
    if (!Number.isFinite(medicine.supplyDays)) {
      findings.push({
        id: `SUPPLY-${medicine.id}`, type: 'supply_gap', severity: 'review',
        title: `${medicine.name} has no documented supply duration`,
        detail: 'The care team must document enough supply or another continuity plan before the follow-up.',
        sourceIds: [medicine.sourceId, caseFile.followUp.sourceId], status: 'open', actions: ['arrange_supply']
      });
      continue;
    }
    if (medicine.supplyDays < days) {
      findings.push({
        id: `SUPPLY-${medicine.id}`, type: 'supply_gap', severity: 'review',
        title: `${medicine.name} supply ends before follow-up`,
        detail: `${medicine.supplyDays} days supplied; follow-up is ${days} calendar days after the draft discharge. The care team must arrange continuity or document another plan.`,
        sourceIds: [medicine.sourceId, caseFile.followUp.sourceId], status: 'open',
        actions: ['arrange_supply']
      });
    }
  }
  return findings;
}

export function assess(caseFile) {
  return [...reconcile(caseFile), ...checkAlerts(caseFile), ...checkContinuity(caseFile)];
}

export function verifyClosure(caseFile) {
  const reasons = [];
  if (!caseFile.synthetic) reasons.push('Only fictional demo records are supported.');
  if (!caseFile.reviewer?.name) reasons.push('A named clinician review is required.');
  if (caseFile.findings.some((f) => f.status !== 'resolved')) reasons.push('Some findings have no documented decision.');
  const residual = assess(caseFile);
  if (residual.length) reasons.push(`${residual.length} discrepancy or safety check(s) remain after review.`);
  if (!caseFile.followUp?.owner || !Number.isFinite(Date.parse(caseFile.followUp?.dueAt ?? ''))) {
    reasons.push('A responsible team and valid follow-up time are required.');
  }
  if (caseFile.dischargeOrders.length !== caseFile.patientInstructions.length) {
    reasons.push('Discharge orders and patient instructions have different medicine counts.');
  }
  return { ready: reasons.length === 0, reasons, residual };
}
