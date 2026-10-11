# Submission evidence checklist

The [official neatHack page](https://neatlogs.com/hackathon) asks for a public repo with hackathon-window commits, a demo video of at most three minutes, and verifiable use of neatlogs, Entire and cfo.ai. Do not mark an item complete until the linked evidence exists.

| Evidence | Status | Link or action |
| --- | --- | --- |
| Public Lognac repository, commits October 10–12 2026 | Pushed | `https://github.com/Afghanistan8/lognac`; commits use Afghanistan8 as author and committer |
| neatlogs integration diagnostic | Complete, but not the Lognac workflow evidence | New `lognac` project's hosted Doctor trace `45e2b1537dde58c48fa9a16faeb69eb9` finalized with workflow, agent, LLM and tool spans |
| neatlogs trace of a baseline review | Complete, hosted and verified | [Clean model-planned workflow](NEATLOGS_EVIDENCE.md): `cec351d705537bdc7b1895614c6ed864`, HTTP 200 `success`, 17 spans, 3 LLM calls, 3 tool calls |
| neatlogs trace of the retry/recovery run | Complete, hosted and verified | [Recovery workflow](NEATLOGS_EVIDENCE.md): `d696663b44f3551223c90f6308fad8df`, HTTP 200, 18 spans; status `error` records the intentionally failed tool before a successful application retry and final report |
| Before/after measurable behavior | Documented on two saved workflow traces | Both runs finalized the four-decision synthetic report; the recovery run added one tool call and 342 ms in these two samples. See [Neatlogs evidence](NEATLOGS_EVIDENCE.md). |
| Entire checkpoint or graph output | Graph output complete; checkpoint absent | Official Entire graph plugin output and reproduction steps: `docs/ENTIRE_GRAPH_EVIDENCE.md`. Seven Codex hooks are trusted, but `entire checkpoint list` still returned zero checkpoints. |
| cfo.ai business plan | Complete: shared plan and screenshot verified | [Live cfo.ai plan](https://cfo.ai/s/DfJNW9w_YPYeVpGJ); `docs/CFO_AI_EVIDENCE.md` records the three-case plan, 12-month cash comparison and checked calculations. The screenshot is in `docs/evidence/cfo-ai-lognac-plan.png`. |
| Public build update tagged `#neatHack` | Pending owner post | Add link |
| Video covering all three partner tools | Pending recording | Add link; show architecture, failure recovery, written result, graph, traces, checkpoint and finance plan |
| Official X quote-post submission | Pending October 12 submission window | Add published link |

The [demo-readiness audit](DEMO_READINESS_AUDIT.md) records the current code checks, fresh hosted trace after the scoped dependency patch, fixed defects and remaining limitations. The newer clean trace is `3e9ba67e3883f31ec5a56b87ef4ad624`; it finalized with HTTP 200 `success` and 17 spans. The fresh injected-retry trace `94b6e152cb3cff84b13589dd5d764c4e` finalized with HTTP 200 and `status: error` because it retains the deliberately failed tool span.

The local planner is an offline fallback. `MODEL_API_KEY`, `MODEL_NAME` and `MODEL_BASE_URL` are configured in the ignored `.env` file. The clean and recovery runs above used the model planner. Earlier emitted workflow traces failed hosted processing even though local capture and flush passed. The official Doctor probe also returned `TRACE_READBACK_TIMEOUT` for trace `55b1153b00eb4ac0606ebc6acfecaf5e`, but authenticated readback later returned HTTP 200 `success` with four spans. This delay is why the evidence table uses exact hosted readback results. Do not publish API keys or fictional email credentials.
