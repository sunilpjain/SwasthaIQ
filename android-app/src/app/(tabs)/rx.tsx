import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../../theme/tokens';

/**
 * The prescription is written in the consult (DIG-70, "Medication order"); its A4 opens from the
 * review ("Preview A4"), after signing, or from the patient summary (DIG-73).
 */
export default function PrescriptionScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Prescription</Text>
      <Text style={styles.body}>Write the prescription in the Consult tab, under “Medication order”.</Text>
      <Text style={styles.body}>
        The A4 summary with the prescription opens from the review (“Preview A4”), after signing, or from the
        patient summary (“A4 summary”). Share, print or edit a print copy from there.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surfaceContainer },
  title: { ...type.titleLarge, color: colors.onSurface },
  body: { ...type.body, color: colors.onSurfaceVariant },
});
