import { ulid } from 'ulid';

export const ID_PREFIX = 'evt_';

export function newEventId(seedTime?: number): string {
  return ID_PREFIX + ulid(seedTime);
}

export function isEventId(s: string): boolean {
  return /^evt_[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
}
