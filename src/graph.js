// A compact explanatory map. Source IDs stay on each node for click-through;
// the full written report and source documents are the record of truth.
export function buildGraph(caseFile) {
  const nodes = [];
  const edges = [];
  const add = (id, label, type, meta = {}) => {
    if (!nodes.some((node) => node.id === id)) nodes.push({ id, label, type, ...meta });
  };
  const link = (from, to, label) => {
    if (nodes.some((n) => n.id === from) && nodes.some((n) => n.id === to)) edges.push({ from, to, label });
  };
  const patientId = caseFile.patient.id;
  add(patientId, caseFile.patient.name, 'patient');
  for (const condition of caseFile.patient.conditions) {
    add(condition.id, condition.label, 'condition', { sourceId: condition.sourceId });
    link(patientId, condition.id, 'history');
  }
  for (const allergy of caseFile.patient.allergies) {
    add(allergy.id, `${allergy.ingredient}: ${allergy.reaction}`, 'allergy', { sourceId: allergy.sourceId });
    link(patientId, allergy.id, 'recorded allergy');
  }
  for (const alert of caseFile.alerts) add(alert.id, `${alert.issuer}: ${alert.product} batch alert`, 'alert', { url: alert.url });

  const stages = [
    ['home', caseFile.homeMedications],
    ['hospital', caseFile.hospitalOrders],
    ['discharge', caseFile.dischargeOrders],
    ['instruction', caseFile.patientInstructions]
  ];
  const byMedicine = new Map();
  for (const [stage, medicines] of stages) {
    for (const med of medicines) {
      const id = `${stage}:${med.id}`;
      add(id, `${med.name} ${med.dose}`, stage, { sourceId: med.sourceId, status: med.status, batch: med.batch });
      if (stage === 'home') link(patientId, id, 'home history');
      if (med.indicationId) link(med.indicationId, id, 'recorded indication');
      if (!byMedicine.has(med.id)) byMedicine.set(med.id, []);
      byMedicine.get(med.id).push(id);
    }
  }
  for (const ids of byMedicine.values()) for (let i = 1; i < ids.length; i++) link(ids[i - 1], ids[i], 'medicine journey');

  const baseline = caseFile.reviewBaseline;
  if (baseline) {
    for (const [stage, original] of [['discharge', baseline.dischargeOrders], ['instruction', baseline.patientInstructions]]) {
      const current = stage === 'discharge' ? caseFile.dischargeOrders : caseFile.patientInstructions;
      for (const med of original) {
        const updated = current.find((item) => item.id === med.id);
        if (updated && ['name', 'ingredient', 'strength', 'dose', 'route', 'frequency', 'supplyDays', 'sourceId'].every((field) => updated[field] === med[field])) continue;
        add(`baseline:${stage}:${med.id}`, `${med.name} ${med.dose} · original`, 'superseded', { stage, sourceId: med.sourceId });
      }
    }
  }

  if (caseFile.followUp) {
    add('FOLLOWUP', `Follow-up ${caseFile.followUp.dueAt}`, 'followup', { sourceId: caseFile.followUp.sourceId });
    link(patientId, 'FOLLOWUP', 'care plan');
  }
  for (const finding of caseFile.findings) {
    const findingId = finding.id;
    add(findingId, finding.title, finding.status === 'resolved' ? 'resolved' : 'finding', { sourceIds: finding.sourceIds });
    if (finding.type === 'instruction_mismatch' || finding.type === 'missing_instruction') {
      const medId = findingId.replace(/^INSTRUCTION-(?:MISSING|MISMATCH)-/, '');
      const original = `baseline:instruction:${medId}`;
      link(nodes.some((node) => node.id === original) ? original : `instruction:${medId}`, findingId, 'source draft');
      if (nodes.some((node) => node.id === original)) link(`instruction:${medId}`, findingId, 'corrected draft');
    } else if (finding.type === 'extra_instruction') {
      const medId = findingId.replace('EXTRA-INSTRUCTION-', '');
      const original = `baseline:instruction:${medId}`;
      link(nodes.some((node) => node.id === original) ? original : `instruction:${medId}`, findingId, 'stray draft');
    } else if (finding.type === 'allergy') {
      for (const allergy of caseFile.patient.allergies) link(allergy.id, findingId, 'allergy conflict');
      const medId = findingId.replace('ALLERGY-', '');
      const original = `baseline:discharge:${medId}`;
      link(nodes.some((node) => node.id === original) ? original : `discharge:${medId}`, findingId, 'source order');
    } else if (finding.type === 'safety_alert') {
      for (const alert of caseFile.alerts) if (finding.sourceIds.includes(alert.id)) link(alert.id, findingId, 'specific product alert');
      for (const med of caseFile.homeMedications) if (findingId.startsWith(`ALERT-${med.id}-`)) link(`home:${med.id}`, findingId, 'reported pack');
    } else if (finding.type === 'supply_gap') {
      const medId = findingId.replace('SUPPLY-', '');
      const original = `baseline:discharge:${medId}`;
      link(nodes.some((node) => node.id === original) ? original : `discharge:${medId}`, findingId, 'source supply');
      link('FOLLOWUP', findingId, 'review date');
    } else if (finding.type === 'home_omission') {
      link(`home:${findingId.replace('HOME-OMISSION-', '')}`, findingId, 'active home medicine');
    }
    const decision = caseFile.decisions[findingId];
    if (decision) {
      add(decision.sourceId, `${decision.action} · ${decision.reviewer}`, 'decision', { sourceId: decision.sourceId, recordedAt: decision.at, note: decision.note });
      link(findingId, decision.sourceId, 'documented decision');
    }
  }
  return { nodes, edges };
}
