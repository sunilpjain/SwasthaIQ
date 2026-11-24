import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import type { CaptureSource } from '@swasthyaiq/shared';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';

const BADGE: Record<CaptureSource, { label: string; fg: string; bg: string }> = {
  typed: { label: 'TYPED', fg: colors.sourceTyped, bg: colors.sourceTypedContainer },
  dictated: { label: 'DICTATED', fg: colors.sourceDictated, bg: colors.sourceDictatedContainer },
  scanned: { label: 'SCANNED', fg: colors.sourceScanned, bg: colors.sourceScannedContainer },
};

/** Source badge on every filled field: where the value came from (DIG-50). */
export function SourceBadge({ source }: { source: CaptureSource }) {
  const b = BADGE[source];
  return (
    <View style={[styles.badge, { backgroundColor: b.bg }]} accessibilityLabel={`Source: ${source}`}>
      <Text style={[styles.badgeText, { color: b.fg }]}>{b.label}</Text>
    </View>
  );
}

/** A labelled free-text field with its source badge. */
export default function FieldBox({
  label,
  value,
  source,
  onChange,
  placeholder,
  multiline = true,
  keyboardType,
  editable = true,
  hint,
}: {
  label: string;
  value: string;
  source?: CaptureSource;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  hint?: string | null;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {value && source ? <SourceBadge source={source} /> : null}
      </View>
      <TextInput
        style={[styles.input, multiline && styles.multiline, !editable && styles.readOnly]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...type.label, color: colors.onSurfaceVariant },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...type.caption, letterSpacing: 0.5 },
  input: {
    ...type.body,
    color: colors.onSurface,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: MIN_TAP * 2 },
  readOnly: { backgroundColor: colors.surfaceContainer },
  hint: { ...type.label, color: colors.warning },
});
