import { useCallback, useEffect, useState } from 'react';

import { checkServer, type ServerStatus } from './server-status';

const STATUS_TEXT: Record<ServerStatus['kind'], { label: string; detail: string }> = {
  checking: { label: 'Checking', detail: 'Contacting the HospitalOS server…' },
  ready: { label: 'Ready', detail: 'The server and its database are running.' },
  'not-ready': {
    label: 'Database unavailable',
    detail: 'The server answers, but its database is not ready. Ask the administrator to check it.',
  },
  unreachable: {
    label: 'Server unreachable',
    detail: 'This computer cannot reach the HospitalOS server. Check the network and the address.',
  },
};

/**
 * Phase W1 shell: proves the browser app is built, served by the API from the same origin, and
 * can read the server's health. It has no sign-in and no hospital functions yet (phase W3).
 */
export function App() {
  const [status, setStatus] = useState<ServerStatus>({ kind: 'checking' });

  const refresh = useCallback(() => {
    setStatus({ kind: 'checking' });
    void checkServer((input, init) => fetch(input, init)).then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const text = STATUS_TEXT[status.kind];
  return (
    <main className="shell">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <h1>HospitalOS</h1>
          <p className="eyebrow">Hospital workstation</p>
        </div>
      </header>

      <section className="card" aria-labelledby="server-heading">
        <h2 id="server-heading">Server status</h2>
        <p className={`status status-${status.kind}`} role="status" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {text.label}
        </p>
        <p className="detail">{text.detail}</p>
        <button type="button" onClick={refresh} disabled={status.kind === 'checking'}>
          Check again
        </button>
      </section>

      <p className="notice">
        Development preview (phase W1). Sign-in and hospital modules are not available in this
        build. Synthetic data only.
      </p>
    </main>
  );
}
