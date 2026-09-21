import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatEntry } from '../types/architecture';

type Props = {
  history: ChatEntry[];
  onSubmit: (text: string) => void;
};

const examples = [
  'add node Cache',
  'connect Web Server to Cache',
  'remove edge Web Server to Database',
  'remove node Cache',
];

export function ChatPanel({ history, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = historyRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => { panel.scrollTop = panel.scrollHeight; });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const panel = historyRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [history]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Architecture input</p>
          <h2>Chat commands</h2>
        </div>
      </div>

      <div className="examples">
        {examples.map((example) => (
          <button key={example} type="button" className="example-chip" onClick={() => setValue(example)}>
            {example}
          </button>
        ))}
      </div>

      <div className="chat-history" ref={historyRef} role="log" aria-label="Command history" aria-live="polite">
        {history.map((entry) => (
          <div key={entry.id} className={`chat-message ${entry.role}`}>
            <span>{entry.role === 'user' ? 'You' : 'App'}</span>
            <p>{entry.text}</p>
          </div>
        ))}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. add node Cache"
          aria-label="Architecture command"
        />
        <button type="submit">Apply</button>
      </form>
    </section>
  );
}
