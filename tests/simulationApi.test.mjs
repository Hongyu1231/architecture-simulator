import assert from 'node:assert/strict';
import test from 'node:test';

const {
  getSimulation,
  runAndPollSimulation,
  startSimulation,
} = await import('../src/lib/simulationApi.ts');

const nodes = [
  { id: 'a', type: 'default', data: { label: 'A' }, position: { x: 0, y: 0 } },
  { id: 'b', type: 'default', data: { label: 'B' }, position: { x: 100, y: 0 } },
  { id: 'c', type: 'default', data: { label: 'C' }, position: { x: 200, y: 0 } },
];

function response(payload, status = 200, statusText = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => payload,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  };
}

async function withFetch(handler, action) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await action();
  } finally {
    globalThis.fetch = previous;
  }
}

test('polls to completion and accepts a trace that is not an architecture edge', async () => {
  let getCount = 0;
  const seenStatuses = [];
  const result = await withFetch(async (url, init) => {
    if (init?.method === 'POST') return response({ simulation_id: 'sim-1', status: 'queued', edges: null }, 202);

    getCount += 1;
    if (getCount === 1) return response({ simulation_id: 'sim-1', status: 'running', edges: null });
    return response({
      simulation_id: 'sim-1',
      status: 'completed',
      edges: [{ source: 'a', target: 'c', latency_ms: 12, packets: 4, status: 'success' }],
    });
  }, () => runAndPollSimulation(nodes, (status) => seenStatuses.push(status.status)));

  assert.equal(result.simulation_id, 'sim-1');
  assert.deepEqual(seenStatuses, ['queued', 'running', 'completed']);
  assert.equal(result.edges[0].source, 'a');
  assert.equal(result.edges[0].target, 'c');
});

test('rejects a trace that references a node outside the submitted architecture', async () => {
  await assert.rejects(
    withFetch(async (url, init) => {
      if (init?.method === 'POST') return response({ simulation_id: 'sim-2', status: 'queued', edges: null }, 202);
      return response({
        simulation_id: 'sim-2',
        status: 'completed',
        edges: [{ source: 'a', target: 'missing', latency_ms: 1, packets: 1, status: 'success' }],
      });
    }, () => runAndPollSimulation(nodes)),
    /unknown node/,
  );
});

test('rejects invalid statuses and reports concise HTTP and network errors', async () => {
  await assert.rejects(
    withFetch(async () => response({ simulation_id: 'sim-3', status: 'paused', edges: null }), () => startSimulation(nodes)),
    /invalid status/,
  );

  await assert.rejects(
    withFetch(async () => response({ detail: 'upstream unavailable' }, 503, 'Service Unavailable'), () => startSimulation(nodes)),
    /Simulation start failed \(503\): upstream unavailable.*127\.0\.0\.1:8000/,
  );

  await assert.rejects(
    withFetch(async () => { throw new Error('connect ECONNREFUSED'); }, () => getSimulation('sim-3')),
    /Simulation status request failed: connect ECONNREFUSED.*127\.0\.0\.1:8000/,
  );
});

test('aborts an in-flight request when the caller aborts', async () => {
  const controller = new AbortController();
  let requestSignal;

  const pending = withFetch((_url, init) => {
    requestSignal = init.signal;
    return new Promise((resolve, reject) => {
      requestSignal.addEventListener('abort', () => reject(requestSignal.reason), { once: true });
    });
  }, () => runAndPollSimulation(nodes, undefined, controller.signal));

  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();

  await assert.rejects(pending, (error) => error?.name === 'AbortError');
  assert.equal(requestSignal.aborted, true);
});

test('aborts a hanging request at the 45-second overall deadline', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  let requestSignal;
  globalThis.setTimeout = (callback, ms, ...args) => {
    if (ms === 45_000) {
      queueMicrotask(() => callback(...args));
      return 0;
    }
    return originalSetTimeout(callback, ms, ...args);
  };

  try {
    await assert.rejects(
      withFetch((_url, init) => {
        requestSignal = init.signal;
        return new Promise((resolve, reject) => {
          requestSignal.addEventListener('abort', () => reject(requestSignal.reason), { once: true });
        });
      }, () => runAndPollSimulation(nodes)),
      (error) => error?.message === 'Simulation timed out after 45 seconds.',
    );
    assert.equal(requestSignal.aborted, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('rejects a poll response for a different simulation', async () => {
  await assert.rejects(
    withFetch(async (url, init) => {
      if (init?.method === 'POST') return response({ simulation_id: 'sim-4', status: 'queued', edges: null }, 202);
      return response({ simulation_id: 'sim-other', status: 'running', edges: null });
    }, () => runAndPollSimulation(nodes)),
    /different simulation/,
  );
});
