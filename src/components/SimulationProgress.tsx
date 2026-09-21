import { useEffect, useRef, useState } from 'react';
import type { SimulationStatus } from '../types/architecture';

const EXPECTED_DURATION_MS = 15_000;

type Props = {
  status: SimulationStatus['status'] | null;
};

type ProgressStage = 'sending' | 'queued' | 'running' | 'waiting';

const stages: Array<{ id: ProgressStage; label: string }> = [
  { id: 'sending', label: 'Sending request' },
  { id: 'queued', label: 'Queued' },
  { id: 'running', label: 'Running simulation' },
  { id: 'waiting', label: 'Waiting for result' },
];

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function stageFor(status: Props['status'], elapsedMs: number): ProgressStage {
  if (status === 'queued') return 'queued';
  if (status === 'running') return elapsedMs >= EXPECTED_DURATION_MS ? 'waiting' : 'running';
  return 'sending';
}

function elapsedLabel(elapsedMs: number): string {
  return `${Math.floor(elapsedMs / 1_000)}s elapsed`;
}

export function SimulationProgress({ status }: Props) {
  const startedAt = useRef(now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const stage = stageFor(status, elapsedMs);
  const stageIndex = stages.findIndex((item) => item.id === stage);
  const stageLabel = stages[stageIndex]?.label ?? stages[0].label;
  const description = stage === 'sending'
    ? 'Sending your architecture to the simulation service.'
    : stage === 'queued'
      ? 'The service accepted the run and queued it.'
      : stage === 'running'
        ? 'The service is processing the simulation.'
        : 'This service usually takes about 15 seconds. It is still running; waiting for the completed result.';

  useEffect(() => {
    const updateElapsed = () => setElapsedMs(now() - startedAt.current);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="simulation-progress"
      data-stage={stage}
      data-api-status={status ?? 'starting'}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="simulation-progress__header">
        <span className="simulation-progress__spinner" aria-hidden="true" />
        <div className="simulation-progress__copy">
          <strong>{stageLabel}</strong>
          <span>{elapsedLabel(elapsedMs)}</span>
        </div>
      </div>

      <div
        className="simulation-progress__bar"
        role="progressbar"
        aria-label="Simulation progress"
        aria-valuetext={`${stageLabel}; ${elapsedLabel(elapsedMs)}`}
      />

      <ol className="simulation-progress__stages" aria-label="Simulation stages">
        {stages.map((item, index) => (
          <li
            className={`simulation-progress__stage ${index <= stageIndex ? 'is-reached' : ''} ${item.id === stage ? 'is-active' : ''}`}
            key={item.id}
            aria-current={item.id === stage ? 'step' : undefined}
          >
            {item.label}
          </li>
        ))}
      </ol>

      <p className="simulation-progress__message">{description}</p>
    </div>
  );
}
