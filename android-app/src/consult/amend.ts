import type { VisitSummary } from '@swasthyaiq/shared';
import { IST_OFFSET_MS } from '../queue/queue-view';

/**
 * DIG-97: a signed visit can be edited; each edit is saved as a new version (an amendment).
 * On the day it was signed (IST) no reason is needed; from the next day the doctor gives one.
 * The API makes the same check and is the one that counts.
 */
const istDay = (iso: string) => new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 10);

export function isSameDayEdit(signedAt: string | null, now: Date): boolean {
  return signedAt !== null && istDay(signedAt) === istDay(now.toISOString());
}

/** Only the doctor who signed it edits a visit; the other doctor reads only. */
export function canEdit(v: Pick<VisitSummary, 'status' | 'doctorId'>, myUserId: string | null): boolean {
  return v.status === 'signed' && v.doctorId === myUserId;
}

/** "v2 · edited 4:15 pm" (today) or "v2 · edited 28 Nov"; null for an unedited visit. */
export function versionTag(
  v: Pick<VisitSummary, 'version' | 'editedAt'>,
  now: Date,
  time: (iso: string) => string,
): string | null {
  if (v.version < 2 || !v.editedAt) return null;
  if (istDay(v.editedAt) === istDay(now.toISOString())) return `v${v.version} · edited ${time(v.editedAt)}`;
  const d = new Date(Date.parse(v.editedAt) + IST_OFFSET_MS);
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `v${v.version} · edited ${d.getUTCDate()} ${month}`;
}
