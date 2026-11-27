import { BadRequestException } from '@nestjs/common';
import {
  CONDITION_STATUSES,
  ICD10_CODE_RE,
  type ConditionStatus,
  type PatientConditionInput,
  type PatientConditionUpdate,
} from '@swasthyaiq/shared';

/** Error messages name the bad path only, never the submitted value. */
function bad(path: string, problem: string): never {
  throw new BadRequestException({ code: 'invalid_body', message: `${path} ${problem}` });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function status(v: unknown): ConditionStatus {
  if (typeof v !== 'string' || !(CONDITION_STATUSES as readonly string[]).includes(v)) {
    bad('status', `must be one of ${CONDITION_STATUSES.join(', ')}`);
  }
  return v as ConditionStatus;
}

export function parseConditionInput(body: unknown): PatientConditionInput {
  if (!isObject(body)) bad('body', 'must be a JSON object');
  if (typeof body.name !== 'string' || body.name.trim().length === 0) bad('name', 'must not be empty');
  const name = body.name.trim();
  if (name.length > 200) bad('name', 'must be at most 200 characters');

  let icd10Code: string | null = null;
  if (body.icd10Code !== undefined && body.icd10Code !== null) {
    const code = typeof body.icd10Code === 'string' ? body.icd10Code.trim().toUpperCase() : '';
    if (!ICD10_CODE_RE.test(code)) bad('icd10Code', 'must be an ICD-10 code such as K21.0');
    icd10Code = code;
  }

  let since: string | null = null;
  if (body.since !== undefined && body.since !== null) {
    if (
      typeof body.since !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.since) ||
      Number.isNaN(Date.parse(body.since))
    ) {
      bad('since', 'must be an ISO date (YYYY-MM-DD)');
    }
    since = body.since;
  }

  return { name, icd10Code, status: status(body.status), since };
}

export function parseConditionUpdate(body: unknown): PatientConditionUpdate {
  if (!isObject(body)) bad('body', 'must be a JSON object');
  return { status: status(body.status) };
}

/** Body of POST /patients/:id/allergies: one allergy name, 1–100 characters. */
export function parseAllergyInput(body: unknown): { name: string } {
  if (!isObject(body)) bad('body', 'must be a JSON object');
  if (typeof body.name !== 'string' || body.name.trim().length === 0) bad('name', 'must not be empty');
  const name = body.name.trim();
  if (name.length > 100) bad('name', 'must be at most 100 characters');
  return { name };
}
