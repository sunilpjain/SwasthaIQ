import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SummaryDocument } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { api } from '../auth/SessionProvider';
import { savePdf } from '../summary/pdf-files';
import { printCopyInput, toEditable, type EditableSummary } from '../summary/print-copy';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';

/**
 * "Edit print copy" (DIG-73): reword or shorten the text so the patient can read it. The edits
 * apply to this printout only and are never written back to the consultation record.
 */
export default function PrintCopyScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<SummaryDocument | null>(null);
  const [edit, setEdit] = useState<EditableSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [making, setMaking] = useState(false);

  const start = useCallback(async () => {
    if (!visitId) return;
    setFailed(false);
    try {
      const d = await api.summary(visitId);
      setDoc(d);
      setEdit(toEditable(d));
    } catch {
      setFailed(true);
    }
  }, [visitId]);

  useEffect(() => {
    void start();
  }, [start]);

  async function make() {
    if (!doc || !edit || !visitId) return;
    setMaking(true);
    try {
      const bytes = await api.printCopyPdf(visitId, printCopyInput(doc, edit));
      const uri = await savePdf(bytes, `print-copy-${visitId}-v${doc.version}.pdf`);
      router.replace({ pathname: '/summary', params: { visitId, file: uri, version: String(doc.version) } });
    } catch (e) {
      const stale = e instanceof ApiError && e.code === 'print_copy_stale';
      Alert.alert(
        stale ? 'The visit has changed' : 'Print copy not made',
        stale ? 'Open the print copy again to edit the latest version.' : 'Nothing was changed. Try again.',
      );
    } finally {
      setMaking(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
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
            Edit print copy
          </Text>
          <Text style={styles.sub}>{doc ? `Version ${doc.version} · this printout only` : 'Loading…'}</Text>
        </View>
      </View>
      {!edit || !doc ? (
        <View style={styles.center}>
          {failed ? (
            <Pressable style={styles.outline} onPress={() => void start()} accessibilityRole="button">
              <Text style={styles.outlineText}>Try again</Text>
            </Pressable>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Reword or shorten anything so the patient can read it. The changes go on this printout only:
                the consultation record is not changed. The PDF footer will say “print copy edited”.
              </Text>
            </View>
            {doc.sections.map((s) =>
              s.medicines ? (
                <View key={s.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  {s.medicines.map((m) => (
                    <View key={m.id} style={styles.med}>
                      <Text style={styles.medTitle}>{m.drug}</Text>
                      <TextInput
                        style={styles.input}
                        multiline
                        value={edit.medicines[m.id]?.instruction ?? ''}
                        onChangeText={(v) =>
                          setEdit({
                            ...edit,
                            medicines: {
                              ...edit.medicines,
                              [m.id]: { ...edit.medicines[m.id]!, instruction: v },
                            },
                          })
                        }
                        accessibilityLabel={`Instruction for ${m.drug}`}
                      />
                      {edit.medicines[m.id]?.local !== null ? (
                        <TextInput
                          style={styles.input}
                          multiline
                          value={edit.medicines[m.id]?.local ?? ''}
                          onChangeText={(v) =>
                            setEdit({
                              ...edit,
                              medicines: {
                                ...edit.medicines,
                                [m.id]: { ...edit.medicines[m.id]!, local: v },
                              },
                            })
                          }
                          accessibilityLabel={`Local-language line for ${m.drug}`}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View key={s.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <TextInput
                    style={styles.input}
                    multiline
                    value={edit.sections[s.id] ?? ''}
                    onChangeText={(v) => setEdit({ ...edit, sections: { ...edit.sections, [s.id]: v } })}
                    accessibilityLabel={s.title}
                  />
                </View>
              ),
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              style={[styles.outline, { flex: 1 }]}
              onPress={() => setEdit(toEditable(doc))}
              accessibilityRole="button"
            >
              <Text style={styles.outlineText}>Undo changes</Text>
            </Pressable>
            <Pressable
              style={[styles.primary, { flex: 1.3 }, making && { opacity: 0.6 }]}
              onPress={() => void make()}
              disabled={making}
              accessibilityRole="button"
            >
              {making ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryText}>Make print copy</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md },
  banner: { backgroundColor: colors.secondaryContainer, borderRadius: radius.lg, padding: spacing.md },
  bannerText: { ...type.body, color: colors.onSecondaryContainer },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  cardTitle: { ...type.title, color: colors.onSurface },
  med: { gap: spacing.xs },
  medTitle: { ...type.bodyStrong, color: colors.onSurface },
  input: {
    ...type.body,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.onSurface,
    textAlignVertical: 'top',
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
