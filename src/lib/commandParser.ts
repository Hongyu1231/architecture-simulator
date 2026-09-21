import type { ArchitectureEdge, ArchitectureNode, CommandResult } from '../types/architecture';

export type ArchitectureState = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};

export type CommandApplyResult = CommandResult & ArchitectureState;

const MAX_NODE_LABEL_LENGTH = 80;
const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 80;
const NODE_PADDING = 16;
const GRID_COLUMN_STEP = DEFAULT_NODE_WIDTH + NODE_PADDING * 2;
const GRID_ROW_STEP = DEFAULT_NODE_HEIGHT + NODE_PADDING * 2;

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

const cleanLabel = (value: string) => {
  const normalized = normalizeWhitespace(value);
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const isQuoted =
    normalized.length >= 2 &&
    ((first === '"' && last === '"') || (first === "'" && last === "'"));

  return normalizeWhitespace(isQuoted ? normalized.slice(1, -1) : normalized);
};

const findNodeByLabel = (nodes: ArchitectureNode[], label: string) => {
  const normalized = cleanLabel(label).toLowerCase();
  return nodes.find((node) => cleanLabel(node.data.label).toLowerCase() === normalized);
};

type NodeRectangle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const nodeRectangle = (node: ArchitectureNode): NodeRectangle => {
  const width = Math.max(DEFAULT_NODE_WIDTH, node.measured?.width ?? node.width ?? 0);
  const height = Math.max(DEFAULT_NODE_HEIGHT, node.measured?.height ?? node.height ?? 0);

  return {
    left: node.position.x - NODE_PADDING,
    top: node.position.y - NODE_PADDING,
    right: node.position.x + width + NODE_PADDING,
    bottom: node.position.y + height + NODE_PADDING,
  };
};

const rectanglesOverlap = (first: NodeRectangle, second: NodeRectangle) =>
  first.left < second.right &&
  first.right > second.left &&
  first.top < second.bottom &&
  first.bottom > second.top;

const newNodePosition = (nodes: ArchitectureNode[]) => {
  const occupied = nodes.map(nodeRectangle);

  for (let slot = 0; ; slot += 1) {
    const position = {
      x: 80 + (slot % 3) * GRID_COLUMN_STEP,
      y: 80 + Math.floor(slot / 3) * GRID_ROW_STEP,
    };
    const candidate: NodeRectangle = {
      left: position.x,
      top: position.y,
      right: position.x + DEFAULT_NODE_WIDTH,
      bottom: position.y + DEFAULT_NODE_HEIGHT,
    };

    if (!occupied.some((rectangle) => rectanglesOverlap(candidate, rectangle))) return position;
  }
};

const addNode = (state: ArchitectureState, rawLabel: string): CommandApplyResult => {
  const label = cleanLabel(rawLabel);
  if (!label) return { ...state, ok: false, message: 'Node label cannot be empty.' };
  if (label.length > MAX_NODE_LABEL_LENGTH) {
    return {
      ...state,
      ok: false,
      message: `Node label cannot exceed ${MAX_NODE_LABEL_LENGTH} characters.`,
    };
  }
  if (findNodeByLabel(state.nodes, label)) {
    return { ...state, ok: false, message: `Node “${label}” already exists.` };
  }

  const node: ArchitectureNode = {
    id: `node_${crypto.randomUUID()}`,
    type: 'default',
    position: newNodePosition(state.nodes),
    data: { label },
  };

  return {
    nodes: [...state.nodes, node],
    edges: state.edges,
    ok: true,
    message: `Added node “${label}”.`,
  };
};

const removeNode = (state: ArchitectureState, rawLabel: string): CommandApplyResult => {
  const node = findNodeByLabel(state.nodes, rawLabel);
  if (!node) {
    return { ...state, ok: false, message: `Could not find node “${cleanLabel(rawLabel)}”.` };
  }

  return {
    nodes: state.nodes.filter((candidate) => candidate.id !== node.id),
    edges: state.edges.filter((edge) => edge.source !== node.id && edge.target !== node.id),
    ok: true,
    message: `Removed node “${node.data.label}” and its connected edges.`,
  };
};

const addEdge = (
  state: ArchitectureState,
  rawSource: string,
  rawTarget: string,
): CommandApplyResult => {
  const source = findNodeByLabel(state.nodes, rawSource);
  const target = findNodeByLabel(state.nodes, rawTarget);

  if (!source || !target) {
    const missing = [!source ? cleanLabel(rawSource) : null, !target ? cleanLabel(rawTarget) : null]
      .filter(Boolean)
      .join(', ');
    return { ...state, ok: false, message: `Missing node(s): ${missing}.` };
  }

  if (source.id === target.id) {
    return { ...state, ok: false, message: 'Source and target must be different nodes.' };
  }

  const duplicate = state.edges.some(
    (edge) => edge.source === source.id && edge.target === target.id,
  );
  if (duplicate) {
    return {
      ...state,
      ok: false,
      message: `Edge ${source.data.label} → ${target.data.label} already exists.`,
    };
  }

  const edge: ArchitectureEdge = {
    id: `edge_${crypto.randomUUID()}`,
    source: source.id,
    target: target.id,
  };

  return {
    nodes: state.nodes,
    edges: [...state.edges, edge],
    ok: true,
    message: `Connected ${source.data.label} → ${target.data.label}.`,
  };
};

const removeEdge = (
  state: ArchitectureState,
  rawSource: string,
  rawTarget: string,
): CommandApplyResult => {
  const source = findNodeByLabel(state.nodes, rawSource);
  const target = findNodeByLabel(state.nodes, rawTarget);

  if (!source || !target) {
    return { ...state, ok: false, message: 'Both nodes must exist before removing an edge.' };
  }

  const existing = state.edges.find(
    (edge) => edge.source === source.id && edge.target === target.id,
  );
  if (!existing) {
    return {
      ...state,
      ok: false,
      message: `No edge exists from ${source.data.label} → ${target.data.label}.`,
    };
  }

  return {
    nodes: state.nodes,
    edges: state.edges.filter((edge) => edge.id !== existing.id),
    ok: true,
    message: `Removed edge ${source.data.label} → ${target.data.label}.`,
  };
};

export const applyTextCommand = (
  input: string,
  state: ArchitectureState,
): CommandApplyResult => {
  const command = typeof input === 'string' ? normalizeWhitespace(input) : '';

  let match = command.match(/^(?:add|create)\s+node\s+(.+)$/i);
  if (match) return addNode(state, match[1]);

  match = command.match(/^(?:remove|delete)\s+node\s+(.+)$/i);
  if (match) return removeNode(state, match[1]);

  match = command.match(
    /^(?:connect|add\s+edge)\s+("[^"]+"|'[^']+'|.+?)\s+(?:to|->)\s+("[^"]+"|'[^']+'|.+)$/i,
  );
  if (match) return addEdge(state, match[1], match[2]);

  match = command.match(
    /^(?:disconnect|remove\s+edge|delete\s+edge)\s+("[^"]+"|'[^']+'|.+?)\s+(?:from|to|->)\s+("[^"]+"|'[^']+'|.+)$/i,
  );
  if (match) return removeEdge(state, match[1], match[2]);

  return {
    ...state,
    ok: false,
    message:
      'Unsupported command. Try “add node Cache”, “connect Web Server to Cache”, “remove node Cache”, or “remove edge Web Server to Database”.',
  };
};
