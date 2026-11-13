# SwasthyaIQ (स्वास्थIQ) — Arihant prototype

Working prototype for Arihant Clinic, Surat: two doctors (Dr. Saiyam Shah, surgical gastro; Dr. Samradnyee Shah, ophthalmology) on a native Android app, plus a web Admin dashboard, on AWS Mumbai (ap-south-1). **Synthetic patients only. Not for clinical use.**

Specs live in the claude.ai project "SwasthIQ": functional spec, dev plan, architecture. Jira: DIG (board 128, cognistrength.atlassian.net). Reference a story key in every branch, commit and PR (e.g. `DIG-37`).

## Repo layout

| Folder         | What                                                                       | Stack                                     |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| `android-app/` | Doctor app "SwasthyaIQ · Arihant", Android 10+                             | Expo / React Native, TypeScript           |
| `api/`         | Modular monolith: REST + WebSocket (dictation relay from Sprint 3)         | NestJS 10, Kysely, PostgreSQL 16          |
| `admin-web/`   | Admin dashboard at `/admin`                                                | React + Vite, served from S3 + CloudFront |
| `infra/`       | All AWS resources, dev and demo environments                               | AWS CDK v2, TypeScript                    |
| `shared/`      | Domain types and constants used by all of the above                        | Plain TypeScript, no runtime deps         |
| `legacy-demo/` | Old Figma Make browser demo (Harmony). Reference only; not built or linted | Vite                                      |

## Commands

```bash
pnpm install
pnpm db:up            # local PostgreSQL in Docker (or use your own; see api/.env.example)
pnpm --filter @swasthyaiq/shared build
pnpm db:migrate && pnpm db:seed
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter api test:ci     # API tests with coverage gate (>= 70% lines)
pnpm synth                    # cdk synth for all stacks
```

## Architecture in one screen

- **Android app** → HTTPS `api.swasthyaiq.in` (demo) / `dev-api.…` (dev) → **Caddy** on one **EC2 t4g.small** (Elastic IP, no load balancer) → **NestJS in Docker** → **RDS PostgreSQL** (db.t4g.micro, isolated subnet, no NAT).
- **Login:** Cognito user pool, 3 fixed users (`saiyam`, `samradnyee` = doctor; `admin` = admin), no self sign-up, case-insensitive user IDs. Refresh token 7 days with rotation, so the session slides while in use. The API checks every access token (signature, issuer, client, `token_use=access`), the Cognito group against the DB role, `users.enabled`, and `session_revocations` (remote sign-out). Status is cached for at most 30 s.
- **Background jobs:** SQS (+ DLQ, 3 retries) and a worker on the same server. **Files:** private S3, 5-minute presigned links. **AI:** Sarvam (speech), Transcribe (comparison), Textract (OCR), Bedrock (structuring).
- **Secrets:** Secrets Manager only (DB credentials, Sarvam key). Read at start-up by `api/src/config/config.ts`.

## Data model rules (api/migrations)

- One row per consult-note field in `consult_fields`, with `source` = dictated / scanned / typed and `confirmed`. Nothing AI-filled is final until the doctor confirms it.
- **Signed visits are read-only, enforced by database triggers** (visits, consult_fields, prescriptions, rx_lines). Corrections go in `visit_amendments`. The only exception is the admin "Clear test visits" action, which deletes non-seed visits inside a transaction that sets `swasthyaiq.allow_test_clear = 'on'`.
- Seed data (`api/src/seed`) uses deterministic UUIDs (`seedUuid`). The seed is idempotent and marks rows `is_seed = true`. "Reset queue" never deletes visits.
- Every write goes through `AuditInterceptor` and ends up in `audit_log` (user, time, route, entity id, status). Request bodies are never stored.
- Migrations are plain SQL files `NNN_name.sql`, applied in order on deploy. Never edit an applied migration; add a new one and update `api/src/db/schema.ts`.

## Coding rules

- TypeScript strict everywhere. No `any`. No `console.*` in app code; use `logger` from `api/src/logging/logger.ts`.
- New endpoint checklist: role decorator (`@Roles('doctor')` or `@Roles('admin')`), happy-path and error test in `api/test`, shared response type in `shared/src`, then regenerate `api/openapi.json` (`pnpm --filter api openapi`).
- Safety checks (allergy, duplicate, eye missing) are deterministic code with test tables. Never an LLM. They warn and never block.
- Every AI call records units in `usage_events` (seconds, pages, tokens) so the admin dashboard can show same-day cost.
- Infra changes need a CDK assertion test in `infra/test`. Every resource carries the tag `project = arihant-prototype`.

## Never do

- **Never put patient data in logs, errors, analytics, Sentry or LLM prompts' log lines**: no names, phones, diagnoses, note text or transcripts. Log ids only. The logger redacts known keys as a safety net, not as permission.
- **Never commit secrets**: passwords, API keys, `.env` files, keystores. Passwords for the 3 users are set out-of-band (`infra/README.md`).
- Never use real patient data, even for a quick test. Synthetic or fully de-identified only.
- Never bypass the signed-visit triggers or disable the audit interceptor.
- Never open port 22 or add SSH keys; use SSM Session Manager.
- Never deploy to demo outside a version tag, or before 10 pm IST.
- Never add a NAT gateway, load balancer or Multi-AZ RDS without checking the ₹6,000/month budget.
