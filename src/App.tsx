import { useEffect, useRef, useState } from 'react';
import { applyNodeChanges, type NodeChange } from '@xyflow/react';
import { ArchitectureCanvas } from './components/ArchitectureCanvas';
import { ChatPanel } from './components/ChatPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { applyTextCommand } from './lib/commandParser';
import { runAndPollSimulation } from './lib/simulationApi';
import type {
  ArchitectureEdge,
  ArchitectureNode,
  ChatEntry,
  SimulationStatus,
} from './types/architecture';
import './styles.css';

const initialNodes: ArchitectureNode[] = [
  {
    id: 'node_internet',
    type: 'default',
    position: { x: 60, y: 130 },
    data: { label: 'Internet' },
  },
  {
    id: 'node_web_server',
    type: 'default',
    position: { x: 330, y: 130 },
    data: { label: 'Web Server' },
  },
  {
    id: 'node_database',
    type: 'default',
    position: { x: 600, y: 130 },
    data: { label: 'Database' },
  },
];

const initialEdges: ArchitectureEdge[] = [
  { id: 'edge_internet_web', source: 'node_internet', target: 'node_web_server' },
  { id: 'edge_web_db', source: 'node_web_server', target: 'node_database' },
];

const initialHistory: ChatEntry[] = [
  {
    id: 'welcome',
    role: 'system',
    text: 'Try a text command to update the architecture. No LLM is required; commands are parsed deterministically.',
  },
];

export default function App() {
  const [nodes, setNodes] = useState<ArchitectureNode[]>(initialNodes);
  const [edges, setEdges] = useState<ArchitectureEdge[]>(initialEdges);
  const [history, setHistory] = useState<ChatEntry[]>(initialHistory);
  const [simulation, setSimulation] = useState<SimulationStatus | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRun = useRef<AbortController | null>(null);

  useEffect(() => () => activeRun.current?.abort(), []);

  const traceLength = simulation?.edges?.length ?? 0;

  const summary = `${nodes.length} node${nodes.length === 1 ? '' : 's'} • ${edges.length} architecture edge${edges.length === 1 ? '' : 's'}`;

  const invalidateSimulation = () => {
    activeRun.current?.abort();
    activeRun.current = null;
    setIsRunning(false);
    setSimulation(null);
    setCurrentStep(-1);
    setError(null);
  };

  const handleCommand = (text: string) => {
    const result = applyTextCommand(text, { nodes, edges });
    setHistory((items) => [
      ...items,
      { id: crypto.randomUUID(), role: 'user', text },
      { id: crypto.randomUUID(), role: 'system', text: result.message },
    ]);

    if (result.ok) {
      setNodes(result.nodes);
      setEdges(result.edges);
      invalidateSimulation();
    }
  };

  const handleNodesChange = (changes: NodeChange<ArchitectureNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  };

  const handleRun = async () => {
    if (activeRun.current || nodes.length === 0) return;
    const controller = new AbortController();
    activeRun.current = controller;
    setIsRunning(true);
    setError(null);
    setSimulation(null);
    setCurrentStep(-1);
    try {
      const completed = await runAndPollSimulation(nodes, (status) => {
        if (activeRun.current === controller) setSimulation(status);
      }, controller.signal);
      if (activeRun.current !== controller) return;
      setSimulation(completed);
      setCurrentStep((completed.edges?.length ?? 0) > 0 ? 0 : -1);
    } catch (caught) {
      if (activeRun.current !== controller || controller.signal.aborted) return;
      setSimulation(null);
      setError(caught instanceof Error ? caught.message : 'Unknown simulation error.');
    } finally {
      if (activeRun.current === controller) {
        activeRun.current = null;
        setIsRunning(false);
      }
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Take-home exercise</p>
          <h1>Architecture Simulation Explorer</h1>
          <p className="subtitle">Update a network architecture by text, run the supplied simulation API, and inspect the returned trace step by step.</p>
        </div>
        <div className="architecture-summary">{summary}</div>
      </header>

      <div className="workspace">
        <aside className="left-column">
          <ChatPanel history={history} onSubmit={handleCommand} />
          <SimulationPanel
            simulation={simulation}
            currentStep={currentStep}
            isRunning={isRunning}
            error={error}
            nodes={nodes}
            onRun={handleRun}
            onPrev={() => setCurrentStep((step) => Math.max(0, step - 1))}
            onNext={() => setCurrentStep((step) => Math.min(traceLength - 1, step + 1))}
          />
        </aside>

        <ArchitectureCanvas
          nodes={nodes}
          edges={edges}
          simulation={simulation}
          currentStep={currentStep}
          onNodesChange={handleNodesChange}
        />
      </div>
    </main>
  );
}
