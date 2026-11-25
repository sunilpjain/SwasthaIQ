import type { DraftStore } from './draft-store';

/**
 * Open consult drafts by patient, so switching tabs never loses typing. Cleared on Log out and
 * remote sign-out (the session's wipe step).
 */
const drafts = new Map<string, DraftStore>();

export function getDraft(patientId: string): DraftStore | undefined {
  return drafts.get(patientId);
}

export function keepDraft(patientId: string, store: DraftStore): void {
  drafts.set(patientId, store);
}

/** After signing: the next consult for this patient starts a new visit. */
export function forgetDraft(patientId: string): void {
  drafts.get(patientId)?.dispose();
  drafts.delete(patientId);
}

export function clearDrafts(): void {
  for (const d of drafts.values()) d.dispose();
  drafts.clear();
}
