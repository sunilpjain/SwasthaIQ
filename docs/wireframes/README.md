# Wireframes and A4 consultation summary

Signed off by both doctors on 21 Nov 2026 (DIG-30). Synthetic patients only.

22 Nov 2026 (DIG-3): the primary colour changed from purple to clinical blue `#0A4F96`; the A4 summary in `dig-29/` was re-exported in blue. Content and layout are unchanged from the signed-off version.

| Folder    | Story  | What                                                                                         |
| --------- | ------ | -------------------------------------------------------------------------------------------- |
| `dig-27/` | DIG-27 | Low-fidelity wireframes v4: 10 doctor screens (incl. 8b feedback) and the admin dashboard    |
| `dig-29/` | DIG-29 | A4 consultation summary with prescription: gastro (Dr. Saiyam) and eye (Dr. Samradnyee) 2 pp |

Sources in Figma (Cognihealth team):

- Wireframes: https://www.figma.com/design/3iQBI7gfEiAJBkduTlw0ke
- A4 summary: page "Prescription A4 (DIG-29)" in the design system, https://www.figma.com/design/gesNzlq8x6ylvt8tdt8INh

Decisions captured in these designs (details on the Jira stories):

- No token numbers in the doctor's view; queue shows appointment and check-in times.
- Diagnosis in ICD-10 only, mandatory before signing; Misc for codes outside the specialty list or free text.
- Eye: OD / OS / OU; vision → IOP → examination per eye; photos instead of drawings.
- Summary order: … diagnosis → investigation order → medication order (generic names) → advice → follow-up.
- Doctor can edit the print copy (not saved to the record; footer says "print copy edited").
- Past conditions carry a status the doctor can update.
- Optional prototype feedback after each signed consult (DIG-92).
