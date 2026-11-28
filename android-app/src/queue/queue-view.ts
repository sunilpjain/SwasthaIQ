import type { QueueEntry, QueueStatus } from '@swasthyaiq/shared';

/**
 * Pure helpers for the queue screen (DIG-47): filtering, search, times and row labels.
 * The clinic is in Surat, so times are shown in IST whatever the phone's time zone is.
 */

import { IST_OFFSET_MS } from '@swasthyaiq/shared';
export { IST_OFFSET_MS };

/** "9:30 am" / "12:15 pm" in IST from an ISO timestamp (12-hour, as the clinic says it). */
export function istTime(iso: string): string {
  const d = new Date(Date.parse(iso) + IST_OFFSET_MS);
  const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 21 Nov" in IST. */
export function istDayLabel(now: Date): string {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export type QueueFilter = 'mine' | 'all';

export function counts(entries: QueueEntry[]): { mine: number; all: number } {
  return { mine: entries.filter((e) => e.isMine).length, all: entries.length };
}

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Name (any part, case-insensitive) or phone (digits, so "10001" finds "90000 10001").
 * Searching always looks across the whole queue, not just the doctor's own patients.
 */
export function matches(entry: QueueEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (entry.patient.fullName.toLowerCase().includes(q)) return true;
  const qd = digits(q);
  return qd.length >= 3 && digits(entry.patient.phone ?? '').includes(qd);
}

export function visibleEntries(entries: QueueEntry[], filter: QueueFilter, query: string): QueueEntry[] {
  if (query.trim()) return entries.filter((e) => matches(e, query));
  return filter === 'mine' ? entries.filter((e) => e.isMine) : entries;
}

export const STATUS_LABEL: Record<QueueStatus, string> = {
  not_arrived: 'Not arrived',
  waiting: 'Waiting',
  in_consult: 'In consult',
  done: 'Done',
};

export interface RowModel {
  key: string;
  appointment: string;
  title: string;
  reason: string;
  status: QueueStatus;
  statusLabel: string;
  checkIn: string;
  /** "With you", "With Dr. Saiyam Shah", or the booked doctor in the All view. */
  tag: string | null;
  tagTone: 'mine' | 'other' | 'neutral';
  highlighted: boolean;
  accessibilityLabel: string;
}

/** "<1 min", "18 min", "1 h 5 min": how long since check-in, from the phone's own clock. */
export function waitDuration(checkedInAt: string, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - Date.parse(checkedInAt)) / 60_000));
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/**
 * `now` drives the wait time for Waiting patients ("Waiting 18 min · in at 9:52 am"). It is
 * worked out on the phone, so it stays right between server refreshes and while offline.
 */
export function rowModel(
  e: QueueEntry,
  myUserId: string | null,
  filter: QueueFilter,
  now = new Date(),
): RowModel {
  const p = e.patient;
  const withMe = e.status === 'in_consult' && e.inConsultWithUserId === myUserId;
  const withOther = e.status === 'in_consult' && !withMe;
  const tag = withMe
    ? 'With you'
    : withOther
      ? `With ${e.inConsultWithName ?? 'another doctor'}`
      : filter === 'all' && !e.isMine
        ? e.doctorName
        : null;
  const appointment = istTime(e.appointmentAt);
  const waiting = e.status === 'waiting' && e.checkedInAt !== null;
  const statusLabel = waiting ? `Waiting ${waitDuration(e.checkedInAt!, now)}` : STATUS_LABEL[e.status];
  const checkIn = e.checkedInAt
    ? waiting
      ? `in at ${istTime(e.checkedInAt)}`
      : `Checked in ${istTime(e.checkedInAt)}`
    : 'Not checked in';
  const title = `${p.fullName} · ${p.ageYears} ${p.sex}`;
  return {
    key: p.id,
    appointment,
    title,
    reason: e.reason,
    status: e.status,
    statusLabel,
    checkIn,
    tag,
    tagTone: withMe ? 'mine' : withOther ? 'other' : 'neutral',
    highlighted: withMe,
    accessibilityLabel: [`${appointment} appointment`, title, e.reason, statusLabel, checkIn, tag]
      .filter(Boolean)
      .join(', '),
  };
}

/** "Online · synced 10:42 · pull down to refresh" / "Offline · showing the queue from 10:42". */
export function syncLine(online: boolean, lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return online ? 'Loading today’s queue…' : 'Offline · the queue has not loaded yet';
  const t = istTime(lastSyncedAt);
  return online ? `Online · synced ${t} · pull down to refresh` : `Offline · showing the queue from ${t}`;
}

/** What tapping a row does: own patients who aren't Done open a consult; everything else opens the summary. */
export function tapAction(e: QueueEntry): 'view' | 'open' {
  // Done patients are only viewed; the other doctor's patients are view-only (DIG-96).
  return e.status === 'done' || !e.isMine ? 'view' : 'open';
}
