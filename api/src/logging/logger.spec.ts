import { Writable } from 'node:stream';
import pino from 'pino';
import { REDACTED_KEYS, redactPaths } from './logger';

function capture(): { log: pino.Logger; lines: () => string } {
  let buf = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buf += chunk.toString();
      cb();
    },
  });
  const paths = redactPaths(REDACTED_KEYS);
  return { log: pino({ redact: { paths, censor: '[redacted]' } }, stream), lines: () => buf };
}

describe('logger redaction (no patient data in logs)', () => {
  it('redacts names, phones, diagnoses and tokens at any nesting level', () => {
    const { log, lines } = capture();
    log.info(
      {
        fullName: 'Rakesh Desai',
        patient: { phone: '90000 10001', diagnosis: 'GERD' },
        req: { headers: { authorization: 'Bearer abc' } },
        visitId: '1234',
      },
      'consult saved',
    );
    const out = lines();
    expect(out).not.toMatch(/Rakesh|90000|GERD|Bearer abc/);
    expect(out).toContain('"visitId":"1234"');
    expect(out).toContain('[redacted]');
  });
});
