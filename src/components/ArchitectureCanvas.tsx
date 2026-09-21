import { useEffect } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type NodeProps,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ArchitectureEdge, ArchitectureNode, SimulationStatus } from '../types/architecture';

type Props = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  simulation: SimulationStatus | null;
  currentStep: number;
  onNodesChange: OnNodesChange<ArchitectureNode>;
};

function SystemNode({ data, type }: NodeProps<ArchitectureNode>) {
  return <>
    <Handle type="target" position={Position.Left} />
    <Handle type="source" position={Position.Right} />
    <Handle id="trace-target" type="target" position={Position.Top} />
    <Handle id="trace-source" type="source" position={Position.Bottom} />
    <div className="node-label">{data.label}</div>
    <div className="node-type">Type: {type}</div>
  </>;
}

const nodeTypes = { default: SystemNode };

// Refit after topology changes, once React Flow has measured the new nodes.
function FitArchitecture({ nodeIds }: { nodeIds: string }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  useEffect(() => {
    if (initialized) void fitView({ padding: 0.25, duration: 200, maxZoom: 1.2 });
  }, [initialized, nodeIds, fitView, width, height]);
  return null;
}

export function ArchitectureCanvas({
  nodes,
  edges,
  simulation,
  currentStep,
  onNodesChange,
}: Props) {
  const trace = simulation?.edges ?? [];
  const currentTrace = currentStep >= 0 ? trace[currentStep] : undefined;
  const visitedNodeIds = new Set(trace.flatMap((edge) => [edge.source, edge.target]));

  const displayNodes = nodes.map((node) => {
    const isCurrent =
      currentTrace && (node.id === currentTrace.source || node.id === currentTrace.target);
    const isVisited = visitedNodeIds.has(node.id);

    return {
      ...node,
      className: isCurrent ? 'current-node' : undefined,
      zIndex: 3,
      style: {
        border: isCurrent
          ? '3px solid #dc2626'
          : isVisited
            ? '2px solid #f59e0b'
            : '1px solid #94a3b8',
        borderRadius: 12,
        padding: 10,
        background: '#ffffff',
        boxShadow: isCurrent ? '0 0 0 4px rgba(220,38,38,.12)' : '0 6px 18px rgba(15,23,42,.08)',
        fontWeight: 650,
        width: 160,
      },
    };
  });

  const architectureEdges: Edge[] = edges.map((edge) => ({
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#64748b', strokeWidth: 2 },
  }));

  const traceEdges: Edge[] = trace.map((edge, index) => ({
    id: `trace-${simulation?.simulation_id}-${index}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: 'trace-source',
    targetHandle: 'trace-target',
    className: index === currentStep ? 'trace-edge current-trace-edge' : 'trace-edge',
    selectable: false,
    deletable: false,
    zIndex: index === currentStep ? 2 : 1,
    animated: true,
    label: `${edge.latency_ms} ms • ${edge.packets} pkts`,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: {
      stroke: index === currentStep ? '#dc2626' : '#f59e0b',
      strokeWidth: index === currentStep ? 4 : 2.5,
      strokeDasharray: '8 6',
    },
    labelStyle: {
      fill: index === currentStep ? '#991b1b' : '#92400e',
      fontWeight: 700,
    },
  }));

  return (
    <section className="canvas-shell">
      <div className="canvas-legend">
        <span><i className="legend-line architecture" /> Architecture edge</span>
        <span><i className="legend-line trace" /> Simulation trace</span>
        <span><i className="legend-line active" /> Current step</span>
      </div>
      <ReactFlow<ArchitectureNode, ArchitectureEdge>
        nodes={displayNodes}
        edges={[...architectureEdges, ...traceEdges]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        deleteKeyCode={null}
        minZoom={0.2}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <FitArchitecture nodeIds={nodes.map((node) => node.id).join(',')} />
        <Background gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </section>
  );
}
