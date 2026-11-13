import pino from 'pino';
import type { LoggerService } from '@nestjs/common';

/**
 * Structured JSON logger. Rule: no patient data in logs.
 * Any key that could carry clinical or identifying content is redacted,
 * wherever it appears in the log object (up to three levels deep).
 */
export const REDACTED_KEYS = [
  'authorization',
  'cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'full_name',
  'fullName',
  'name',
  'phone',
  'guardian_name',
  'guardianName',
  'allergies',
  'conditions',
  'diagnosis',
  'value',
  'transcript',
  'original_transcript',
  'body',
  'notes',
];

export function redactPaths(keys: string[]): string[] {
  const paths: string[] = [];
  for (const k of keys) {
    paths.push(k, `*.${k}`, `*.*.${k}`, `req.headers.${k}`);
  }
  return paths;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.APP_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'swasthyaiq-api', env: process.env.APP_ENV ?? 'local' },
  redact: { paths: redactPaths(REDACTED_KEYS), censor: '[redacted]' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** Adapts pino to Nest's LoggerService so framework logs use the same redaction. */
export class PinoNestLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    logger.info({ context }, String(message));
  }
  error(message: unknown, trace?: string, context?: string): void {
    logger.error({ context, trace }, String(message));
  }
  warn(message: unknown, context?: string): void {
    logger.warn({ context }, String(message));
  }
  debug(message: unknown, context?: string): void {
    logger.debug({ context }, String(message));
  }
  verbose(message: unknown, context?: string): void {
    logger.trace({ context }, String(message));
  }
}
