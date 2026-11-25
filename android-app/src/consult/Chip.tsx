import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';

/** Tap chip used across the consult form (exam phrases, tests, follow-up, eye options). */
export default function Chip(p: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.disabled}
      style={[chipStyles.chip, p.selected && chipStyles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: p.selected, disabled: !!p.disabled }}
    >
      <Text style={[chipStyles.chipText, p.selected && { color: colors.onPrimaryContainer }]}>
        {p.selected ? '✓ ' : ''}
        {p.label}
      </Text>
    </Pressable>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <View style={chipStyles.chips}>{children}</View>;
}

export const chipStyles = StyleSheet.create({
  chipLabel: { ...type.label, color: colors.onSurfaceVariant },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { ...type.label, color: colors.onSurface },
});
