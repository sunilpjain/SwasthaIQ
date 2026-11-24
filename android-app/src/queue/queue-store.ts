import type { QueueEntry } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';

/** Status changes show within 5 seconds (DIG-47): the queue is re-read this often while on screen. */
export const POLL_MS = 5_000;

export interface QueueState {
  entries: QueueEntry[];
  /** When the queue was last read from the server (ISO); null before the first load. */
  lastSyncedAt: string | null;
  online: boolean;
  /** True only for the first load (skeleton rows) and pull-to-refresh (spinner). */
  loading: boolean;
  refreshing: boolean;
  /** Short error code for anything other than being offline; the screen shows a generic message. */
  error: string | null;
}

type QueueApi = { queue(): Promise<QueueEntry[]> };

/**
 * Today's queue for the Queue tab. Keeps the last good copy when offline. Only one read runs at
 * a time, so a slow network never stacks up polls.
 */
export class QueueStore {
  private current: QueueState = {
    entries: [],
    lastSyncedAt: null,
    online: true,
    loading: true,
    refreshing: false,
    error: null,
  };
  private listeners = new Set<(s: QueueState) => void>();
  private inFlight: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly api: QueueApi,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get state(): QueueState {
    return this.current;
  }

  subscribe(listener: (s: QueueState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** `pull` shows the pull-to-refresh spinner. */
  refresh(pull = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (pull) this.set({ refreshing: true });
    this.inFlight = this.load().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Replace one row straight away (e.g. after opening a patient), before the next poll. */
  upsert(entry: QueueEntry): void {
    this.set({ entries: this.current.entries.map((e) => (e.patient.id === entry.patient.id ? entry : e)) });
  }

  startPolling(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), POLL_MS);
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async load(): Promise<void> {
    try {
      const entries = await this.api.queue();
      this.set({
        entries,
        lastSyncedAt: this.now().toISOString(),
        online: true,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'network') {
        this.set({ online: false, loading: false, refreshing: false });
      } else {
        // Signed out mid-poll, server error…: keep the last copy; the session handles 401s.
        this.set({ loading: false, refreshing: false, error: e instanceof ApiError ? e.code : 'unknown' });
      }
    }
  }

  private set(patch: Partial<QueueState>): void {
    this.current = { ...this.current, ...patch };
    for (const l of this.listeners) l(this.current);
  }
}
