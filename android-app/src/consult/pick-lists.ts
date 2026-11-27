import type { Specialty } from '@swasthyaiq/shared';

/**
 * Tap-to-add options for history-taking (DIG-99). DRAFT lists written by Claude on 27 Nov 2026
 * for the doctors to confirm or edit; keep every list in this one file so their changes are small.
 * Tapping a chip adds its phrase to the field's text, which stays freely editable. Fixed lists,
 * not AI suggestions.
 */

export const COMPLAINT_CHIPS: Record<Specialty, string[]> = {
  gastro: [
    'Abdominal pain',
    'Epigastric pain',
    'Heartburn / acid reflux',
    'Bloating',
    'Nausea',
    'Vomiting',
    'Loss of appetite',
    'Weight loss',
    'Constipation',
    'Diarrhoea',
    'Blood in stool',
    'Black stools',
    'Jaundice',
    'Difficulty swallowing',
    'Swelling / lump in abdomen',
    'Gallstones on USG',
    'Fatty liver on USG',
  ],
  eye: [
    'Blurred vision for distance',
    'Blurred vision for near',
    'Redness',
    'Itching',
    'Watering',
    'Pain',
    'Discharge',
    'Foreign body sensation',
    'Glare / halos',
    'Floaters',
    'Flashes of light',
    'Double vision',
    'Headache with eye strain',
    'Routine check-up',
    'Post-op review',
  ],
};

/** Added after the last complaint: "Epigastric pain for 2 weeks". */
export const DURATION_CHIPS = [
  'since today',
  'for 2 days',
  'for 1 week',
  'for 2 weeks',
  'for 1 month',
  'for 3 months',
  'for 6 months',
  'for 1 year',
];

export const PROCEDURE_CHIPS: Record<Specialty, string[]> = {
  gastro: [
    'No previous surgery',
    'Lap cholecystectomy',
    'Open cholecystectomy',
    'Appendicectomy',
    'Hernia repair',
    'OGD (upper endoscopy)',
    'Colonoscopy',
    'ERCP',
    'Caesarean section',
  ],
  eye: [
    'No previous eye surgery',
    'Cataract surgery OD',
    'Cataract surgery OS',
    'LASIK / refractive surgery',
    'Glaucoma surgery',
    'YAG laser',
    'Retinal laser (PRP)',
    'Intravitreal injection',
  ],
};

export const FAMILY_SOCIAL_CHIPS = [
  'Diabetes in family',
  'Hypertension in family',
  'Heart disease in family',
  'Glaucoma in family',
  'Cancer in family',
  'Non-smoker',
  'Smoker',
  'Tobacco chewing',
  'No alcohol',
  'Occasional alcohol',
  'Regular alcohol',
  'Vegetarian',
  'Desk job / screen work',
];

export const NO_KNOWN_ALLERGIES = 'No known allergies';

/** Common drug-class allergies; picking one also adds it to the patient's allergy list. */
export const ALLERGY_CHIPS = [
  NO_KNOWN_ALLERGIES,
  'Sulfonamides',
  'Penicillins',
  'Cephalosporins',
  'NSAIDs',
  'Aspirin',
  'Iodine contrast',
  'Latex',
  'Atropine eye drops',
];

/** "Epigastric pain" + "for 2 weeks" → "Epigastric pain for 2 weeks" (joins with a space). */
export function appendDuration(text: string, duration: string): string {
  const t = text.trimEnd();
  return t ? `${t} ${duration}` : duration;
}
