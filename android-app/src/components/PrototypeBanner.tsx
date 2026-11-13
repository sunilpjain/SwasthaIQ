import { StyleSheet, Text, View } from 'react-native';
import { PROTOTYPE_BANNER } from '@swasthyaiq/shared';
import { env } from '../config/env';
import { colors, spacing } from '../theme/tokens';

/** Shown on every screen (spec: "Clearly a prototype"). Also says which backend the build uses. */
export default function PrototypeBanner() {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>
        {PROTOTYPE_BANNER}
        {env.appEnv === 'dev' ? '  ·  DEV' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.bannerBg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  text: { color: colors.bannerText, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
