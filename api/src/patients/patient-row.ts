import { NotFoundException } from '@nestjs/common';
import type { Patient } from '@swasthyaiq/shared';
import { sql } from 'kysely';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function assertUuid(id: string, what: string): void {
  if (!isUuid(id)) throw new NotFoundException({ code: 'not_found', message: `${what} not found` });
}

export interface PatientRow {
  id: string;
  token: string;
  full_name: string;
  age_years: number;
  sex: 'M' | 'F';
  guardian_name: string | null;
  phone: string | null;
  primary_doctor_id: string;
  allergies: string[];
  conditions: string[];
}

export function toPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    token: r.token,
    fullName: r.full_name,
    ageYears: r.age_years,
    sex: r.sex,
    guardianName: r.guardian_name,
    phone: r.phone,
    primaryDoctorId: r.primary_doctor_id,
    allergies: r.allergies,
    conditions: r.conditions,
  };
}

/** Names of the patient's conditions that are not resolved, oldest first. */
const openConditions = sql<string[]>`coalesce((
  SELECT array_agg(c.name ORDER BY c.created_at, c.name)
  FROM patient_conditions c
  WHERE c.patient_id = patients.id AND c.status <> 'resolved'
), '{}')`.as('conditions');

export const PATIENT_COLS = [
  'patients.id',
  'patients.token',
  'patients.full_name',
  'patients.age_years',
  'patients.sex',
  'patients.guardian_name',
  'patients.phone',
  'patients.primary_doctor_id',
  'patients.allergies',
  openConditions,
] as const;
