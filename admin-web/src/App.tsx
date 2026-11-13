import { PRODUCT_NAME, PRODUCT_NAME_DEVANAGARI, PROTOTYPE_BANNER } from '@swasthyaiq/shared';

/**
 * Admin dashboard shell. Sprint 1 only proves hosting (S3 + CloudFront at /admin).
 * Admin login and the views (activity, capture modes, labs/Rx, engines, cost, feedback,
 * errors, audit log, CSV export) arrive in Sprint 4.
 */
export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1A1C1C' }}>
      <div
        style={{
          background: '#FFF4CE',
          color: '#5C4300',
          padding: '6px 16px',
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {PROTOTYPE_BANNER}
      </div>
      <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ color: '#00695C', marginBottom: 4 }}>
          {PRODUCT_NAME} Admin <span style={{ fontWeight: 400 }}>({PRODUCT_NAME_DEVANAGARI})</span>
        </h1>
        <p>Arihant Clinic, Surat · synthetic data only.</p>
        <p>The dashboard (activity, capture modes, accuracy, cost, audit log) arrives in Sprint 4.</p>
      </main>
    </div>
  );
}
