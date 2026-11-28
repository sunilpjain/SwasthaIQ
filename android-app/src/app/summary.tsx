import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError } from '../api/client';
import { api, useSession } from '../auth/SessionProvider';
import { printPdf, savePdf, sharePdf } from '../summary/pdf-files';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';

type Load =
  | { status: 'loading' }
  | { status: 'error'; offline: boolean }
  | { status: 'ready'; uri: string; version: number; signed: boolean; mine: boolean };

/**
 * The A4 consultation summary with the prescription (DIG-73): preview in the app, share through
 * the Android share sheet, print, or reword a print copy. `file` is a print copy just made.
 */
export default function SummaryScreen() {
  const { visitId, file, version } = useLocalSearchParams<{
    visitId: string;
    file?: string;
    version?: string;
  }>();
  const router = useRouter();
  const { me } = useSession();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const edited = !!file;

  const start = useCallback(async () => {
    if (!visitId || !me) return;
    setLoad({ status: 'loading' });
    try {
      const v = await api.visit(visitId);
      const mine = v.doctorId === me.id;
      if (file) {
        setLoad({
          status: 'ready',
          uri: file,
          version: Number(version ?? v.version),
          signed: v.status === 'signed',
          mine,
        });
        return;
      }
      const bytes = await api.summaryPdf(visitId);
      const uri = await savePdf(bytes, `summary-${visitId}-v${v.version}.pdf`);
      setLoad({ status: 'ready', uri, version: v.version, signed: v.status === 'signed', mine });
    } catch (e) {
      setLoad({ status: 'error', offline: e instanceof ApiError && e.code === 'network' });
    }
  }, [visitId, file, version, me]);

  useEffect(() => {
    void start();
  }, [start]);

  async function act(what: 'share' | 'print', uri: string) {
    try {
      await (what === 'share' ? sharePdf(uri) : printPdf(uri));
    } catch {
      Alert.alert(what === 'share' ? 'Could not share' : 'Could not print', 'Try again.');
    }
  }

  const title =
    load.status !== 'ready'
      ? 'A4 summary'
      : `${load.signed ? `Version ${load.version}` : 'Draft preview'}${edited ? ' · print copy edited' : ''}`;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">
            Consultation summary
          </Text>
          <Text style={styles.sub}>{title}</Text>
        </View>
      </View>

      {load.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.note}>Preparing the A4…</Text>
        </View>
      ) : load.status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{load.offline ? 'No connection' : 'Could not open the A4'}</Text>
          <Pressable style={styles.outline} onPress={() => void start()} accessibilityRole="button">
            <Text style={styles.outlineText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pdf
            source={{ uri: load.uri, cache: false }}
            style={styles.pdf}
            trustAllCerts={false}
            onError={() => setLoad({ status: 'error', offline: false })}
          />
          {!load.signed ? (
            <Text style={styles.draftNote}>Draft preview. Sign the consult to lock it as version 1.</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              style={[styles.primary, { flex: 1 }]}
              onPress={() => void act('share', load.uri)}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.outline, { flex: 1 }]}
              onPress={() => void act('print', load.uri)}
              accessibilityRole="button"
            >
              <Text style={styles.outlineText}>Print</Text>
            </Pressable>
            {load.mine ? (
              <Pressable
                style={[styles.outline, { flex: 1.4 }]}
                onPress={() => router.push({ pathname: '/print-copy', params: { visitId } })}
                accessibilityRole="button"
              >
                <Text style={styles.outlineText}>Edit print copy</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceContainer },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    padding: spacing.sm,
  },
  back: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 26, color: colors.onPrimary },
  title: { ...type.titleLarge, color: colors.onPrimary },
  sub: { ...type.label, color: colors.onPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorTitle: { ...type.title, color: colors.onSurface },
  note: { ...type.label, color: colors.onSurfaceVariant },
  pdf: { flex: 1, backgroundColor: colors.surfaceContainer },
  draftNote: {
    ...type.label,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    padding: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  primary: {
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...type.labelLarge, color: colors.onPrimary },
  outline: {
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  outlineText: { ...type.labelLarge, color: colors.primary },
});
