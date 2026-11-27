import { canEdit, isSameDayEdit, versionTag } from './amend';
import { istTime } from '../queue/queue-view';

describe('same-day edits (DIG-97)', () => {
  const signed = '2026-11-27T10:00:00.000Z'; // 3:30 pm IST
  it('needs no reason until midnight IST on the signing day', () => {
    expect(isSameDayEdit(signed, new Date('2026-11-27T18:29:59Z'))).toBe(true);
    expect(isSameDayEdit(signed, new Date('2026-11-27T18:30:00Z'))).toBe(false);
    expect(isSameDayEdit(null, new Date(signed))).toBe(false);
  });

  it('lets only the signing doctor edit a signed visit', () => {
    expect(canEdit({ status: 'signed', doctorId: 'me' }, 'me')).toBe(true);
    expect(canEdit({ status: 'signed', doctorId: 'other' }, 'me')).toBe(false);
    expect(canEdit({ status: 'draft', doctorId: 'me' }, 'me')).toBe(false);
  });

  it('tags edited visits with the version and when', () => {
    const now = new Date('2026-11-27T12:00:00Z');
    expect(versionTag({ version: 1, editedAt: null }, now, istTime)).toBeNull();
    expect(versionTag({ version: 2, editedAt: '2026-11-27T10:45:00Z' }, now, istTime)).toBe(
      'v2 · edited 4:15 pm',
    );
    expect(versionTag({ version: 3, editedAt: '2026-11-25T10:45:00Z' }, now, istTime)).toBe(
      'v3 · edited 25 Nov',
    );
  });
});
