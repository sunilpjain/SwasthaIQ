import { appendPhrase } from './consult-fields';
import {
  ALLERGY_CHIPS,
  appendDuration,
  COMPLAINT_CHIPS,
  FAMILY_SOCIAL_CHIPS,
  NO_KNOWN_ALLERGIES,
  PROCEDURE_CHIPS,
} from './pick-lists';

describe('pick-lists (DIG-99)', () => {
  it('builds a complaint line from chips', () => {
    let t = appendPhrase('', 'Epigastric pain');
    t = appendDuration(t, 'for 2 weeks');
    t = appendPhrase(t, 'Heartburn / acid reflux');
    expect(t).toBe('Epigastric pain for 2 weeks, heartburn / acid reflux');
  });

  it('works after an eye tag', () => {
    expect(appendPhrase('OS: ', 'Blurred vision for distance')).toBe('OS: Blurred vision for distance');
  });

  it('has lists for both specialties and no duplicates', () => {
    for (const list of [
      COMPLAINT_CHIPS.gastro,
      COMPLAINT_CHIPS.eye,
      PROCEDURE_CHIPS.gastro,
      PROCEDURE_CHIPS.eye,
      FAMILY_SOCIAL_CHIPS,
      ALLERGY_CHIPS,
    ]) {
      expect(list.length).toBeGreaterThan(5);
      expect(new Set(list.map((x) => x.toLowerCase())).size).toBe(list.length);
    }
    expect(ALLERGY_CHIPS[0]).toBe(NO_KNOWN_ALLERGIES);
  });
});
