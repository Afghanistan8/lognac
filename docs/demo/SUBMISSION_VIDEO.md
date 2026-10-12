# Lognac submission video

[Watch the one-video demo](Lognac-submission-demo.mp4) (1920 × 1080, 2:41.8, male narration).

The video uses fictional UK medication records and shows the real Lognac written review and optional graph. It explains the missed home-to-discharge dose change, the regression test and human decision gate. It then shows Entire's recorded `runReview` impact graph, the saved cfo.ai hypothetical plan, and the actual Neatlogs recovery trace. The visible `checkAlerts` error was deliberately injected; Lognac ran `checkAlerts_retry`. The hosted recovery trace remains in an error state because it preserves the failed span. A separate clean trace and a later dose-change trace succeeded.

The video does not claim that Neatlogs' **Incidents** page generated an incident or that Neatlogs changed Lognac's code. It uses the verified **Traces** evidence to show where the failure occurred and how application recovery was checked. It does not claim live clinical use, prescribing authority, complete safety-feed coverage or validated cfo.ai revenue.

Source narration is in [segments.json](segments.json). The reproducible edit uses [male voice synthesis](../../scripts/synthesize_demo_voice.ps1) and [video assembly](../../scripts/build_demo_video.py). Temporary encoding files and local speech dependencies are ignored by Git.
