# High-fidelity screens (DIG-3)

Android doctor app, 360 dp wide, exported at 2×. Synthetic patients only. Built from the signed-off wireframes v4 (`docs/wireframes/dig-27/`).

Source in Figma: page "Hi-fi screens (DIG-3)" of the design system, https://www.figma.com/design/gesNzlq8x6ylvt8tdt8INh

| File                                      | Screen                                       |
| ----------------------------------------- | -------------------------------------------- |
| `dig-3/01-sign-in.png`                    | 1a Sign in                                   |
| `dig-3/02-fingerprint-unlock.png`         | 1b Fingerprint unlock                        |
| `dig-3/03-queue.png`                      | 2 Queue                                      |
| `dig-3/04-patient-summary.png`            | 3 Patient summary                            |
| `dig-3/05a-consult-gastro.png`            | 4a Consult note, gastro                      |
| `dig-3/05b-consult-eye.png`               | 4b Consult note, eye                         |
| `dig-3/06-review.png`                     | 5 Review of AI-filled fields                 |
| `dig-3/07-labs.png`                       | 6 Labs, confirm extracted values             |
| `dig-3/08-summary-rx.png`                 | 7 Consultation summary and prescription      |
| `dig-3/09-preview-sign.png`               | 8 Preview and sign (shows the real A4 pages) |
| `dig-3/10-consult-feedback.png`           | 8b Prototype feedback after signing          |
| `dig-3/11-visit-record.png`               | 9 Visit record, read-only                    |
| `dig-3/SwasthyaIQ-hifi-screens-DIG-3.pdf` | All screens and states with a cover page     |

Empty, loading, offline and error states (`dig-3/states/`):

| File                            | State                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- |
| `s01-queue-loading.png`         | Queue loading: skeleton rows                                               |
| `s02-queue-empty.png`           | No patients booked yet; offer "Show all patients"                          |
| `s03-search-no-results.png`     | Search finds nobody; hint to search by last 4 phone digits                 |
| `s04-queue-offline.png`         | Offline banner, cached queue with its time, changes waiting to sync        |
| `s05-dictation-offline.png`     | Recording while offline; recordings kept on the phone and queued           |
| `s06-transcribing.png`          | Transcription in progress (uploaded → speech to text → fields); Review off |
| `s07-transcription-failed.png`  | Speech service failed: recording kept, nothing added; Type instead / Retry |
| `s08-lab-report-unreadable.png` | OCR could not read the photo; tips; Retake or enter by hand                |
| `s09-signing-failed.png`        | Sign failed: nothing lost, patient stays In consult; Try again             |
| `s10-sign-in-error.png`         | Wrong user ID or password; mentions the temporary lock                     |
| `s11-signed-out.png`            | Session ended (admin sign-out or 7 days unused); fingerprint off           |

State rules: errors say what happened, that nothing was lost, and the next step; they never show patient details or raw error text (only a short code). Offline work is kept on the phone and synced later.

Style decisions (22 Nov 2026):

- Primary colour is clinical blue `#0A4F96` (white text 8.2:1). Purple `#634C91` is the supporting colour (Waiting status, other doctor's visits, amendments). Magenta `#CA2E69` stays a brand accent only, never on buttons. Neutrals are cool blue-grey.
- Queue: compact divider rows with a coloured status strip (grey Not arrived, purple Waiting, blue In consult, green Done); all six patients of a doctor fit on one screen.
- Patient screens: a blue "Patient header" component keeps name, age/sex, allergy and visit time visible; content sits in white cards on a pale grey background.
- Every text pair stays at least 7:1, body text 16 sp, tap targets 48 dp.
- Not yet done: admin dashboard hi-fi; clickable prototype. The app's `android-app/src/theme/tokens.ts` still has the purple primary and is updated when the screens are built.
