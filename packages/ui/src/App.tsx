import { useEffect, useState } from 'react';
import { bootstrap, type Bootstrap } from './lib/api';
import { Card, CardTitle } from './components/ui/Card';

export function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap().then(setBoot).catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">llmscope</h1>
        <div className="text-xs text-zinc-500">
          {boot ? `v${boot.version} · port ${boot.port}` : 'connecting…'}
        </div>
      </header>
      {error ? (
        <Card className="border-red-700 bg-red-950/30">
          <CardTitle>Bootstrap failed</CardTitle>
          <pre className="text-xs text-red-200 whitespace-pre-wrap">{error}</pre>
        </Card>
      ) : (
        <Card>
          <CardTitle>Hello llmscope</CardTitle>
          <p className="text-sm text-zinc-400">
            Daemon connected. Event list, detail, and stats land in upcoming steps.
          </p>
        </Card>
      )}
    </div>
  );
}
