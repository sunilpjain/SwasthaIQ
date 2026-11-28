/**
 * Gastro section for Dr. Saiyam (DIG-51, hi-fi screen 4a). Stored under "gastro.*" like the
 * seed's gastro.bowel_habit, so the other doctor reads the same fields in the visit history.
 */
export const GASTRO_FIELD = {
  perAbdomen: 'gastro.per_abdomen',
  otherSystems: 'gastro.other_systems',
  alarmFeatures: 'gastro.alarm_features',
  planType: 'plan.plan_type',
} as const;

/** Tap-to-add phrases for "Per abdomen findings". */
export const TENDERNESS_CHIPS: { label: string; phrase: string }[] = [
  { label: 'Epigastric', phrase: 'Epigastric tenderness' },
  { label: 'RUQ', phrase: 'RUQ tenderness' },
  { label: 'LUQ', phrase: 'LUQ tenderness' },
  { label: 'Umbilical', phrase: 'Umbilical tenderness' },
  { label: 'RIF', phrase: 'RIF tenderness' },
  { label: 'LIF', phrase: 'LIF tenderness' },
  { label: 'None', phrase: 'No tenderness' },
];

export const FINDING_CHIPS: { label: string; phrase: string }[] = [
  { label: 'Soft', phrase: 'Soft' },
  { label: 'Guarding', phrase: 'Guarding' },
  { label: 'Mass', phrase: 'Mass palpable' },
  { label: 'Hepatomegaly', phrase: 'Hepatomegaly' },
  { label: 'Splenomegaly', phrase: 'Splenomegaly' },
  { label: 'Ascites', phrase: 'Ascites' },
  { label: 'Bowel sounds normal', phrase: 'Bowel sounds normal' },
];

export const OTHER_SYSTEMS_NAD = 'CVS, RS, CNS: NAD';

/** Red flags that change urgency; picked as chips and saved as one list. */
export const ALARM_FEATURES = ['Weight loss', 'GI bleed', 'Dysphagia', 'Anaemia', 'Jaundice'] as const;
export const NO_ALARM_FEATURES = 'None';

/** No endoscopy at the clinic: endoscopy is a referral. */
export const PLAN_TYPES = ['Medical', 'Surgery', 'Refer OGD', 'Refer colonoscopy'] as const;

/** "Weight loss, Jaundice" ↔ ['Weight loss', 'Jaundice']. */
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Toggles one chip in a comma-separated list. "None" stands alone: picking it clears the others,
 * and picking any other item removes "None".
 */
export function toggleListItem(value: string, item: string, exclusive?: string): string {
  const list = parseList(value);
  if (list.includes(item)) return list.filter((x) => x !== item).join(', ');
  if (exclusive && item === exclusive) return item;
  return [...list.filter((x) => x !== exclusive), item].join(', ');
}
