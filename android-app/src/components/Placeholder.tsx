import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme/tokens';

/** Empty-state body for tabs that arrive in Sprint 2+. */
export default function Placeholder({
  title,
  sprint,
  children,
}: {
  title: string;
  sprint: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>Coming in {sprint}.</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm },
  title: { ...type.title, color: colors.onSurface },
  body: { ...type.body, color: colors.onSurfaceVariant },
});
