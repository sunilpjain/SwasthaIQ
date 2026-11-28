import type {
  AllergyList,
  DiagnosisFavourite,
  HealthResponse,
  Patient,
  PatientCondition,
  PatientConditionInput,
  PatientConditionUpdate,
  QueueResetResult,
  PatientDetail,
  QueueEntry,
  UserSummary,
  VisitDetail,
  MedicineCatalogue,
  MedicineFavourite,
  PrintCopyInput,
  SignInput,
  SummaryDocument,
  VisitAmendmentInput,
  VisitDraftInput,
} from '@swasthyaiq/shared';

/** Error codes the API returns in `{ code }`; the app maps them to messages and actions. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Extra fields from the error body, e.g. inConsultWithName on a 409. Never logged. */
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }

  /** True when the user must sign in again (expired, revoked, disabled). */
  get needsLogin(): boolean {
    return this.status === 401;
  }
}

export type TokenProvider = () => Promise<string | null>;

/** API codes that end the session: remote sign-out by the Admin, a disabled or removed account. */
export const SESSION_ENDING_CODES = new Set(['session_revoked', 'user_disabled', 'unknown_user']);
type Fetch = typeof fetch;

/**
 * Typed client for the SwasthyaIQ API. Response types come from @swasthyaiq/shared,
 * the same package the API is built against. Never logs request or response bodies.
 */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: TokenProvider,
    private readonly fetchImpl: Fetch = fetch,
    private readonly timeoutMs = 15_000,
    /** Told when the API ends the session (see SESSION_ENDING_CODES). */
    private readonly onSessionEnded?: (code: string) => void | Promise<void>,
  ) {}

  health(): Promise<HealthResponse> {
    return this.request('GET', '/health', false);
  }
  me(): Promise<UserSummary> {
    return this.request('GET', '/me');
  }
  queue(): Promise<QueueEntry[]> {
    return this.request('GET', '/queue');
  }
  openConsult(patientId: string): Promise<QueueEntry> {
    return this.request('POST', `/queue/${encodeURIComponent(patientId)}/open`);
  }
  /** Doctor's "Reset queue": everyone back to Waiting with fresh times. Never deletes visits. */
  resetQueue(): Promise<QueueResetResult> {
    return this.request('POST', '/queue/reset');
  }
  searchPatients(q: string): Promise<Patient[]> {
    return this.request('GET', `/patients?q=${encodeURIComponent(q)}`);
  }
  patient(id: string): Promise<PatientDetail> {
    return this.request('GET', `/patients/${encodeURIComponent(id)}`);
  }
  /** DIG-99: adds an allergy to the patient's list (no-op if already there). */
  addAllergy(patientId: string, name: string): Promise<AllergyList> {
    return this.request('POST', `/patients/${encodeURIComponent(patientId)}/allergies`, true, { name });
  }
  addCondition(patientId: string, input: PatientConditionInput): Promise<PatientCondition> {
    return this.request('POST', `/patients/${encodeURIComponent(patientId)}/conditions`, true, input);
  }
  updateCondition(
    patientId: string,
    conditionId: string,
    input: PatientConditionUpdate,
  ): Promise<PatientCondition> {
    return this.request(
      'PATCH',
      `/patients/${encodeURIComponent(patientId)}/conditions/${encodeURIComponent(conditionId)}`,
      true,
      input,
    );
  }
  /** Draft save (DIG-41): the app picks the visit id, so a retried save creates nothing twice. */
  saveDraft(visitId: string, input: VisitDraftInput): Promise<VisitDetail> {
    return this.request('PUT', `/visits/${encodeURIComponent(visitId)}`, true, input);
  }
  /** Sign (DIG-41): checks a diagnosis is present, locks the visit and sets the queue entry to Done. */
  signVisit(visitId: string, input: SignInput = {}): Promise<VisitDetail> {
    return this.request('POST', `/visits/${encodeURIComponent(visitId)}/sign`, true, input);
  }
  /** Edit a signed visit (DIG-97): saved as the next version; the signed note is kept. */
  amendVisit(visitId: string, input: VisitAmendmentInput): Promise<VisitDetail> {
    return this.request('POST', `/visits/${encodeURIComponent(visitId)}/amendments`, true, input);
  }
  /** The doctor's most-used diagnoses, shown first in the diagnosis picker (DIG-53). */
  diagnosisFavourites(): Promise<DiagnosisFavourite[]> {
    return this.request('GET', '/diagnoses/favourites');
  }
  /** Medicine catalogue and the doctor's order sets (DIG-69). Indicative, generic names only. */
  medicines(): Promise<MedicineCatalogue> {
    return this.request('GET', '/medicines');
  }
  /** The doctor's most-prescribed catalogue medicines (DIG-69). */
  medicineFavourites(): Promise<MedicineFavourite[]> {
    return this.request('GET', '/medicines/favourites');
  }
  /** The A4 summary as data, for the print-copy editor (DIG-73). */
  summary(visitId: string): Promise<SummaryDocument> {
    return this.request('GET', `/visits/${encodeURIComponent(visitId)}/summary`);
  }
  /** The A4 PDF of the latest version (DIG-72): stored for a signed visit, live for a draft. */
  summaryPdf(visitId: string): Promise<Uint8Array> {
    return this.binary('GET', `/visits/${encodeURIComponent(visitId)}/summary.pdf`);
  }
  /** A reworded printout (DIG-73): not saved, not written back to the visit. */
  printCopyPdf(visitId: string, input: PrintCopyInput): Promise<Uint8Array> {
    return this.binary('POST', `/visits/${encodeURIComponent(visitId)}/print-copy`, input);
  }
  visit(id: string): Promise<VisitDetail> {
    return this.request('GET', `/visits/${encodeURIComponent(id)}`);
  }

  /** A binary (PDF) response; errors are JSON like every other call. */
  private async binary(method: string, path: string, body?: object): Promise<Uint8Array> {
    const token = await this.getToken();
    if (!token) throw new ApiError(401, 'not_signed_in', 'Please sign in');
    const headers: Record<string, string> = { Accept: 'application/pdf', Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs * 2);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {
      throw new ApiError(0, 'network', 'Offline — try again when connected');
    } finally {
      clearTimeout(timer);
    }
    const b = ((await res.json().catch(() => null)) ?? {}) as { code?: string; message?: string };
    throw new ApiError(res.status, b.code ?? `http_${res.status}`, b.message ?? 'Something went wrong');
  }

  private async request<T>(method: string, path: string, auth = true, body?: object): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = await this.getToken();
      if (!token) throw new ApiError(401, 'not_signed_in', 'Please sign in');
      headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(0, 'network', 'Offline — will retry');
    } finally {
      clearTimeout(timer);
    }
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const b = (payload ?? {}) as { code?: string; message?: string } & Record<string, unknown>;
      if (res.status === 401 && b.code && SESSION_ENDING_CODES.has(b.code))
        await this.onSessionEnded?.(b.code);
      const { code, message, ...details } = b;
      throw new ApiError(
        res.status,
        code ?? `http_${res.status}`,
        message ?? 'Something went wrong',
        details,
      );
    }
    return payload as T;
  }
}
