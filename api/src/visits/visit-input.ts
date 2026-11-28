import { BadRequestException } from '@nestjs/common';
import {
  CAPTURE_SOURCES,
  DIAGNOSIS_CERTAINTIES,
  DIAGNOSIS_KINDS,
  DIAGNOSIS_ROLES,
  EYE_SIDES,
  EYES,
  ICD10_CODE_RE,
  LANGUAGES,
  MEDICINE_ROUTES,
  type CaptureSource,
  type ConsultFieldInput,
  type Diagnosis,
  type InvestigationOrder,
  type RxLineInput,
  type VisitAmendmentInput,
  type VisitDraftInput,
} from '@swasthyaiq/shared';

/**
 * Hand-written checks for the visit write bodies. Error messages name the bad path only,
 * never the submitted value (it may be clinical text).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITS = {
  fields: 300,
  valueChars: 10_000,
  diagnoses: 20,
  labelChars: 300,
  reasonChars: 500,
  investigations: 30,
  testNameChars: 120,
  rxLines: 30,
  rxTextChars: 200,
  rxInstructionChars: 500,
} as const;

const MEDICINE_ID_RE = /^[a-z0-9-]{1,64}$/;

const TEST_CODE_RE = /^[A-Z0-9_]{1,20}$/;

function bad(path: string, problem: string): never {
  throw new BadRequestException({ code: 'invalid_body', message: `${path} ${problem}` });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Record<string, unknown>, k: string, path: string, max: number, allowEmpty = false): string {
  const v = o[k];
  if (typeof v !== 'string') bad(`${path}.${k}`, 'must be a string');
  if (!allowEmpty && v.trim().length === 0) bad(`${path}.${k}`, 'must not be empty');
  if (v.length > max) bad(`${path}.${k}`, `must be at most ${max} characters`);
  return v;
}

function name(o: Record<string, unknown>, k: string, path: string): string {
  const v = o[k];
  if (typeof v !== 'string' || !NAME_RE.test(v)) bad(`${path}.${k}`, 'must be snake_case, 1–64 characters');
  return v;
}

function bool(o: Record<string, unknown>, k: string, path: string): boolean {
  const v = o[k];
  if (typeof v !== 'boolean') bad(`${path}.${k}`, 'must be true or false');
  return v;
}

function timestamp(v: unknown, path: string): string {
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v)) || !/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    bad(path, 'must be an ISO 8601 date-time');
  }
  return v;
}

function isoDate(v: unknown, path: string): string {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v) || Number.isNaN(Date.parse(v))) {
    bad(path, 'must be an ISO date (YYYY-MM-DD)');
  }
  return v;
}

function array(v: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(v)) bad(path, 'must be an array');
  if (v.length > max) bad(path, `must have at most ${max} items`);
  return v;
}

function source(o: Record<string, unknown>, path: string): CaptureSource {
  const v = o.source;
  if (typeof v !== 'string' || !(CAPTURE_SOURCES as readonly string[]).includes(v)) {
    bad(`${path}.source`, `must be one of ${CAPTURE_SOURCES.join(', ')}`);
  }
  return v as CaptureSource;
}

function noDuplicateKeys(fields: { section: string; key: string }[], path: string): void {
  const seen = new Set<string>();
  for (const f of fields) {
    const k = `${f.section}.${f.key}`;
    if (seen.has(k)) bad(path, `has ${k} more than once`);
    seen.add(k);
  }
}

function amendField(v: unknown, path: string): Omit<ConsultFieldInput, 'clientUpdatedAt'> {
  if (!isObject(v)) bad(path, 'must be an object');
  return {
    section: name(v, 'section', path),
    key: name(v, 'key', path),
    value: str(v, 'value', path, LIMITS.valueChars, true),
    source: source(v, path),
    confirmed: bool(v, 'confirmed', path),
  };
}

function draftField(v: unknown, path: string): ConsultFieldInput {
  const base = amendField(v, path);
  return {
    ...base,
    clientUpdatedAt: timestamp((v as Record<string, unknown>).clientUpdatedAt, `${path}.clientUpdatedAt`),
  };
}

function oneOf<T extends string>(
  o: Record<string, unknown>,
  k: string,
  path: string,
  options: readonly T[],
): T | undefined {
  const v = o[k];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || !(options as readonly string[]).includes(v)) {
    bad(`${path}.${k}`, `must be one of ${options.join(', ')}`);
  }
  return v as T;
}

export function parseDiagnoses(v: unknown, path: string): Diagnosis[] {
  return array(v, path, LIMITS.diagnoses).map((d, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(d)) bad(p, 'must be an object');
    const kind = d.kind;
    if (typeof kind !== 'string' || !(DIAGNOSIS_KINDS as readonly string[]).includes(kind)) {
      bad(`${p}.kind`, `must be one of ${DIAGNOSIS_KINDS.join(', ')}`);
    }
    const label = str(d, 'label', p, LIMITS.labelChars).trim();
    // Tags (DIG-53), with the defaults the API stores when they are left out.
    const tags = {
      role: oneOf(d, 'role', p, DIAGNOSIS_ROLES) ?? (i === 0 ? 'primary' : 'comorbidity'),
      certainty: oneOf(d, 'certainty', p, DIAGNOSIS_CERTAINTIES) ?? 'final',
      eye: oneOf(d, 'eye', p, EYE_SIDES) ?? null,
      diagnosedOn:
        d.diagnosedOn === undefined || d.diagnosedOn === null
          ? null
          : isoDate(d.diagnosedOn, `${p}.diagnosedOn`),
    } as const;
    if (kind === 'misc') {
      if (d.icd10Code !== undefined && d.icd10Code !== null) bad(`${p}.icd10Code`, 'must be null for misc');
      return { kind: 'misc', icd10Code: null, label, ...tags };
    }
    const code = typeof d.icd10Code === 'string' ? d.icd10Code.trim().toUpperCase() : '';
    if (!ICD10_CODE_RE.test(code)) bad(`${p}.icd10Code`, 'must be an ICD-10 code such as K21.9');
    return { kind: 'icd10', icd10Code: code, label, ...tags };
  });
}

export function parseInvestigations(v: unknown, path: string): InvestigationOrder[] {
  return array(v, path, LIMITS.investigations).map((o, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(o)) bad(p, 'must be an object');
    const testName = str(o, 'testName', p, LIMITS.testNameChars).trim();
    if (o.testCode === undefined || o.testCode === null) return { testName, testCode: null };
    const code = typeof o.testCode === 'string' ? o.testCode.trim().toUpperCase() : '';
    if (!TEST_CODE_RE.test(code)) bad(`${p}.testCode`, 'must be a lab test code such as ALT or HBA1C');
    return { testName, testCode: code };
  });
}

/** Optional text: null or a string up to `max` characters; blank becomes null. */
function optText(o: Record<string, unknown>, k: string, path: string, max: number): string | null {
  if (o[k] === undefined || o[k] === null) return null;
  return str(o, k, path, max, true).trim() || null;
}

