import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';

/** White card with a title and an optional text action on the right ("Edit", "Timeline"). */
export default function Card({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={`${action}: ${title}`}
          >
            <Text style={styles.actionText}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export const cardStyles = StyleSheet.create({
  empty: { ...type.body, color: colors.onSurfaceVariant },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.xs },
  lineText: { ...type.body, color: colors.onSurface, flex: 1 },
  lineSide: { ...type.label, color: colors.onSurfaceVariant, paddingTop: 2 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TAP,
  },
  title: { ...type.titleLarge, color: colors.onSurface },
  action: { minHeight: MIN_TAP, minWidth: MIN_TAP, alignItems: 'flex-end', justifyContent: 'center' },
  actionText: { ...type.labelLarge, color: colors.primary },
});
