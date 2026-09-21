import type { ArchitectureNode, SimulationStatus, TraceEdge } from '../types/architecture';

const POLL_INTERVAL_MS = 1_000;
const MAX_SIMULATION_DURATION_MS = 45_000;
const TIMEOUT_MESSAGE = 'Simulation timed out after 45 seconds.';
const SERVICE_GUIDANCE = 'Check that the simulation service is running on 127.0.0.1:8000.';
const VALID_STATUSES = new Set(['queued', 'running', 'completed']);

type RequestLabel = 'Simulation start' | 'Simulation status';
type ValidStatus = 'queued' | 'running' | 'completed';

function abortReason(signal?: AbortSignal): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;

  const error = new Error('Simulation was aborted.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      cleanup();
      reject(abortReason(signal));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
  });
}

function createPollSignal(parentSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(abortReason(parentSignal));

  if (parentSignal) {
    parentSignal.addEventListener('abort', abortFromParent, { once: true });
    if (parentSignal.aborted) abortFromParent();
  }

  const timeout = setTimeout(() => {
    controller.abort(Object.assign(new Error(TIMEOUT_MESSAGE), { name: 'SimulationTimeoutError' }));
  }, MAX_SIMULATION_DURATION_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}

function nodeIdsFor(nodes: ArchitectureNode[]): Set<string> {
  const nodeIds = new Set<string>();

  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || node.id.trim() === '') {
      throw new Error('Simulation request contains a node with an invalid id.');
    }
    if (nodeIds.has(node.id)) {
      throw new Error(`Simulation request contains duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  return nodeIds;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Simulation response contains an invalid ${field}.`);
  }
  return value;
}

function validateTraceEdge(value: unknown, index: number, nodeIds?: ReadonlySet<string>): TraceEdge {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Simulation response contains an invalid trace edge at index ${index}.`);
  }

  const edge = value as Record<string, unknown>;
  const source = requiredString(edge.source, `trace source at index ${index}`);
  const target = requiredString(edge.target, `trace target at index ${index}`);
  if (nodeIds && (!nodeIds.has(source) || !nodeIds.has(target))) {
    throw new Error(`Simulation response contains a trace edge with an unknown node at index ${index}.`);
  }
  if (typeof edge.latency_ms !== 'number' || !Number.isFinite(edge.latency_ms) || edge.latency_ms < 0) {
    throw new Error(`Simulation response contains invalid latency_ms at index ${index}.`);
  }
  if (typeof edge.packets !== 'number' || !Number.isInteger(edge.packets) || edge.packets < 0) {
    throw new Error(`Simulation response contains invalid packets at index ${index}.`);
  }

  return {
    source,
    target,
    latency_ms: edge.latency_ms,
    packets: edge.packets,
    status: requiredString(edge.status, `trace status at index ${index}`),
  };
}

function isValidStatus(value: unknown): value is ValidStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value);
}

function validateSimulationStatus(value: unknown, nodeIds?: ReadonlySet<string>): SimulationStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Simulation response was malformed.');
  }

  const response = value as Record<string, unknown>;
  const simulationId = requiredString(response.simulation_id, 'simulation_id');
  if (!isValidStatus(response.status)) {
    throw new Error(`Simulation response contains an invalid status: ${String(response.status)}.`);
  }

  const rawEdges = response.edges;
  if (rawEdges !== undefined && rawEdges !== null && !Array.isArray(rawEdges)) {
    throw new Error('Simulation response contains an invalid edges value.');
  }
  if (response.status === 'completed' && !Array.isArray(rawEdges)) {
    throw new Error('Completed simulation response is missing trace edges.');
  }

  const edges = Array.isArray(rawEdges)
    ? rawEdges.map((edge, index) => validateTraceEdge(edge, index, nodeIds))
    : rawEdges;

  return {
    simulation_id: simulationId,
    status: response.status,
    edges,
  };
}

function responseDetail(body: string, statusText: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (!compact) return statusText || 'No response body.';

  try {
    const parsed: unknown = JSON.parse(compact);
    if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).detail === 'string') {
      return (parsed as Record<string, string>).detail;
    }
  } catch {
    // Keep a concise text response when the server did not return JSON.
  }

  return compact.length > 300 ? `${compact.slice(0, 297)}...` : compact;
}

async function requestJson(
  url: string,
  init: RequestInit,
  label: RequestLabel,
  signal?: AbortSignal,
): Promise<unknown> {
  throwIfAborted(signal);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (caught) {
    if (signal?.aborted) throw abortReason(signal);
    const message = caught instanceof Error && caught.message ? `: ${caught.message}` : '';
    throw new Error(`${label} request failed${message} ${SERVICE_GUIDANCE}`);
  }

  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch (caught) {
      if (signal?.aborted) throw abortReason(signal);
      body = caught instanceof Error ? caught.message : '';
    }

    const guidance = response.status >= 500 ? ` ${SERVICE_GUIDANCE}` : '';
    throw new Error(`${label} failed (${response.status}): ${responseDetail(body, response.statusText)}${guidance}`);
  }

  try {
    return await response.json();
  } catch (caught) {
    if (signal?.aborted) throw abortReason(signal);
    const message = caught instanceof Error && caught.message ? `: ${caught.message}` : '';
    throw new Error(`${label} returned invalid JSON${message}`);
  }
}

async function getSimulationForNodes(
  simulationId: string,
  nodeIds: ReadonlySet<string> | undefined,
  signal?: AbortSignal,
): Promise<SimulationStatus> {
  if (typeof simulationId !== 'string' || simulationId.trim() === '') {
    throw new Error('Simulation status request requires a valid simulation_id.');
  }

  const payload = await requestJson(
    `/api/simulate/${encodeURIComponent(simulationId)}`,
    {},
    'Simulation status',
    signal,
  );
  return validateSimulationStatus(payload, nodeIds);
}

export async function startSimulation(
  nodes: ArchitectureNode[],
  signal?: AbortSignal,
): Promise<SimulationStatus> {
  const nodeIds = nodeIdsFor(nodes);
  const payload = await requestJson(
    '/api/simulate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: nodes.map((node) => ({ id: node.id, type: node.type ?? null })),
      }),
    },
    'Simulation start',
    signal,
  );

  return validateSimulationStatus(payload, nodeIds);
}

export async function getSimulation(
  simulationId: string,
  signal?: AbortSignal,
): Promise<SimulationStatus> {
  return getSimulationForNodes(simulationId, undefined, signal);
}

export async function runAndPollSimulation(
  nodes: ArchitectureNode[],
  onStatus?: (status: SimulationStatus) => void,
  signal?: AbortSignal,
): Promise<SimulationStatus> {
  const nodeIds = nodeIdsFor(nodes);
  const poll = createPollSignal(signal);

  try {
    const created = await startSimulation(nodes, poll.signal);
    onStatus?.(created);
    if (created.status === 'completed') return created;

    while (true) {
      await delay(POLL_INTERVAL_MS, poll.signal);
      const current = await getSimulationForNodes(created.simulation_id, nodeIds, poll.signal);
      if (current.simulation_id !== created.simulation_id) {
        throw new Error('Simulation status response belongs to a different simulation.');
      }
      onStatus?.(current);
      if (current.status === 'completed') return current;
    }
  } finally {
    poll.cleanup();
  }
}
