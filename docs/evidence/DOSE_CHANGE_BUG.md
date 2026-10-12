# Previously missed home-to-discharge dose change

This is a reproducible detection defect in a fictional UK case, not a claim about a real patient or an incorrect prescription.

## Reproduction

`data/third-case.json` records amlodipine 5 mg once daily at home and in the hospital, but 10 mg once daily in both the draft discharge order and patient instruction. There is no source-linked clinician decision explaining the change.

Before the fix, `assess(caseFile)` returned **zero findings**. The first regression test failed with `0 !== 1`. The existing comparison checked that the two discharge documents agreed and treated any discharge order with the same ingredient as covering the home medicine. It did not check for a changed home regimen.

## Fix and verification

`reconcile` now compares strength, dose, route and frequency between the active home medicine and its matching discharge order. A difference creates `HOME-CHANGE-M-AMLO`, citing `DOC-HISTORY` and `DOC-DISCHARGE`. The evidence graph links both medicine nodes to this finding. The report cannot be finalized until a named simulated clinician documents whether the change is intended. Approval is tied to the reviewed medicine IDs, regimen fields and source IDs, so editing a dose or replacing a source afterward reopens the check.

The fixed synthetic run produced **one finding → one documented simulated decision → zero residual checks**, followed by a timestamped report. The full suite passed **17/17** tests. The final-code [hosted Neatlogs trace](https://app.neatlogs.com/traces/4ff034e7b47e8996d8dde04666353a15?orgId=b25f84a0-5cac-4903-9546-23c190cb91dd&projectId=1fe23c4c-8166-4723-b508-1731c35ffaf7) read back as HTTP 200 `success`, with 13 spans, three LLM calls and three tool calls. The initial immediate readback returned 404 while processing; it was not treated as final evidence.

Reproduce locally with `npm run demo:dose-change` and `node --test test/doseChange.test.js`. This check asks for a decision; it does not decide which dose is medically appropriate.
