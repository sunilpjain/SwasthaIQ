import type {
  CaptureSource,
  Diagnosis,
  InvestigationOrder,
  VisitDetail,
  VisitDraftInput,
} from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { splitKey } from './consult-fields';

/**
 * One consult draft on the phone (DIG-50). Edits autosave shortly after typing stops: only the
 * changed fields are sent, each with the device time of its edit, so the server keeps the newest
 * edit even if saves arrive out of order (DIG-41). Unsaved edits stay in memory and are retried;
 * keeping them across an app restart is DIG-44 (encrypted offline drafts).
 */

export const SAVE_DEBOUNCE_MS = 1_500;
export const RETRY_MS = 10_000;

export interface DraftField {
  value: string;
  source: CaptureSource;
  confirmed: boolean;
  /** Device time of the last edit (ISO). */
  updatedAt: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'signed';

export interface DraftState {
  visitId: string;
  patientId: string;
  fields: Record<string, DraftField>;
  investigations: InvestigationOrder[];
  /** Diagnoses with their tags (DIG-53); at least one is needed to sign. */
  diagnoses: Diagnosis[];
  followUp: string | null;
  status: SaveStatus;
  lastSavedAt: string | null;
  /** Number of edits not yet saved. */
  unsaved: number;
}

type DraftApi = { saveDraft(visitId: string, input: VisitDraftInput): Promise<VisitDetail> };

interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class DraftStore {
  private current: DraftState;
  private listeners = new Set<(s: DraftState) => void>();
  private dirtyFields = new Set<string>();
  private investigationsAt: string | null = null;
  private diagnosesAt: string | null = null;
  private followUpDirty = false;
  private timer: unknown = null;
  private saving: Promise<void> | null = null;
  private again = false;

  constructor(
    private readonly api: DraftApi,
    init: { visitId: string; patientId: string; existing?: VisitDetail },
    private readonly now: () => Date = () => new Date(),
    private readonly timers: Timers = realTimers,
  ) {
    const fields: Record<string, DraftField> = {};
    for (const f of init.existing?.fields ?? []) {
      fields[`${f.section}.${f.key}`] = {
        value: f.value,
        source: f.source,
        confirmed: f.confirmed,
        updatedAt: init.existing?.signedAt ?? '1970-01-01T00:00:00.000Z',
      };
    }
    this.current = {
      visitId: init.visitId,
      patientId: init.patientId,
      fields,
      investigations: init.existing?.investigations ?? [],
      diagnoses: init.existing?.diagnoses ?? [],
      followUp: init.existing?.followUp ?? null,
      status: init.existing ? 'saved' : 'idle',
      lastSavedAt: null,
      unsaved: 0,
    };
  }

  get state(): DraftState {
    return this.current;
  }

  subscribe(listener: (s: DraftState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  value(key: string): string {
    return this.current.fields[key]?.value ?? '';
  }

  /** A typed edit: source Typed, confirmed (the doctor wrote it). */
  setField(key: string, value: string): void {
    if (this.current.status === 'signed') return;
    this.dirtyFields.add(key);
    this.set({
      fields: {
        ...this.current.fields,
        [key]: { value, source: 'typed', confirmed: true, updatedAt: this.now().toISOString() },
      },
    });
    this.schedule();
  }

  setInvestigations(list: InvestigationOrder[]): void {
    if (this.current.status === 'signed') return;
    this.investigationsAt = this.now().toISOString();
    this.set({ investigations: list });
    this.schedule();
  }

  setDiagnoses(list: Diagnosis[]): void {
    if (this.current.status === 'signed') return;
    this.diagnosesAt = this.now().toISOString();
    this.set({ diagnoses: list });
    this.schedule();
  }

  setFollowUp(date: string | null): void {
    if (this.current.status === 'signed') return;
    this.followUpDirty = true;
    this.set({ followUp: date });
    this.schedule();
  }

  /** After a successful sign: read-only from now on, nothing more is saved. */
  markSigned(): void {
    if (this.timer) this.timers.clear(this.timer);
    this.timer = null;
    this.set({ status: 'signed' });
  }

  /** "Save draft" button, leaving the screen, or the app going to the background. */
  flush(): Promise<void> {
    if (this.timer) this.timers.clear(this.timer);
    this.timer = null;
    return this.save();
  }

  dispose(): void {
    if (this.timer) this.timers.clear(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  private schedule(delay = SAVE_DEBOUNCE_MS): void {
    if (this.timer) this.timers.clear(this.timer);
    this.timer = this.timers.set(() => {
      this.timer = null;
      void this.save();
    }, delay);
  }

  private pendingCount(): number {
    return (
      this.dirtyFields.size +
      (this.investigationsAt ? 1 : 0) +
      (this.diagnosesAt ? 1 : 0) +
      (this.followUpDirty ? 1 : 0)
    );
  }

  private save(): Promise<void> {
    if (this.saving) {
      this.again = true;
      return this.saving;
    }
    if (this.pendingCount() === 0 || this.current.status === 'signed') return Promise.resolve();
    this.saving = this.send().finally(() => {
      this.saving = null;
      if (this.again) {
        this.again = false;
        if (this.pendingCount() > 0) void this.save();
      }
    });
    return this.saving;
  }

  private async send(): Promise<void> {
    // Snapshot what is being sent; edits made while the request is in flight stay dirty.
    const sent = [...this.dirtyFields].map((k) => [k, this.current.fields[k]!] as const);
    const investigationsAt = this.investigationsAt;
    const investigations = this.current.investigations;
    const diagnosesAt = this.diagnosesAt;
    const diagnoses = this.current.diagnoses;
    const followUpDirty = this.followUpDirty;
    const followUp = this.current.followUp;

    const input: VisitDraftInput = { patientId: this.current.patientId };
    if (sent.length) {
      input.fields = sent.map(([k, f]) => ({
        ...splitKey(k),
        value: f.value,
        source: f.source,
        confirmed: f.confirmed,
        clientUpdatedAt: f.updatedAt,
      }));
    }
    if (investigationsAt) {
      input.investigations = investigations;
      input.investigationsClientUpdatedAt = investigationsAt;
    }
    if (diagnosesAt) {
      input.diagnoses = diagnoses;
      input.diagnosesClientUpdatedAt = diagnosesAt;
    }
    if (followUpDirty) input.followUp = followUp;

    this.set({ status: 'saving', unsaved: this.pendingCount() });
    try {
      await this.api.saveDraft(this.current.visitId, input);
      for (const [k, f] of sent) {
        if (this.current.fields[k]?.updatedAt === f.updatedAt) this.dirtyFields.delete(k);
      }
      if (this.investigationsAt === investigationsAt) this.investigationsAt = null;
      if (this.diagnosesAt === diagnosesAt) this.diagnosesAt = null;
      if (followUpDirty && this.current.followUp === followUp) this.followUpDirty = false;
      this.set({ status: 'saved', lastSavedAt: this.now().toISOString(), unsaved: this.pendingCount() });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'visit_signed') {
        this.set({ status: 'signed', unsaved: this.pendingCount() });
        return;
      }
      const offline = e instanceof ApiError && e.code === 'network';
      this.set({ status: offline ? 'offline' : 'error', unsaved: this.pendingCount() });
      this.schedule(RETRY_MS);
    }
  }

  private set(patch: Partial<DraftState>): void {
    this.current = { ...this.current, ...patch };
    for (const l of this.listeners) l(this.current);
  }
}

/** "Draft saved 10:45 am", "Saving…", "Offline · 3 changes will save when you’re back online". */
export function saveStatusLine(s: DraftState, time: (iso: string) => string): string {
  switch (s.status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return s.lastSavedAt ? `Draft saved ${time(s.lastSavedAt)}` : 'Draft saved';
    case 'offline':
      return `Offline · ${s.unsaved} change${s.unsaved === 1 ? '' : 's'} will save when you’re back online`;
    case 'error':
      return 'Not saved yet · retrying';
    case 'signed':
      return 'This visit is signed and read-only';
    default:
      return 'Changes save automatically';
  }
}
