import type { QueueEntry } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { POLL_MS, QueueStore } from './queue-store';

const e = (id: string, status: QueueEntry['status'] = 'waiting') =>
  ({ patient: { id }, status }) as unknown as QueueEntry;

function setup() {
  const api = { queue: jest.fn<Promise<QueueEntry[]>, []>(async () => [e('a'), e('b')]) };
  const store = new QueueStore(api, () => new Date('2026-11-24T05:12:00Z'));
  return { api, store };
}

describe('QueueStore', () => {
  afterEach(() => jest.useRealTimers());

  it('loads the queue and records when it synced', async () => {
    const { store } = setup();
    expect(store.state.loading).toBe(true);
    await store.refresh();
    expect(store.state).toMatchObject({
      loading: false,
      online: true,
      lastSyncedAt: '2026-11-24T05:12:00.000Z',
      error: null,
    });
    expect(store.state.entries).toHaveLength(2);
  });

  it('keeps the last copy and goes offline when the network drops', async () => {
    const { api, store } = setup();
    await store.refresh();
    api.queue.mockRejectedValueOnce(new ApiError(0, 'network', 'offline'));
    await store.refresh(true);
    expect(store.state).toMatchObject({ online: false, refreshing: false });
    expect(store.state.entries).toHaveLength(2);
    await store.refresh();
    expect(store.state.online).toBe(true);
  });

  it('keeps the last copy on other errors and reports a code', async () => {
    const { api, store } = setup();
    await store.refresh();
    api.queue.mockRejectedValueOnce(new ApiError(500, 'http_500', 'boom'));
    await store.refresh();
    expect(store.state).toMatchObject({ error: 'http_500', online: true });
    expect(store.state.entries).toHaveLength(2);
  });

  it('runs one read at a time', async () => {
    const { api, store } = setup();
    let release!: (v: QueueEntry[]) => void;
    api.queue.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const a = store.refresh();
    const b = store.refresh(true);
    release([e('a')]);
    await Promise.all([a, b]);
    expect(api.queue).toHaveBeenCalledTimes(1);
  });

  it('polls every 5 seconds until stopped', async () => {
    jest.useFakeTimers();
    const { api, store } = setup();
    store.startPolling();
    store.startPolling(); // a second start does not double the polling
    await Promise.resolve();
    expect(api.queue).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(POLL_MS);
    expect(api.queue).toHaveBeenCalledTimes(2);
    store.stopPolling();
    await jest.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(api.queue).toHaveBeenCalledTimes(2);
  });

  it('updates one row straight away after opening a patient', async () => {
    const { store } = setup();
    await store.refresh();
    store.upsert(e('b', 'in_consult'));
    expect(store.state.entries.map((x) => x.status)).toEqual(['waiting', 'in_consult']);
  });
});
