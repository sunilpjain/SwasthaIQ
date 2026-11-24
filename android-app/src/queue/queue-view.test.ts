import type { QueueEntry } from '@swasthyaiq/shared';
import {
  counts,
  istDayLabel,
  istTime,
  matches,
  rowModel,
  syncLine,
  tapAction,
  visibleEntries,
} from './queue-view';

const ME = 'u-samradnyee';
const OTHER = 'u-saiyam';

function entry(o: Partial<QueueEntry> & { name: string; phone?: string; mine?: boolean }): QueueEntry {
  return {
    patient: {
      id: `p-${o.name}`,
      token: 'X',
      fullName: o.name,
      ageYears: 47,
      sex: 'M',
      guardianName: null,
      phone: o.phone ?? '90000 10001',
      primaryDoctorId: o.mine === false ? OTHER : ME,
      allergies: [],
      conditions: [],
    },
    reason: 'Glaucoma follow-up',
    status: 'waiting',
    inConsultWithUserId: null,
    inConsultWithName: null,
    doctorName: o.mine === false ? 'Dr. Saiyam Shah' : 'Dr. Samradnyee Shah',
    appointmentAt: '2026-11-21T04:00:00.000Z', // 09:30 IST
    checkedInAt: '2026-11-21T03:51:00.000Z', // 09:21 IST
    isMine: o.mine !== false,
    ...o,
  };
}

describe('queue view', () => {
  it('shows times in IST, whatever the phone’s time zone', () => {
    expect(istTime('2026-11-21T04:00:00.000Z')).toBe('09:30');
    expect(istTime('2026-11-21T18:45:00.000Z')).toBe('00:15');
    expect(istDayLabel(new Date('2026-11-21T04:00:00Z'))).toBe('Sat 21 Nov');
    expect(istDayLabel(new Date('2026-11-21T19:00:00Z'))).toBe('Sun 22 Nov');
  });

  it('counts own and all patients, and filters', () => {
    const q = [entry({ name: 'A' }), entry({ name: 'B', mine: false }), entry({ name: 'C' })];
    expect(counts(q)).toEqual({ mine: 2, all: 3 });
    expect(visibleEntries(q, 'mine', '').map((e) => e.patient.fullName)).toEqual(['A', 'C']);
    expect(visibleEntries(q, 'all', '')).toHaveLength(3);
  });

  it('searches by any part of the name, or phone digits, across the whole queue', () => {
    const q = [
      entry({ name: 'Bhavesh Solanki', phone: '90000 10001' }),
      entry({ name: 'Rakesh Desai', phone: '90000 20002', mine: false }),
    ];
    expect(visibleEntries(q, 'mine', 'desai').map((e) => e.patient.fullName)).toEqual(['Rakesh Desai']);
    expect(visibleEntries(q, 'mine', '20002')).toHaveLength(1);
    expect(visibleEntries(q, 'mine', '9000020002')).toHaveLength(1);
    expect(matches(q[0]!, '00')).toBe(false); // too few digits to mean a phone search
    expect(visibleEntries(q, 'all', 'Mehul')).toEqual([]);
  });

  it('builds a row: appointment time first, check-in, status, no token', () => {
    const r = rowModel(entry({ name: 'Bhavesh Solanki', status: 'done' }), ME, 'mine');
    expect(r).toMatchObject({
      appointment: '09:30',
      title: 'Bhavesh Solanki · 47 M',
      statusLabel: 'Done',
      checkIn: 'Checked in 09:21',
      tag: null,
      highlighted: false,
    });
    expect(r.accessibilityLabel).not.toContain('X'); // the token is never shown
    expect(rowModel(entry({ name: 'A', status: 'not_arrived', checkedInAt: null }), ME, 'mine').checkIn).toBe(
      'Not checked in',
    );
  });

  it('tags who has the patient open, and the booked doctor in the All view', () => {
    const withMe = rowModel(entry({ name: 'A', status: 'in_consult', inConsultWithUserId: ME }), ME, 'mine');
    expect(withMe).toMatchObject({ tag: 'With you', tagTone: 'mine', highlighted: true });
    const withOther = rowModel(
      entry({
        name: 'B',
        status: 'in_consult',
        inConsultWithUserId: OTHER,
        inConsultWithName: 'Dr. Saiyam Shah',
      }),
      ME,
      'mine',
    );
    expect(withOther).toMatchObject({ tag: 'With Dr. Saiyam Shah', tagTone: 'other', highlighted: false });
    expect(rowModel(entry({ name: 'C', mine: false }), ME, 'all').tag).toBe('Dr. Saiyam Shah');
    expect(rowModel(entry({ name: 'D' }), ME, 'all').tag).toBeNull();
  });

  it('describes the sync state', () => {
    expect(syncLine(true, '2026-11-21T05:12:00Z')).toBe('Online · synced 10:42 · pull down to refresh');
    expect(syncLine(false, '2026-11-21T05:12:00Z')).toBe('Offline · showing the queue from 10:42');
    expect(syncLine(true, null)).toBe('Loading today’s queue…');
  });

  it('only views Done patients; opens everyone else', () => {
    expect(tapAction(entry({ name: 'A', status: 'done' }))).toBe('view');
    expect(tapAction(entry({ name: 'B', status: 'not_arrived' }))).toBe('open');
  });
});
