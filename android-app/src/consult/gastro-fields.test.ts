import { appendPhrase } from '@swasthyaiq/shared';
import { NO_ALARM_FEATURES, parseList, TENDERNESS_CHIPS, toggleListItem } from '@swasthyaiq/shared';

describe('gastro fields (DIG-51)', () => {
  it('builds per-abdomen findings from tap-to-add phrases', () => {
    const epigastric = TENDERNESS_CHIPS[0]!.phrase;
    let text = appendPhrase('', 'Soft');
    text = appendPhrase(text, epigastric);
    text = appendPhrase(text, 'Bowel sounds normal');
    expect(text).toBe('Soft, epigastric tenderness, bowel sounds normal');
  });

  it('toggles alarm features as a list, with None standing alone', () => {
    let v = toggleListItem('', 'Weight loss', NO_ALARM_FEATURES);
    v = toggleListItem(v, 'Jaundice', NO_ALARM_FEATURES);
    expect(parseList(v)).toEqual(['Weight loss', 'Jaundice']);
    expect(toggleListItem(v, 'Weight loss', NO_ALARM_FEATURES)).toBe('Jaundice');
    expect(toggleListItem(v, NO_ALARM_FEATURES, NO_ALARM_FEATURES)).toBe('None');
    expect(toggleListItem('None', 'GI bleed', NO_ALARM_FEATURES)).toBe('GI bleed');
  });

  it('allows more than one plan type', () => {
    expect(toggleListItem('Medical', 'Refer OGD')).toBe('Medical, Refer OGD');
  });
});
