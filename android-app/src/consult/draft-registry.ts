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

export function clearDrafts(): void {
  for (const d of drafts.values()) d.dispose();
  drafts.clear();
}
