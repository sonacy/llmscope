import { describe, it, expect } from 'bun:test';
import { newEventId, isEventId, ID_PREFIX } from '../src/id.ts';

describe('newEventId', () => {
  it('produces a prefixed ULID', () => {
    const id = newEventId();
    expect(id.startsWith(ID_PREFIX)).toBe(true);
    expect(isEventId(id)).toBe(true);
  });

  it('is monotonically sortable when generated with increasing timestamps', () => {
    const a = newEventId(1);
    const b = newEventId(2);
    expect(a < b).toBe(true);
  });

  it('isEventId rejects non-prefixed strings', () => {
    expect(isEventId('01HABCDEFGHJKMNPQRSTVWXYZ0')).toBe(false);
    expect(isEventId('evt_short')).toBe(false);
  });
});
