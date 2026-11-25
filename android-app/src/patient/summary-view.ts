import type {
  ConditionStatus,
  LabValue,
  PatientDetail,
  PendingTest,
  PrescriptionSummary,
  RxLine,
  VisitSummary,
} from '@swasthyaiq/shared';
import { eyeLabel } from '../consult/eye-fields';

/** Pure helpers for the patient summary (DIG-48). Dates are ISO (YYYY-MM-DD), shown as "14 Aug". */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08-14" → "14 Aug"; with year → "14 Aug 2026". */
export function shortDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** Only the last 4 digits are shown on screen: "Phone ••••0001". */
export function maskPhone(phone: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `Phone ••••${digits.slice(-4)}` : null;
}

/** "You" for the signed-in doctor, otherwise "Dr. Saiyam" (first name is enough in this clinic). */
export function doctorLabel(doctorId: string, doctorName: string, myUserId: string | null): string {
  if (doctorId === myUserId) return 'You';
  const parts = doctorName.split(/\s+/);
  return parts[0]?.startsWith('Dr') && parts[1] ? `${parts[0]} ${parts[1]}` : doctorName;
}

/** "Shared: Dr. Samradnyee + Dr. Saiyam" when both doctors have seen the patient. */
export function sharedLabel(visits: VisitSummary[], myUserId: string | null): string | null {
  const doctors = new Map<string, string>();
  for (const v of visits) doctors.set(v.doctorId, v.doctorName);
  if (doctors.size < 2) return null;
  const names = [...doctors.entries()]
    .sort(([a], [b]) => (a === myUserId ? -1 : b === myUserId ? 1 : 0))
    .map(([id, name]) => doctorLabel(id, name, null));
  return `Shared: ${names.join(' + ')}`;
}

export const CONDITION_STATUS_LABEL: Record<ConditionStatus, string> = {
  active: 'Active',
  controlled: 'Controlled',
  resolved: 'Resolved',
};

const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * "Ursodeoxycholic acid 300 mg · 1-0-1"; eye drops get the eye, always as OD / OS / OU (DIG-52):
 * "Carboxymethylcellulose 0.5% OU · 1-1-1-1".
 */
export function medicineLine(l: RxLine): string {
  const eye = eyeLabel(l.eye);
  return `${capitalise(l.medicineGeneric)}${eye ? ` ${eye}` : ''} · ${l.frequency}`;
}

export interface MedicineRow {
  key: string;
  text: string;
  /** Who prescribed it: "You" or "Dr. Saiyam". */
  by: string;
}

/** Current medicines from both doctors, the signed-in doctor's first. */
export function currentMedicineRows(rx: PrescriptionSummary[], myUserId: string | null): MedicineRow[] {
  const ordered = [...rx].sort((a, b) => (a.doctorId === myUserId ? -1 : b.doctorId === myUserId ? 1 : 0));
  return ordered.flatMap((p) =>
    p.lines.map((l) => ({
      key: l.id,
      text: medicineLine(l),
      by: doctorLabel(p.doctorId, p.doctorName, myUserId),
    })),
  );
}

export function labText(l: LabValue): string {
  return `${l.testName} ${l.value}${l.unit ? ` ${l.unit}` : ''}`;
}

export function labFlag(l: LabValue): { label: string; tone: 'high' | 'low' | 'normal' } {
  if (l.flag === 'H') return { label: '▲ High', tone: 'high' };
  if (l.flag === 'L') return { label: '▼ Low', tone: 'low' };
  return { label: 'Normal', tone: 'normal' };
}

/** "OCT macula ordered 16 Oct — not done yet" / "Liver function tests ordered 23 Oct — not received". */
export function pendingText(p: PendingTest): string {
  return `${p.testName} ordered ${shortDate(p.visitDate)} — ${p.testCode ? 'not received' : 'not done yet'}`;
}

/** Last visit card lines: "14 Aug 2026 · You", the diagnosis, and the Rx from that visit if any. */
export function lastVisitLines(
  d: PatientDetail,
  myUserId: string | null,
): { meta: string; diagnosis: string; rx: string | null } | null {
  const v = d.lastVisit;
  if (!v) return null;
  const rx = d.lastRx && d.lastRx.visitId === v.id ? d.lastRx.lines.map(medicineLine).join('; ') : null;
  return {
    meta: `${shortDate(v.visitDate, true)} · ${doctorLabel(v.doctorId, v.doctorName, myUserId)}`,
    diagnosis: v.diagnosis ?? 'No diagnosis recorded',
    rx: rx ? `Rx: ${rx}` : null,
  };
}

/** Header status: "Appt 09:45 · checked in 09:37" (times already formatted by the queue helpers). */
export function visitStatusLine(appointment: string | null, checkIn: string | null): string | null {
  if (!appointment) return null;
  return `Appt ${appointment} · ${checkIn ? `checked in ${checkIn}` : 'not checked in'}`;
}
