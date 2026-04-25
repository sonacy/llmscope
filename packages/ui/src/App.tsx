import { useEffect, useState } from 'react';
import { bootstrap, type Bootstrap } from './lib/api';
import { Card, CardTitle } from './components/ui/Card';
import { useRoute, navigate } from './lib/router';
import { useStream } from './lib/ws';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DaemonStatusBanner } from './components/DaemonStatusBanner';
import { EventList } from './pages/EventList';
import { EventDetailPage } from './pages/EventDetail';
import { StatsPage } from './pages/Stats';
import { SourcesPage } from './pages/Sources';
import { NotFoundPage } from './pages/NotFound';

const NAV: { path: string; label: string }[] = [
  { path: '/', label: 'events' },
  { path: '/stats', label: 'stats' },
  { path: '/sources', label: 'sources' },
];

export function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap().then(setBoot).catch((e) => setBootError(String(e)));
  }, []);

  const route = useRoute();
  const { connected } = useStream();

  if (bootError) {
    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto">
        <Card className="border-red-700 bg-red-950/30">
          <CardTitle>Bootstrap failed</CardTitle>
          <pre className="text-xs text-red-200 whitespace-pre-wrap">{bootError}</pre>
          <p className="text-xs text-zinc-400 mt-2">
            Pass your token in the URL as <code className="bg-zinc-800 px-1 py-0.5 rounded">?t=YOUR_TOKEN</code> on
            first load, or set it via <code>llmscope rotate-token</code>.
          </p>
        </Card>
      </div>
    );
  }
  if (!boot) return <div className="p-6 text-xs text-zinc-500">connecting…</div>;

  return (
    <ErrorBoundary>
      <DaemonStatusBanner connected={connected} />
      <div className="min-h-screen max-w-6xl mx-auto px-6 py-4">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold tracking-tight">llmscope</h1>
            <nav className="flex gap-1 text-xs">
              {NAV.map((n) => {
                const active =
                  (n.path === '/' && (route.path === '/' || route.path.startsWith('/events'))) ||
                  route.path === n.path;
                return (
                  <button
                    key={n.path}
                    onClick={() => navigate(n.path)}
                    className={`px-3 py-1.5 rounded ${
                      active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {n.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="text-xs text-zinc-500">v{boot.version} · :{boot.port}</div>
        </header>
        <main>{renderRoute(route.path, route.query)}</main>
      </div>
    </ErrorBoundary>
  );
}

function renderRoute(path: string, query: URLSearchParams) {
  if (path === '/' || path === '/events') return <EventList query={query} />;
  if (path.startsWith('/events/')) return <EventDetailPage id={path.slice('/events/'.length)} />;
  if (path === '/stats') return <StatsPage />;
  if (path === '/sources') return <SourcesPage />;
  return <NotFoundPage />;
}
