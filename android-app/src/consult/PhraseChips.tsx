import { Text, View } from 'react-native';
import Chip, { Chips, chipStyles } from './Chip';
import { appendPhrase, hasPhrase } from '@swasthyaiq/shared';
import type { DraftStore } from './draft-store';

/**
 * A row of tap-to-add chips above a free-text field (DIG-99): each tap adds the phrase to the
 * field's text; chips whose phrase is already in the text show as selected. `onPick` runs after.
 */
export default function PhraseChips({
  d,
  field,
  options,
  readOnly,
  label = 'Tap to add',
  join = appendPhrase,
  onPick,
}: {
  d: DraftStore;
  field: string;
  options: readonly string[];
  readOnly: boolean;
  label?: string;
  join?: (text: string, phrase: string) => string;
  onPick?: (phrase: string) => void;
}) {
  if (readOnly) return null;
  const text = d.value(field);
  return (
    <View style={{ gap: 4 }}>
      <Text style={chipStyles.chipLabel}>{label}</Text>
      <Chips>
        {options.map((o) => (
          <Chip
            key={o}
            label={o}
            selected={hasPhrase(text, o)}
            onPress={() => {
              d.setField(field, join(d.value(field), o));
              onPick?.(o);
            }}
          />
        ))}
      </Chips>
    </View>
  );
}
