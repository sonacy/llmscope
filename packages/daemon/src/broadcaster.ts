export type BroadcastFrame =
  | { kind: 'event_new'; id: string }
  | { kind: 'event_update'; id: string }
  | { kind: 'stats_invalidate' };

export interface Broadcaster {
  publish(event: BroadcastFrame): void;
  subscribe(listener: (e: BroadcastFrame) => void): () => void;
}

export class HubBroadcaster implements Broadcaster {
  private listeners = new Set<(e: BroadcastFrame) => void>();
  publish(event: BroadcastFrame): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        /* swallow per-listener errors */
      }
    }
  }
  subscribe(listener: (e: BroadcastFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  size(): number {
    return this.listeners.size;
  }
}

export class StubBroadcaster implements Broadcaster {
  public sent: BroadcastFrame[] = [];
  publish(event: BroadcastFrame): void {
    this.sent.push(event);
  }
  subscribe(): () => void {
    return () => {};
  }
}
