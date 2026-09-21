import type { ArchitectureNode, SimulationStatus } from '../types/architecture';
import { SimulationProgress } from './SimulationProgress';

type Props = {
  simulation: SimulationStatus | null;
  currentStep: number;
  isRunning: boolean;
  error: string | null;
  nodes: ArchitectureNode[];
  onRun: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function SimulationPanel({
  simulation,
  currentStep,
  isRunning,
  error,
  nodes,
  onRun,
  onPrev,
  onNext,
}: Props) {
  const trace = simulation?.edges ?? [];
  const current = currentStep >= 0 ? trace[currentStep] : undefined;
  const labelFor = (id: string) => nodes.find((node) => node.id === id)?.data.label ?? id;

  return (
    <section className="panel simulation-panel">
      <div className="panel-heading simulation-heading">
        <div>
          <p className="eyebrow">Third-party API</p>
          <h2>Simulation explorer</h2>
        </div>
        <button className="run-button" onClick={onRun} disabled={isRunning || nodes.length === 0}>
          {isRunning ? 'Running…' : 'Run simulation'}
        </button>
      </div>

      <div className="status-row" role="status" aria-live="polite">
        <span className="status-label">Status</span>
        <span className={`status-pill ${error ? 'error' : simulation?.status ?? (isRunning ? 'queued' : 'idle')}`}>
          {error ? 'error' : simulation?.status ?? (isRunning ? 'starting' : 'idle')}
        </span>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {isRunning && simulation?.status !== 'completed' && <SimulationProgress status={simulation?.status ?? null} />}
      {nodes.length === 0 && <p className="empty-trace">Add at least one node to run a simulation.</p>}

      {simulation?.status === 'completed' && trace.length === 0 && (
        <div className="empty-trace">Simulation completed with no trace edges.</div>
      )}

      {current && (
        <div className="step-card">
          <div className="step-topline">
            <strong>
              Step {currentStep + 1} of {trace.length}
            </strong>
            <span>{current.status}</span>
          </div>
          <p className="step-description">
            {labelFor(current.source)} → {labelFor(current.target)}
          </p>
          <div className="metrics">
            <div><span>Latency</span><strong>{current.latency_ms} ms</strong></div>
            <div><span>Packets</span><strong>{current.packets}</strong></div>
          </div>
          <div className="step-controls">
            <button onClick={onPrev} disabled={currentStep <= 0}>← Previous</button>
            <button onClick={onNext} disabled={currentStep >= trace.length - 1}>Next →</button>
          </div>
        </div>
      )}

      <p className="simulation-note">
        The supplied service waits about 15 seconds, then returns a simulated path through the current nodes. The app polls until the status becomes completed.
      </p>
    </section>
  );
}
