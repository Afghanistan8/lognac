# Lognac bug-fix post

![Planner-mode reporting bug and fix](04-planner-mode-bugfix.png)

> Found and fixed a Lognac audit bug: if the model planner failed or chose an invalid tool, the agent used its local fallback but still reported “model-planned.” It now labels the path actually taken. Regression tests cover both failures; all 16 tests pass. #neatHack

Evidence: commit `0396e38` changed `src/agent.js` and added `test/agent.test.js`. The before/after code and all three outcomes in the image reflect that commit and the current test suite. Entire mapped the impacted callers in `docs/ENTIRE_GRAPH_EVIDENCE.md`. This is distinct from the separately simulated `checkAlerts` timeout shown in Neatlogs.
