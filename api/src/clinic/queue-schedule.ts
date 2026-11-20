/**
 * Fictitious appointment and check-in times for today's queue (DIG-39). Synthetic, regenerated
 * by every reset (button or the 2 am job), so the queue always looks like "today".
 *
 * Per doctor, patients are booked every 15 minutes from 09:30 IST in token order. Everyone checks
 * in a few minutes early except each doctor's last appointment, who is "Not arrived", so the app
 * always has every status to show.
 */
export const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+05:30, no daylight saving
const FIRST_SLOT_MIN = 9 * 60 + 30;
const SLOT_MIN = 15;
const EARLY_MIN = [8, 10, 5, 12, 6, 9, 7, 11];
const MIN_MS = 60 * 1000;

export interface QueueSlot {
  patientId: string;
  appointmentAt: Date;
  checkedInAt: Date | null;
}

export interface QueuePatient {
  id: string;
  token: string;
  doctorId: string;
}

/** Midnight IST of the IST calendar day that contains `now`, as a UTC instant. */
export function istMidnight(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}

export function dailySchedule(patients: QueuePatient[], now: Date): QueueSlot[] {
  const day = istMidnight(now).getTime();
  const byDoctor = new Map<string, QueuePatient[]>();
  for (const p of patients) byDoctor.set(p.doctorId, [...(byDoctor.get(p.doctorId) ?? []), p]);

  const slots: QueueSlot[] = [];
  for (const list of byDoctor.values()) {
    const sorted = [...list].sort((a, b) => a.token.localeCompare(b.token, 'en', { numeric: true }));
    sorted.forEach((p, i) => {
      const appointmentAt = new Date(day + (FIRST_SLOT_MIN + i * SLOT_MIN) * MIN_MS);
      const arrived = i < sorted.length - 1;
      const early = EARLY_MIN[i % EARLY_MIN.length] ?? 5;
      slots.push({
        patientId: p.id,
        appointmentAt,
        checkedInAt: arrived ? new Date(appointmentAt.getTime() - early * MIN_MS) : null,
      });
    });
  }
  return slots;
}

/** Milliseconds from `now` until the next `hour`:00 IST (strictly in the future). */
export function msUntilNextIst(hour: number, now: Date): number {
  let next = istMidnight(now).getTime() + hour * 60 * MIN_MS;
  if (next <= now.getTime()) next += 24 * 60 * MIN_MS;
  return next - now.getTime();
}
