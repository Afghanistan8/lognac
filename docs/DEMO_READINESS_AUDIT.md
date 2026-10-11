# Demo readiness audit — 11 October 2026

Lognac is a functioning **synthetic** UK discharge-review prototype. It has not been validated for real patient care. This audit distinguishes demonstrated behavior from configured but unverified services and from clinical capabilities the prototype does not implement.

## Verified in this audit

| Area | Evidence |
| --- | --- |
| Normal model-planned review | [Current clean Neatlogs trace](https://app.neatlogs.com/traces/3e9ba67e3883f31ec5a56b87ef4ad624?orgId=b25f84a0-5cac-4903-9546-23c190cb91dd&projectId=1fe23c4c-8166-4723-b508-1731c35ffaf7) returned HTTP 200, `success`, 17 spans, 3 LLM calls and 3 tool calls after the dependency patch. The synthetic case finalized four decisions, with 26 graph nodes and 29 links. |
| Injected failure and recovery | [Fresh recovery trace](https://app.neatlogs.com/traces/94b6e152cb3cff84b13589dd5d764c4e?orgId=b25f84a0-5cac-4903-9546-23c190cb91dd&projectId=1fe23c4c-8166-4723-b508-1731c35ffaf7) returned HTTP 200, 18 spans, 3 LLM calls, 4 tool calls and `status: error`. The failed tool span is intentional; the local workflow retried and finalized the four-decision report. Do not call that trace a clean success. |
| Written report and closure | The review produces a timestamped report after all four simulated decisions. The closure gate repeats the discrepancy checks and now rejects missing decision records or missing source citations. |
| Evidence graph | Open findings now link to the original medicine node; corrected instruction and supply drafts preserve original evidence as separate nodes. |
| Additional source cases | An active home medicine omitted from discharge requires a documented simulated choice to discontinue it or restore a matching prior hospital order. A reported product in the curated WHO notice with an unknown batch is flagged for clarification instead of silently skipped. |
| WHO fixture | The [official WHO alert PDF](https://cdn.who.int/media/docs/default-source/substandard-and-falsified/n2_2025_healmoxy_en.pdf?sfvrsn=d17da686_4) lists printed batch identifiers `023011`, `H02605` and `H026051`; the fixture now contains all three. A matching batch is a review trigger, not proof that a particular pack is falsified. |
| Local HTTP workflow | An isolated synthetic HTTP test covers static assets, review, deliberate failure and retry, rejected early finalization, four decisions, final report, graph, due-time reminder, acknowledgement and reset. Cross-origin, foreign Host and non-JSON mutation requests are rejected. |
| Browser workflow | A headless Chrome walkthrough completed review, graph before and after decisions, simulated decisions, report, reminder, text download and reset without page or console errors. The UI now prevents overlapping mutation clicks, re-enables the download button after use, serves its favicon and uses CSS classes in place of inline styles that its Content Security Policy blocked. |

The committed test suite includes 15 tests: 14 focused cases and one isolated HTTP integration case. The browser walkthrough was run separately because Playwright is provided by the local Codex runtime, not by this repository. `npm ci --ignore-scripts` and `npm test` were run during this audit. The HTTP test needs local loopback access; a restricted sandbox may block that socket with `EACCES` even when the test passes on a normal host.

## Security and dependency check

The app binds to `127.0.0.1`, accepts synthetic fixture data only, keeps `.env` and `.local/` out of Git, and restricts email to the exact allowlisted demo recipient. Local POST requests now require JSON and a same-origin browser request. This is local demo protection, not production authentication.

`npm audit --omit=dev` initially identified a vulnerable nested `protobufjs@8.0.1`. A scoped lockfile override installs `protobufjs@8.8.0` for the affected OpenTelemetry transformer, and a fresh model-planned Neatlogs run still finalized successfully. The audit still reports **13 upstream advisories (11 moderate, 2 high)** in the OpenTelemetry versions pinned by `neatlogs@1.1.28`; the high advisory concerns malformed Jaeger headers. npm's proposed forced fix changes the Neatlogs SDK version, so it was not applied without compatible trace verification. The remaining advisories prevent any production-security claim.

## Not working or not verified

- **Real email delivery:** SMTP and `ALLOWED_DEMO_EMAIL` are not configured in the local `.env`. The app correctly rejects an attempted report email without them. The reminder is scheduled and can be acknowledged locally; no live email delivery is claimed.
- **Live medicine safety coverage:** The app uses one curated WHO product alert, not a live WHO or MHRA feed. It cannot establish that all medicines, batches, interactions or contraindications are safe.
- **Clinical deployment:** There is no EHR integration, authenticated clinician, validated prescribing rules, secure clinical messaging or clinical safety approval. The prior hospital order is a source candidate for simulated review, not an agent-selected prescription.
- **Generalisation:** The included fixture and tests cover selected variants, not all possible patient records. A real system would need a larger clinical dataset, terminology mapping, clinical governance and independent validation.
- **Hackathon publication:** The public X build update, video of at most three minutes and official quote-post submission still require owner publication. The code, Neatlogs traces, Entire graph and cfo.ai plan are already linked in the evidence checklist.

## Demo order

Run `npm start` and show the original written-first case. Open the graph before any decisions to show the source links. Record the four simulated decisions, verify the report, reopen the graph to show the preserved original drafts, then simulate and acknowledge follow-up. Show the clean Neatlogs trace and the separate intentional-error trace, Entire's repository graph and the cfo.ai plan. State aloud that the record and approvals are synthetic and that email delivery is not configured.
