import type { VisitDetail, VisitDraftInput } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { DraftStore, RETRY_MS, SAVE_DEBOUNCE_MS, saveStatusLine } from './draft-store';

class FakeTimers {
  private t = 0;
  private jobs: { at: number; fn: () => void; id: number }[] = [];
  private next = 1;
  set = (fn: () => void, ms: number) => {
    const id = this.next++;
    this.jobs.push({ at: this.t + ms, fn, id });
    return id;
  };
  clear = (id: unknown) => {
    this.jobs = this.jobs.filter((j) => j.id !== id);
  };
  async advance(ms: number) {
    this.t += ms;
    const due = this.jobs.filter((j) => j.at <= this.t);
    this.jobs = this.jobs.filter((j) => j.at > this.t);
    for (const j of due) j.fn();
    await flushPromises();
  }
  get pending() {
    return this.jobs.length;
  }
}

const flushPromises = () => new Promise<void>((r) => setImmediate(() => r()));

function setup(existing?: VisitDetail) {
  let clock = Date.parse('2026-11-24T05:00:00.000Z');
  const calls: { id: string; input: VisitDraftInput }[] = [];
  const api = {
    saveDraft: jest.fn(async (id: string, input: VisitDraftInput) => {
      calls.push({ id, input });
      return {} as VisitDetail;
    }),
  };
  const timers = new FakeTimers();
  const store = new DraftStore(
    api,
    { visitId: 'v1', patientId: 'p1', existing },
    () => new Date(clock),
    timers,
  );
  return {
    store,
    api,
    calls,
    timers,
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

describe('DraftStore', () => {
  it('autosaves once typing pauses, sending only the changed fields as Typed and confirmed', async () => {
    const t = setup();
    t.store.setField('complaint.chief_complaint', 'Pain');
    t.tick(500);
    t.store.setField('complaint.chief_complaint', 'Pain after meals');
    t.store.setField('vitals.pulse', '82');
    await t.timers.advance(SAVE_DEBOUNCE_MS - 1);
    expect(t.api.saveDraft).not.toHaveBeenCalled();
    await t.timers.advance(1);
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]).toEqual({
      id: 'v1',
      input: {
        patientId: 'p1',
        fields: [
          {
            section: 'complaint',
            key: 'chief_complaint',
            value: 'Pain after meals',
            source: 'typed',
            confirmed: true,
            clientUpdatedAt: '2026-11-24T05:00:00.500Z',
          },
          {
            section: 'vitals',
            key: 'pulse',
            value: '82',
            source: 'typed',
            confirmed: true,
            clientUpdatedAt: '2026-11-24T05:00:00.500Z',
          },
        ],
      },
    });
    expect(t.store.state).toMatchObject({ status: 'saved', unsaved: 0 });
    // Nothing changed since: no further saves.
    await t.store.flush();
    expect(t.calls).toHaveLength(1);
  });

  it('sends ordered tests and the follow-up date with their own timestamps', async () => {
    const t = setup();
    t.store.setInvestigations([{ testName: 'LFT', testCode: 'ALT' }]);
    t.store.setFollowUp('2026-12-08');
    await t.store.flush();
    expect(t.calls[0]!.input).toEqual({
      patientId: 'p1',
      investigations: [{ testName: 'LFT', testCode: 'ALT' }],
      investigationsClientUpdatedAt: '2026-11-24T05:00:00.000Z',
      followUp: '2026-12-08',
    });
  });

  it('sends the diagnosis list with its own timestamp (DIG-53)', async () => {
    const t = setup();
    const gerd = {
      kind: 'icd10' as const,
      icd10Code: 'K21.9',
      label: 'GERD',
      role: 'primary' as const,
      certainty: 'final' as const,
    };
    t.store.setDiagnoses([gerd]);
    await t.store.flush();
    expect(t.calls[0]!.input).toEqual({
      patientId: 'p1',
      diagnoses: [gerd],
      diagnosesClientUpdatedAt: '2026-11-24T05:00:00.000Z',
    });
    expect(t.store.state.unsaved).toBe(0);
  });

  it('keeps an edit made while a save is in flight, and saves it next', async () => {
    const t = setup();
    let release!: () => void;
    t.api.saveDraft.mockImplementationOnce(
      (id, input) =>
        new Promise((r) => {
          t.calls.push({ id, input });
          release = () => r({} as VisitDetail);
        }),
    );
    t.store.setField('plan.advice', 'Small meals');
    const first = t.store.flush();
    t.tick(1000);
    t.store.setField('plan.advice', 'Small meals; avoid late dinner');
    release();
    await first;
    // The newer edit was not part of the first save, so it is still waiting.
    expect(t.store.state.unsaved).toBe(1);
    await t.timers.advance(SAVE_DEBOUNCE_MS);
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1]!.input.fields?.[0]?.value).toBe('Small meals; avoid late dinner');
    expect(t.store.state.unsaved).toBe(0);
  });

  it('goes offline, keeps the edits and retries', async () => {
    const t = setup();
    t.api.saveDraft.mockRejectedValueOnce(new ApiError(0, 'network', 'offline'));
    t.store.setField('vitals.bp', '128/84');
    await t.store.flush();
    expect(t.store.state).toMatchObject({ status: 'offline', unsaved: 1 });
    expect(saveStatusLine(t.store.state, () => 'x')).toBe(
      'Offline · 1 change will save when you’re back online',
    );
    await t.timers.advance(RETRY_MS);
    expect(t.api.saveDraft).toHaveBeenCalledTimes(2);
    expect(t.store.state).toMatchObject({ status: 'saved', unsaved: 0 });
  });

  it('retries other errors too, and stops for good once the visit is signed', async () => {
    const t = setup();
    t.api.saveDraft.mockRejectedValueOnce(new ApiError(500, 'http_500', 'boom'));
    t.store.setField('vitals.bp', '128/84');
    await t.store.flush();
    expect(t.store.state.status).toBe('error');
    t.api.saveDraft.mockRejectedValueOnce(new ApiError(409, 'visit_signed', 'signed'));
    await t.timers.advance(RETRY_MS);
    expect(t.store.state.status).toBe('signed');
    t.store.setField('vitals.bp', '130/80');
    expect(t.store.value('vitals.bp')).toBe('128/84'); // read-only now
    expect(t.timers.pending).toBe(0);
  });

  it('opens an existing draft with its values, tests and follow-up', () => {
    const t = setup({
      fields: [{ section: 'vitals', key: 'pulse', value: '76', source: 'dictated', confirmed: false }],
      investigations: [{ testName: 'CBC', testCode: 'HB' }],
      diagnoses: [
        {
          kind: 'misc',
          icd10Code: null,
          label: 'Post-op review',
          role: 'primary',
          certainty: 'final',
          eye: null,
          diagnosedOn: '2026-11-24',
        },
      ],
      followUp: '2026-12-01',
      signedAt: null,
    } as unknown as VisitDetail);
    expect(t.store.value('vitals.pulse')).toBe('76');
    expect(t.store.state.fields['vitals.pulse']).toMatchObject({ source: 'dictated', confirmed: false });
    expect(t.store.state).toMatchObject({ followUp: '2026-12-01', status: 'saved', unsaved: 0 });
    expect(t.store.state.investigations).toHaveLength(1);
    expect(t.store.state.diagnoses[0]?.label).toBe('Post-op review');
  });

  it('describes the save state', () => {
    const t = setup();
    expect(saveStatusLine(t.store.state, () => '')).toBe('Changes save automatically');
    expect(
      saveStatusLine(
        { ...t.store.state, status: 'saved', lastSavedAt: '2026-11-24T05:15:00Z' },
        () => '10:45 am',
      ),
    ).toBe('Draft saved 10:45 am');
    expect(saveStatusLine({ ...t.store.state, status: 'saving' }, () => '')).toBe('Saving…');
  });
});
