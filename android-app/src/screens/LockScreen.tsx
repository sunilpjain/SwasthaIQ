import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_DISPLAY_NAME } from '@swasthyaiq/shared';
import { session } from '../auth/SessionProvider';
import { colors, MIN_TAP, radius, type } from '../theme/tokens';
import LoginScreen, { authStyles } from './LoginScreen';

/**
 * Shown after 15 minutes idle and when the app reopens with a stored session. Asks for the
 * fingerprint or face straight away; the password is the fallback (no biometrics on the phone,
 * or the doctor taps "Use password").
 */
export default function LockScreen({ username }: { username: string }) {
  const [usePassword, setUsePassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unlock = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await session.unlock();
      if (result === 'needs_password') setUsePassword(true);
      else if (result === 'cancelled') setMessage('Not unlocked. Tap Unlock to try again.');
      // 'unlocked' and 'session_ended' change the session state; this screen goes away.
    } catch {
      setMessage('Could not unlock. Tap Unlock to try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void unlock();
  }, [unlock]);

  if (usePassword) return <LoginScreen lastUsername={username} />;

  return (
    <View style={authStyles.screen}>
      <View style={authStyles.brand}>
        <Text style={authStyles.product}>{APP_DISPLAY_NAME}</Text>
        <Text style={styles.locked}>Locked · {username}</Text>
      </View>
      {message ? (
        <Text style={styles.message} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      <Pressable
        style={[authStyles.button, busy && authStyles.buttonDisabled]}
        onPress={unlock}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={authStyles.buttonText}>Unlock</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() => setUsePassword(true)}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>Use password</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  locked: { ...type.title, color: colors.onSurfaceVariant },
  message: { ...type.body, color: colors.onSurface, textAlign: 'center' },
  secondary: { minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  secondaryText: { ...type.labelLarge, color: colors.primary },
});
