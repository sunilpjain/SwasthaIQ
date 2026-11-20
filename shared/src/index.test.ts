import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseUsername, sortQueue } from './index';

test('normaliseUsername lower-cases and trims', () => {
  assert.equal(normaliseUsername('  Saiyam '), 'saiyam');
  assert.equal(normaliseUsername('SAMRADNYEE'), 'samradnyee');
});

test('sortQueue puts own patients first, then by appointment time, then token', () => {
  const q = [
    { isMine: false, appointmentAt: '2026-11-20T04:00:00.000Z', patient: { token: 'E2' } },
    { isMine: true, appointmentAt: '2026-11-20T04:15:00.000Z', patient: { token: 'G2' } },
    { isMine: true, appointmentAt: '2026-11-20T04:00:00.000Z', patient: { token: 'G10' } },
    { isMine: true, appointmentAt: '2026-11-20T04:00:00.000Z', patient: { token: 'G9' } },
    { isMine: false, appointmentAt: '2026-11-20T04:30:00.000Z', patient: { token: 'E1' } },
  ];
  assert.deepEqual(
    sortQueue(q).map((e) => e.patient.token),
    ['G9', 'G10', 'G2', 'E2', 'E1'],
  );
});
