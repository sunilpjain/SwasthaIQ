import type {
  HealthResponse,
  Patient,
  PatientDetail,
  QueueEntry,
  UserSummary,
  VisitDetail,
} from '@swasthyaiq/shared';

/** Error codes the API returns in `{ code }`; the app maps them to messages and actions. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }

  /** True when the user must sign in again (expired, revoked, disabled). */
  get needsLogin(): boolean {
    return this.status === 401;
  }
}

export type TokenProvider = () => Promise<string | null>;
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
  openConsult(patientId: string, force = false): Promise<QueueEntry> {
    return this.request('POST', `/queue/${encodeURIComponent(patientId)}/open${force ? '?force=true' : ''}`);
  }
  searchPatients(q: string): Promise<Patient[]> {
    return this.request('GET', `/patients?q=${encodeURIComponent(q)}`);
  }
  patient(id: string): Promise<PatientDetail> {
    return this.request('GET', `/patients/${encodeURIComponent(id)}`);
  }
  visit(id: string): Promise<VisitDetail> {
    return this.request('GET', `/visits/${encodeURIComponent(id)}`);
  }

  private async request<T>(method: string, path: string, auth = true): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) {
      const token = await this.getToken();
      if (!token) throw new ApiError(401, 'not_signed_in', 'Please sign in');
      headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, { method, headers, signal: controller.signal });
    } catch {
      throw new ApiError(0, 'network', 'Offline — will retry');
    } finally {
      clearTimeout(timer);
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const b = (body ?? {}) as { code?: string; message?: string };
      throw new ApiError(res.status, b.code ?? `http_${res.status}`, b.message ?? 'Something went wrong');
    }
    return body as T;
  }
}
