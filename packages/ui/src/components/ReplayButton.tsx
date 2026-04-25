import { useState } from 'react';
import { authHeader } from '../lib/api';
import { Button } from './ui/Button';
import { navigate } from '../lib/router';

interface ReplayButtonProps {
  eventId: string;
}

export function ReplayButton({ eventId }: ReplayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/replay`, { method: 'POST', headers: authHeader() });
      if (res.status === 409) {
        setError(
          'Replay needs the original API key, but llmscope masked it before storage. Send the request again from the source app to capture a fresh one, or replay manually with curl.',
        );
        return;
      }
      if (!res.ok) {
        setError(`Replay failed: ${res.status}`);
        return;
      }
      const j = (await res.json()) as { new_event_id: string };
      navigate(`/events/${j.new_event_id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={go} disabled={busy}>{busy ? 'replaying…' : 'replay'}</Button>
      {error ? <p className="text-xs text-red-300 mt-2">{error}</p> : null}
    </div>
  );
}
