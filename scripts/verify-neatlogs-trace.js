import '../src/env.js';

const traceId = process.argv[2];
if (!/^[a-f0-9]{32}$/i.test(traceId ?? '')) throw new Error('Pass one 32-character trace ID.');
const apiKey = process.env.NEATLOGS_API_KEY;
if (!apiKey) throw new Error('NEATLOGS_API_KEY is missing from the ignored .env file.');

const origin = new URL(process.env.NEATLOGS_ENDPOINT || 'https://ingest.neatlogs.com').origin;
const response = await fetch(new URL(`/api/traces/v3/${traceId}`, origin), {
  method: 'GET',
  redirect: 'error',
  headers: { 'x-api-key': apiKey },
  signal: AbortSignal.timeout(15_000)
});

let value = null;
try { value = await response.json(); } catch { /* Status is still useful. */ }
const data = value?.data ?? value;
const spans = data?.spans ?? data?.trace?.spans;
const diagnostics = data?.ingestionDiagnostics ?? value?.ingestionDiagnostics;
console.log(JSON.stringify({
  traceId,
  httpStatus: response.status,
  projectId: data?.projectId ?? null,
  name: data?.name ?? null,
  status: data?.status ?? null,
  latency: data?.latency ?? null,
  llmCalls: data?.llmCalls ?? null,
  toolCalls: data?.toolCalls ?? null,
  hasError: data?.hasError ?? null,
  totalCost: data?.totalCost ?? null,
  message: data?.message ?? null,
  finalizationStatus: data?.finalizationStatus ?? data?.trace?.finalizationStatus ?? null,
  ingestionDiagnostics: diagnostics ? {
    state: diagnostics.state,
    currentStage: diagnostics.currentStage,
    failedStage: diagnostics.failedStage,
    failureCode: diagnostics.failureCode,
    retryable: diagnostics.retryable
  } : null,
  spanCount: Array.isArray(spans) ? spans.length : data?.spanCount ?? null,
  spanNames: Array.isArray(spans) ? spans.slice(0, 15).map((span) => span.name ?? span.spanName).filter(Boolean) : [],
  fieldNames: value && typeof value === 'object' ? Object.keys(value).slice(0, 12) : []
}, null, 2));
if (!response.ok) process.exitCode = 1;
