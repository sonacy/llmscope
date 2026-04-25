export interface Broadcaster {
  publish(event: { kind: 'event_new' | 'event_update'; id: string }): void;
}

export class StubBroadcaster implements Broadcaster {
  public sent: { kind: string; id: string }[] = [];
  publish(event: { kind: 'event_new' | 'event_update'; id: string }): void {
    this.sent.push(event);
  }
}