/** The prescription (DIG-70). Eye is checked at sign time (DIG-71), so a draft may lack it. */
export function parseRxLines(v: unknown, path: string): RxLineInput[] {
  const lines = array(v, path, LIMITS.rxLines).map((l, i): RxLineInput => {
    const p = `${path}[${i}]`;
    if (!isObject(l)) bad(p, 'must be an object');
    if (typeof l.id !== 'string' || !UUID_RE.test(l.id)) bad(`${p}.id`, 'must be a UUID');
    let medicineId: string | null = null;
    if (l.medicineId !== undefined && l.medicineId !== null) {
      if (typeof l.medicineId !== 'string' || !MEDICINE_ID_RE.test(l.medicineId)) {
        bad(`${p}.medicineId`, 'must be a catalogue id');
      }
      medicineId = l.medicineId;
    }
    const language = oneOf(l, 'instructionsLanguage', p, LANGUAGES) ?? null;
    if (language === 'en') bad(`${p}.instructionsLanguage`, 'must be mr, hi or gu');
    const instructionsLocal = optText(l, 'instructionsLocal', p, LIMITS.rxInstructionChars);
    if (instructionsLocal && !language) bad(`${p}.instructionsLanguage`, 'is needed with instructionsLocal');
    return {
      id: l.id.toLowerCase(),
      medicineId,
      route: oneOf(l, 'route', p, MEDICINE_ROUTES) ?? null,
      medicineGeneric: str(l, 'medicineGeneric', p, LIMITS.rxTextChars).trim(),
      form: str(l, 'form', p, LIMITS.rxTextChars).trim(),
      eye: oneOf(l, 'eye', p, EYES) ?? null,
      dose: str(l, 'dose', p, LIMITS.rxTextChars, true).trim(),
      frequency: str(l, 'frequency', p, LIMITS.rxTextChars, true).trim(),
      timing: optText(l, 'timing', p, LIMITS.rxTextChars),
      duration: str(l, 'duration', p, LIMITS.rxTextChars, true).trim(),
      taper: optText(l, 'taper', p, LIMITS.rxInstructionChars),
      instructionsEn: optText(l, 'instructionsEn', p, LIMITS.rxInstructionChars),
      instructionsLocal,
      instructionsLanguage: instructionsLocal ? (language as Exclude<typeof language, 'en'>) : null,
    };
  });
  const ids = new Set(lines.map((l) => l.id));
  if (ids.size !== lines.length) bad(path, 'has a line id more than once');
  return lines;
}

