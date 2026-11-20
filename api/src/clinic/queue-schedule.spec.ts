import { dailySchedule, istMidnight, msUntilNextIst } from './queue-schedule';

const HOUR = 3600_000;

describe('queue schedule (DIG-39)', () => {
  it.each([
    ['late evening UTC is already the next IST day', '2026-11-20T19:00:00Z', '2026-11-20T18:30:00.000Z'],
    ['just before IST midnight', '2026-11-20T18:29:59Z', '2026-11-19T18:30:00.000Z'],
    ['IST morning', '2026-11-20T04:00:00Z', '2026-11-19T18:30:00.000Z'],
  ])('istMidnight: %s', (_label, now, expected) => {
    expect(istMidnight(new Date(now)).toISOString()).toBe(expected);
  });

  it.each([
    ['01:59 IST → 1 minute', '2026-11-20T20:29:00Z', 60_000],
    ['exactly 02:00 IST → next day', '2026-11-20T20:30:00Z', 24 * HOUR],
    ['10:00 IST → 16 hours', '2026-11-21T04:30:00Z', 16 * HOUR],
  ])('msUntilNextIst(2): %s', (_label, now, expected) => {
    expect(msUntilNextIst(2, new Date(now))).toBe(expected);
  });

  const patients = [
    { id: 'g2', token: 'G2', doctorId: 'saiyam' },
    { id: 'g10', token: 'G10', doctorId: 'saiyam' },
    { id: 'g1', token: 'G1', doctorId: 'saiyam' },
    { id: 'e1', token: 'E1', doctorId: 'samradnyee' },
    { id: 'e2', token: 'E2', doctorId: 'samradnyee' },
  ];
  const slots = dailySchedule(patients, new Date('2026-11-20T10:00:00Z'));
  const at = (id: string) => slots.find((s) => s.patientId === id)!;

  it('books each doctor every 15 minutes from 09:30 IST in token order', () => {
    expect(at('g1').appointmentAt.toISOString()).toBe('2026-11-20T04:00:00.000Z'); // 09:30 IST
    expect(at('g2').appointmentAt.toISOString()).toBe('2026-11-20T04:15:00.000Z');
    expect(at('g10').appointmentAt.toISOString()).toBe('2026-11-20T04:30:00.000Z');
    expect(at('e1').appointmentAt.toISOString()).toBe('2026-11-20T04:00:00.000Z');
  });

  it("checks everyone in early except each doctor's last appointment", () => {
    for (const s of slots.filter((x) => x.checkedInAt)) {
      expect(s.checkedInAt!.getTime()).toBeLessThan(s.appointmentAt.getTime());
    }
    expect(
      slots
        .filter((s) => !s.checkedInAt)
        .map((s) => s.patientId)
        .sort(),
    ).toEqual(['e2', 'g10']);
  });
});
