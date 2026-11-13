import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseUsername, sortQueue } from './index';

test('normaliseUsername lower-cases and trims', () => {
  assert.equal(normaliseUsername('  Saiyam '), 'saiyam');
  assert.equal(normaliseUsername('SAMRADNYEE'), 'samradnyee');
});

test('sortQueue puts own patients first, then by token numerically', () => {
  const q = [
    { isMine: false, patient: { token: 'E2' } },
    { isMine: true, patient: { token: 'G10' } },
    { isMine: true, patient: { token: 'G2' } },
    { isMine: false, patient: { token: 'E1' } },
  ];
  assert.deepEqual(
    sortQueue(q).map((e) => e.patient.token),
    ['G2', 'G10', 'E1', 'E2'],
  );
});
