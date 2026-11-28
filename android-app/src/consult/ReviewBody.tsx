import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';
import { SourceBadge } from './FieldBox';
import type { Review } from '@swasthyaiq/shared';

export type SignState =
  | { status: 'idle' }
  | { status: 'signing' }
  | { status: 'failed'; code: string; at: string; offline: boolean }
  | { status: 'blocked'; problems: string[] };

/**
 * Review before signing (DIG-95): the note in the DIG-29 order, what blocks signing and what is
 * only a warning. The A4 PDF with the prescription comes with DIG-73.
 */
export function ReviewBody({
  review,
  sign,
  onEdit,
  onSign,
}: {
  review: Review;
  sign: SignState;
  onEdit: () => void;
  onSign: () => void;
}) {
  const blocking = sign.status === 'blocked' ? sign.problems : review.blocking;
  const canSign = blocking.length === 0 && sign.status !== 'signing';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        {sign.status === 'failed' ? (
          <View style={styles.failed} accessibilityRole="alert">
            <Text style={styles.failedTitle}>⚠ Not signed yet</Text>
            <Text style={styles.failedBody}>
              {sign.offline
                ? 'Couldn’t reach the server. Your consultation is kept on this phone, so nothing is lost.'
                : 'Signing didn’t go through. Your consultation is kept as a draft, so nothing is lost.'}{' '}
              The patient stays In consult until it is signed.
            </Text>
            <Text style={styles.failedCode}>
              Error code {sign.code} · {sign.at}
            </Text>
          </View>
        ) : null}

        <View style={styles.version}>
          <Text style={styles.versionText}>Version 1 · not signed yet</Text>
        </View>

        {blocking.length ? (
          <View style={styles.blocking} accessibilityRole="alert">
            <Text style={styles.blockingTitle}>Before you can sign</Text>
            {blocking.map((b) => (
              <Text key={b} style={styles.blockingText}>
                • {b}
              </Text>
            ))}
            <Text style={styles.blockingHint}>Tap Edit to go back to the note.</Text>
          </View>
        ) : null}

        {review.warnings.length ? (
          <View style={styles.warnings}>
            <Text style={styles.warningsTitle}>Check (won’t stop signing)</Text>
            {review.warnings.map((w) => (
              <Text key={w} style={styles.warningsText}>
                • {w}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.doc}>
          {review.sections.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title.toUpperCase()}</Text>
              {s.lines.map((l, i) => (
                <View key={`${s.title}-${i}`} style={styles.line}>
                  <Text style={styles.lineText}>• {l.text}</Text>
                  {l.source ? <SourceBadge source={l.source} /> : null}
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.note}>
            The A4 summary with the prescription, print and share arrive with DIG-73.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Pressable
          style={[styles.outline, { flex: 1 }]}
          onPress={onEdit}
          disabled={sign.status === 'signing'}
          accessibilityRole="button"
        >
          <Text style={styles.outlineText}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.primary, { flex: 1.3 }, !canSign && { opacity: 0.5 }]}
          onPress={onSign}
          disabled={!canSign}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSign, busy: sign.status === 'signing' }}
        >
          {sign.status === 'signing' ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>{sign.status === 'failed' ? 'Try again' : 'Sign & save'}</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

/** After signing: locked, patient moved to Done, visit in history. */
export function SignedBody({
  signedAt,
  version = 1,
  onQueue,
  onPatient,
  onEditNote,
}: {
  /** Time of the sign, or of the edit for version 2 and later. */
  signedAt: string;
  version?: number;
  onQueue: () => void;
  onPatient: () => void;
  /** DIG-97: reopen the note; the change is saved as the next version. */
  onEditNote?: () => void;
}) {
  const edited = version > 1;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.signed} accessibilityRole="alert">
        <Text style={styles.signedTitle}>{edited ? '✓ Edit saved' : '✓ Signed and saved'}</Text>
        <Text style={styles.signedBody}>
          {edited
            ? `Version ${version} · edited ${signedAt}. Earlier versions are kept.`
            : `Version 1 · signed ${signedAt}. The signed version is kept; edits are saved as new versions.`}
        </Text>
        <Text style={styles.signedBody}>
          {edited
            ? 'Everyone now sees this version. The patient stays Done.'
            : 'The patient has moved to Done and the visit is in their history.'}
        </Text>
      </View>
      <Pressable style={styles.primary} onPress={onQueue} accessibilityRole="button">
        <Text style={styles.primaryText}>Back to the queue</Text>
      </Pressable>
      <Pressable style={styles.outline} onPress={onPatient} accessibilityRole="button">
        <Text style={styles.outlineText}>Patient summary</Text>
      </Pressable>
      {onEditNote ? (
        <Pressable style={styles.outline} onPress={onEditNote} accessibilityRole="button">
          <Text style={styles.outlineText}>Edit note</Text>
        </Pressable>
      ) : null}
      <Text style={styles.note}>The A4 PDF, print and share arrive with DIG-73.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  failed: {
    backgroundColor: colors.errorContainer,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  failedTitle: { ...type.title, color: colors.onErrorContainer },
  failedBody: { ...type.body, color: colors.onErrorContainer },
  failedCode: { ...type.label, color: colors.onErrorContainer },
  version: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  versionText: { ...type.label, color: colors.onSecondaryContainer },
  blocking: {
    backgroundColor: colors.errorContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  blockingTitle: { ...type.bodyStrong, color: colors.onErrorContainer },
  blockingText: { ...type.body, color: colors.onErrorContainer },
  blockingHint: { ...type.label, color: colors.onErrorContainer },
  warnings: {
    backgroundColor: colors.warningContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  warningsTitle: { ...type.bodyStrong, color: colors.onWarningContainer },
  warningsText: { ...type.body, color: colors.onWarningContainer },
  doc: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.md,
  },
  section: { gap: spacing.xs },
  sectionTitle: { ...type.label, color: colors.primary, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  lineText: { ...type.body, color: colors.onSurface, flex: 1 },
  note: { ...type.label, color: colors.onSurfaceVariant },
  signed: {
    backgroundColor: colors.successContainer,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  signedTitle: { ...type.title, color: colors.onSuccessContainer },
  signedBody: { ...type.body, color: colors.onSuccessContainer },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  outline: {
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  outlineText: { ...type.labelLarge, color: colors.primary },
  primary: {
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryText: { ...type.labelLarge, color: colors.onPrimary },
});
