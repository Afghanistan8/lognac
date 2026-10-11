# Entire code graph evidence

The official Entire `graph` plugin (v0.4.0) analyzed the committed Lognac repository on October 11, 2026. This is the hackathon's accepted **entire-graph output** route; no Entire checkpoint is claimed. The plugin reported `no_egress=true` in `entire graph doctor`.

## Reproduce

From the repository root, with the Entire CLI available:

```powershell
entire graph impact --repo . --symbol runReview --format text --head
entire graph commit 0396e38 --repo .
```

The impact query was run against commit `0396e38276d92d256e13cc4fd3df7eb9ff84f795` and returned:

```text
Impact: runReview (src/agent.js:61) def=61 span=61-104 [function]
Blast radius: 6 callers (5 direct, 1 transitive), 4 callees, 0 type consumers, 2 data flows, 0 co-change files, 0 siblings.
Callers (5 direct, 1 transitive; who breaks if behavior changes):
- runDemo (src/demo.js:17) [ASYNC_CALLS]
- httpDemo.js (src/httpDemo.js)
- handler (src/server.js:124, def :117)
- agent.test.js (test/agent.test.js)
- clinical.test.js (test/clinical.test.js)
- server.js (src/server.js) [via handler]
Callees (4; what it depends on):
- observed (src/agent.js:35) [ASYNC_CALLS]
- observed (src/agent.js:35)
- chooseTool (src/agent.js:40) [ASYNC_CALLS]
- chooseTool (src/agent.js:40)
Data flows (1 in, 1 out):
- <- observed (src/agent.js:35)
- -> chooseTool (src/agent.js:40)
```

Entire's entity-level commit analysis returned:

```text
Semantic changes 800d7aa8ca3e3a3be23f28a7460592049b44477c..0396e38

src/agent.js (JavaScript)
  ~ function chooseTool signature changed (1 dependent)
  ~ function runReview signature changed (2 dependents)

test/agent.test.js (JavaScript)
  + function planner added
```

The graph identified the demo, HTTP demo, server handler and tests as callers affected by `runReview`. The agent-mode fix therefore kept the function's existing public behaviour and added focused tests for valid model choices, invalid choices, unavailable model calls and local mode. `npm test` passed all 11 tests after the change. The graph is a code relationship analysis, not a clinical evidence graph or a claim that a Neatlogs trace finalized.
