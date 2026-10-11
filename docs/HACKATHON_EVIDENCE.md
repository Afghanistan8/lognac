# Submission evidence checklist

The [official neatHack page](https://neatlogs.com/hackathon) asks for a public repo with hackathon-window commits, a demo video of at most three minutes, and verifiable use of neatlogs, Entire and cfo.ai. Do not mark an item complete until the linked evidence exists.

| Evidence | Status | Link or action |
| --- | --- | --- |
| Public Lognac repository, commits October 10–12 2026 | Pushed | `https://github.com/Afghanistan8/lognac`; commits use Afghanistan8 as author and committer |
| neatlogs integration diagnostic | Complete, but not the Lognac workflow evidence | New `lognac` project's hosted Doctor trace `45e2b1537dde58c48fa9a16faeb69eb9` finalized with workflow, agent, LLM and tool spans |
| neatlogs trace of a baseline review | Blocked by hosted processing failure | Full synthetic workflow trace `d6b5210ab6e322f1aa54e99439ca404a` was emitted with four high-level spans; authenticated readback returned HTTP 409, `finalizationStatus: dlq` |
| neatlogs trace of the retry/recovery run | Blocked by hosted processing failure | `npm run demo -- --failure` emitted `8264da2faf2b5ad8a2bfab1f7ac02aee`; hosted readback returned HTTP 409 `finalizationStatus: dlq` |
| Before/after measurable improvement | Pending two successful saved workflow traces | Compare finding coverage, retry completion, duration and cost; report actual numbers |
| Entire checkpoint or graph output | Graph output complete; checkpoint absent | Official Entire graph plugin output and reproduction steps: `docs/ENTIRE_GRAPH_EVIDENCE.md`. Seven Codex hooks are trusted, but `entire checkpoint list` still returned zero checkpoints. |
| cfo.ai business plan | Complete: shared plan and screenshot verified | [Live cfo.ai plan](https://cfo.ai/s/DfJNW9w_YPYeVpGJ); `docs/CFO_AI_EVIDENCE.md` records the three-case plan, 12-month cash comparison and checked calculations. The screenshot is in `docs/evidence/cfo-ai-lognac-plan.png`. |
| Public build update tagged `#neatHack` | Pending owner post | Add link |
| Video covering all three partner tools | Pending recording | Add link; show architecture, failure recovery, written result, graph, traces, checkpoint and finance plan |
| Official X quote-post submission | Pending October 12 submission window | Add published link |

The local planner is an offline fallback. `MODEL_API_KEY`, `MODEL_NAME` and `MODEL_BASE_URL` are configured in the ignored `.env` file. A network-enabled synthetic failure demo used valid model selections for every required review tool and recorded only its one injected safety-source timeout. It emitted Neatlogs trace ID `65fd085530683b6070322a4ba27639c4`; hosted finalization is not verified. The configured Neatlogs key previously passed a hosted Doctor probe (`45e2b1537dde58c48fa9a16faeb69eb9`), but two later official Doctor probes timed out on hosted readback. The first of those (`409b8c456f7e29a54b891cc815f16e62`) subsequently returned HTTP 409, `finalizationStatus: dlq`; the latest captured trace ID is `55b1153b00eb4ac0606ebc6acfecaf5e`. In that latest probe, local envelope, four-span fixture, hierarchy, I/O, metadata, token and bounds checks passed, and flush succeeded. The failing check was `TRACE_READBACK_TIMEOUT`. A visible or locally emitted trace ID alone does not prove successful processing. Do not publish API keys or fictional email credentials.