export function parseDraft(body: unknown): VisitDraftInput {
  if (!isObject(body)) bad('body', 'must be a JSON object');
  if (typeof body.patientId !== 'string' || !UUID_RE.test(body.patientId)) bad('patientId', 'must be a UUID');
  const out: VisitDraftInput = { patientId: body.patientId };

  if (body.fields !== undefined) {
    out.fields = array(body.fields, 'fields', LIMITS.fields).map((f, i) => draftField(f, `fields[${i}]`));
    noDuplicateKeys(out.fields, 'fields');
  }
  if (body.diagnoses !== undefined) {
    out.diagnoses = parseDiagnoses(body.diagnoses, 'diagnoses');
    out.diagnosesClientUpdatedAt = timestamp(body.diagnosesClientUpdatedAt, 'diagnosesClientUpdatedAt');
  } else if (body.diagnosesClientUpdatedAt !== undefined) {
    bad('diagnosesClientUpdatedAt', 'is only allowed with diagnoses');
  }
  if (body.investigations !== undefined) {
    out.investigations = parseInvestigations(body.investigations, 'investigations');
    out.investigationsClientUpdatedAt = timestamp(
      body.investigationsClientUpdatedAt,
      'investigationsClientUpdatedAt',
    );
  } else if (body.investigationsClientUpdatedAt !== undefined) {
    bad('investigationsClientUpdatedAt', 'is only allowed with investigations');
  }
  if (body.rxLines !== undefined) {
    out.rxLines = parseRxLines(body.rxLines, 'rxLines');
    out.rxClientUpdatedAt = timestamp(body.rxClientUpdatedAt, 'rxClientUpdatedAt');
  } else if (body.rxClientUpdatedAt !== undefined) {
    bad('rxClientUpdatedAt', 'is only allowed with rxLines');
  }
  if (body.followUp !== undefined) {
    out.followUp = body.followUp === null ? null : isoDate(body.followUp, 'followUp');
  }
  return out;
}

export function parseAmendment(body: unknown): VisitAmendmentInput {
  if (!isObject(body)) bad('body', 'must be a JSON object');
  if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) bad('id', 'must be a UUID');
  const out: VisitAmendmentInput = { id: body.id };
  // DIG-97: the reason may be left out; the service decides whether one is needed.
  if (body.reason !== undefined) out.reason = str(body, 'reason', 'body', LIMITS.reasonChars).trim();
  if (body.fields !== undefined) {
    out.fields = array(body.fields, 'fields', LIMITS.fields).map((f, i) => {
      const field = amendField(f, `fields[${i}]`);
      if (!field.confirmed) bad(`fields[${i}].confirmed`, 'must be true; an amendment is final');
      return field;
    });
    noDuplicateKeys(out.fields, 'fields');
  }
  if (body.diagnoses !== undefined) {
    out.diagnoses = parseDiagnoses(body.diagnoses, 'diagnoses');
    if (out.diagnoses.length === 0) bad('diagnoses', 'must not be empty; a signed visit keeps at least one');
  }
  if (body.investigations !== undefined) {
    out.investigations = parseInvestigations(body.investigations, 'investigations');
  }
  if (body.followUp !== undefined) {
    out.followUp = body.followUp === null ? null : isoDate(body.followUp, 'followUp');
  }
  if (body.rxLines !== undefined) out.rxLines = parseRxLines(body.rxLines, 'rxLines');
  if (
    !out.fields?.length &&
    !out.diagnoses &&
    !out.investigations &&
    !out.rxLines &&
    out.followUp === undefined
  ) {
    bad('body', 'must change at least one field, the diagnoses, the tests, the Rx or the follow-up');
  }
  return out;
}
