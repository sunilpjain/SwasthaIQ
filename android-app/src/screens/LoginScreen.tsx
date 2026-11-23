import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { APP_DISPLAY_NAME, PRODUCT_NAME_DEVANAGARI } from '@swasthyaiq/shared';
import { ApiClient, ApiError } from '../api/client';
import { CognitoError } from '../auth/cognito';
import { signInErrorMessage, signOutMessage } from '../auth/messages';
import type { SignOutReason } from '../auth/session';
import { session } from '../auth/SessionProvider';
import { env } from '../config/env';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';

class NotDoctorError extends Error {}

/** Only doctors use the Android app; checked with the new token before the session is kept. */
async function requireDoctor(accessToken: string): Promise<void> {
  const me = await new ApiClient(env.apiBaseUrl, async () => accessToken).me();
  if (me.role !== 'doctor') throw new NotDoctorError();
}

/**
 * First login with user ID and password (also used after 7 days without use, Log out, remote
 * sign-out, or when the phone has no biometrics to unlock with).
 */
export default function LoginScreen({
  reason,
  lastUsername,
}: {
  reason?: SignOutReason;
  lastUsername?: string;
}) {
  const [userId, setUserId] = useState(lastUsername ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notice = signOutMessage(reason);
  const canSubmit = userId.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await session.signIn(userId, password, requireDoctor);
    } catch (e) {
      setPassword('');
      if (e instanceof NotDoctorError) setError(signInErrorMessage('not_doctor'));
      else if (e instanceof CognitoError) setError(signInErrorMessage(e.code));
      else if (e instanceof ApiError && e.code === 'network') setError(signInErrorMessage('network'));
      else setError(signInErrorMessage('unknown'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <View style={styles.brand}>
        <Text style={styles.product}>{APP_DISPLAY_NAME}</Text>
        <Text style={styles.devanagari}>{PRODUCT_NAME_DEVANAGARI}</Text>
      </View>

      {notice ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <Text style={styles.label} nativeID="userIdLabel">
        User ID
      </Text>
      <TextInput
        style={styles.input}
        value={userId}
        onChangeText={setUserId}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        accessibilityLabelledBy="userIdLabel"
        editable={!busy}
      />
      <Text style={styles.label} nativeID="passwordLabel">
        Password
      </Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        accessibilityLabelledBy="passwordLabel"
        editable={!busy}
      />

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy }}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>

      <Text style={styles.hint}>
        After this, unlock with your fingerprint or face. Your password is needed again only after 7 days
        without use or after you log out.
      </Text>
    </KeyboardAvoidingView>
  );
}

export const authStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  brand: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.xs },
  product: { ...type.headline, color: colors.primary },
  devanagari: { ...type.title, color: colors.onSurfaceVariant },
  button: {
    minHeight: MIN_TAP,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...type.labelLarge, color: colors.onPrimary },
  hint: { ...type.body, color: colors.onSurfaceVariant, marginTop: spacing.md, textAlign: 'center' },
});

const styles = StyleSheet.create({
  ...authStyles,
  label: { ...type.label, color: colors.onSurfaceVariant, marginTop: spacing.sm },
  input: {
    ...type.body,
    color: colors.onSurface,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  notice: { backgroundColor: colors.warningContainer, borderRadius: radius.sm, padding: spacing.md },
  noticeText: { ...type.body, color: colors.onWarningContainer },
  error: { ...type.bodyStrong, color: colors.error, marginTop: spacing.sm },
});
