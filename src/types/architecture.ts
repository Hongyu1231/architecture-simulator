import type { Edge, Node } from '@xyflow/react';

export type ArchitectureNodeData = {
  label: string;
};

export type ArchitectureNode = Node<ArchitectureNodeData>;
export type ArchitectureEdge = Edge;

export type TraceEdge = {
  source: string;
  target: string;
  latency_ms: number;
  packets: number;
  status: string;
};

export type SimulationStatus = {
  simulation_id: string;
  status: 'queued' | 'running' | 'completed';
  edges?: TraceEdge[] | null;
};

export type CommandResult = {
  ok: boolean;
  message: string;
};

export type ChatEntry = {
  id: string;
  role: 'user' | 'system';
  text: string;
};
