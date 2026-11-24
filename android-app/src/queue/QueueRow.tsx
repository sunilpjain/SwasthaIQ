import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QueueStatus } from '@swasthyaiq/shared';
import { colors, MIN_TAP, spacing, type } from '../theme/tokens';
import type { RowModel } from './queue-view';

/** Status strip and label colours from the hi-fi design: grey, purple, blue, green. */
export const STATUS_COLOR: Record<QueueStatus, string> = {
  not_arrived: colors.outline,
  waiting: colors.secondary,
  in_consult: colors.primary,
  done: colors.success,
};

const STATUS_TEXT: Record<QueueStatus, string> = {
  not_arrived: colors.onSurfaceVariant,
  waiting: colors.secondary,
  in_consult: colors.primary,
  done: colors.success,
};

function QueueRow({ row, onPress }: { row: RowModel; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        row.highlighted && { backgroundColor: colors.primaryContainer },
        pressed && { backgroundColor: colors.surfaceContainerHigh },
      ]}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
    >
      <View style={[styles.strip, { backgroundColor: STATUS_COLOR[row.status] }]} />
      <View style={styles.time}>
        <Text style={styles.appt}>{row.appointment}</Text>
        <Text style={styles.apptLabel}>Appt</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={styles.title} numberOfLines={1}>
            {row.title}
          </Text>
          {row.tag ? (
            <Text
              style={[
                styles.tag,
                {
                  color:
                    row.tagTone === 'other'
                      ? colors.warning
                      : row.highlighted
                        ? colors.primaryDark
                        : colors.primary,
                },
              ]}
              numberOfLines={1}
            >
              {row.tag}
            </Text>
          ) : null}
        </View>
        <Text style={styles.reason} numberOfLines={1}>
          {row.reason}
        </Text>
        <Text style={styles.statusLine} numberOfLines={1}>
          <Text
            style={[
              styles.status,
              // Primary blue is only 6.7:1 on the highlighted row; the darker blue keeps 7:1.
              { color: row.highlighted ? colors.primaryDark : STATUS_TEXT[row.status] },
            ]}
          >
            {row.statusLabel}
          </Text>
          {'  '}
          {row.checkIn}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default memo(QueueRow);

/** Grey placeholder rows while the queue loads (state S1). */
export function SkeletonRow() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.strip, { backgroundColor: colors.surface }]} />
      <View style={[styles.bone, { width: 44, height: 20, marginRight: spacing.md }]} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <View style={[styles.bone, { width: '60%' }]} />
        <View style={[styles.bone, { width: '85%' }]} />
        <View style={[styles.bone, { width: '45%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP * 2,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  strip: { width: 4, alignSelf: 'stretch', marginRight: spacing.md },
  time: { width: 64 },
  appt: { ...type.titleLarge, color: colors.onSurface },
  apptLabel: { ...type.label, color: colors.onSurfaceVariant },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.title, color: colors.onSurface, flexShrink: 1 },
  tag: { ...type.label, marginLeft: 'auto' },
  reason: { ...type.body, color: colors.onSurfaceVariant },
  statusLine: { ...type.body, color: colors.onSurfaceVariant },
  status: { ...type.bodyStrong },
  chevron: { fontSize: 28, color: colors.onSurfaceVariant, marginLeft: spacing.sm },
  bone: { height: 14, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh },
});
