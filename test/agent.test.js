import test from 'node:test';
import assert from 'node:assert/strict';
import { runReview } from '../src/agent.js';
import { loadFixture } from '../src/store.js';

function planner(select) {
  return {
    chat: {
      completions: {
        create: async (request) => {
          const { allowed } = JSON.parse(request.messages[1].content);
          return { choices: [{ message: { content: await select(allowed) } }] };
        }
      }
    }
  };
}

test('agent mode reflects model choices and falls back after a failed planner call', async () => {
  const local = await runReview(await loadFixture(), { planner: null });
  assert.equal(local.agentMode, 'validated-local-planner');

  const selected = await runReview(await loadFixture(), {
    planner: planner((allowed) => allowed.at(-1))
  });
  assert.equal(selected.agentMode, 'model-planned');
  assert.deepEqual(
    selected.events.filter((event) => event.kind === 'tool').map((event) => event.text.split(' ')[0]),
    ['checkContinuity', 'checkAlerts', 'reconcile']
  );

  const invalid = await runReview(await loadFixture(), {
    planner: planner(() => 'not-a-review-tool')
  });
  assert.equal(invalid.agentMode, 'validated-local-planner');
  assert(invalid.events.some((event) => event.kind === 'recovery' && /invalid tool/.test(event.text)));

  let calls = 0;
  const recovered = await runReview(await loadFixture(), {
    planner: planner((allowed) => {
      if (++calls === 2) throw new Error('Model unavailable');
      return allowed.at(-1);
    })
  });
  assert.equal(calls, 3);
  assert.equal(recovered.agentMode, 'validated-local-planner');
  assert(recovered.events.some((event) => event.kind === 'recovery' && /Planner was unavailable/.test(event.text)));
});
