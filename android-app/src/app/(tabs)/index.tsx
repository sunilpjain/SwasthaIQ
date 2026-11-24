import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { QueueEntry } from '@swasthyaiq/shared';
import { api, useSession } from '../../auth/SessionProvider';
import ProfileMenu from '../../components/ProfileMenu';
import { openConsult } from '../../queue/open-consult';
import { queueStore as store } from '../../queue/queue-instance';
import type { QueueState } from '../../queue/queue-store';
import QueueRow, { SkeletonRow } from '../../queue/QueueRow';
import {
  counts,
  istDayLabel,
  rowModel,
  syncLine,
  tapAction,
  visibleEntries,
  type QueueFilter,
} from '../../queue/queue-view';
import { colors, MIN_TAP, radius, spacing, type } from '../../theme/tokens';

/** Queue · Today (DIG-47, hi-fi screen 2 and states S1–S4). */
export default function QueueScreen() {
  const router = useRouter();
  const { me } = useSession();
  const [state, setState] = useState<QueueState>(store.state);
  const [filter, setFilter] = useState<QueueFilter>('mine');
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => store.subscribe(setState), []);

  // Poll while this tab is on screen and the app is in the foreground.
  useFocusEffect(
    useCallback(() => {
      if (AppState.currentState === 'active') store.startPolling();
      const sub = AppState.addEventListener('change', (s) =>
        s === 'active' ? store.startPolling() : store.stopPolling(),
      );
      return () => {
        sub.remove();
        store.stopPolling();
      };
    }, []),
  );

  const n = counts(state.entries);
  const rows = useMemo(
    () =>
      visibleEntries(state.entries, filter, query).map((e) => ({
        entry: e,
        row: rowModel(e, me?.id ?? null, filter),
      })),
    [state.entries, filter, query, me?.id],
  );

  const goToPatient = useCallback(
    (patientId: string) => router.navigate({ pathname: '/patient', params: { id: patientId } }),
    [router],
  );

  const open = useCallback(
    async (entry: QueueEntry) => {
      if (tapAction(entry) === 'view') {
        goToPatient(entry.patient.id);
        return;
      }
      setOpening(entry.patient.id);
      try {
        if (await openConsult(entry.patient.id)) goToPatient(entry.patient.id);
      } finally {
        setOpening(null);
      }
    },
    [goToPatient],
  );

  const confirmReset = useCallback(() => {
    Alert.alert(
      'Reset today’s queue?',
      'Everyone goes back to Waiting (or Not arrived) with fresh times. Saved consults and visits are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset queue',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.resetQueue();
              await store.refresh();
            } catch {
              Alert.alert('Could not reset the queue', 'Nothing was changed. Please try again.');
            }
          },
        },
      ],
    );
  }, []);

  const searching = query.trim().length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Queue · Today
          </Text>
          <Text style={styles.headerSub}>
            {istDayLabel(new Date())}
            {me ? ` · ${me.displayName}` : ''}
          </Text>
        </View>
        <ProfileMenu variant="kebab" items={[{ label: 'Reset queue…', onPress: confirmReset }]} />
      </View>

      <View style={styles.controls}>
        <View style={styles.chips}>
          <Chip
            label={`My patients${state.loading ? '' : ` (${n.mine})`}`}
            selected={filter === 'mine'}
            onPress={() => setFilter('mine')}
          />
          <Chip
            label={`All${state.loading ? '' : ` (${n.all})`}`}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
        </View>
        <TextInput
          style={[styles.search, searching && styles.searchActive]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or phone"
          placeholderTextColor={colors.onSurfaceVariant}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search name or phone"
        />
        <View style={styles.syncLine}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: !state.lastSyncedAt
                  ? colors.primary
                  : state.online
                    ? colors.success
                    : colors.outline,
              },
            ]}
          />
          <Text style={styles.syncText}>{syncLine(state.online, state.lastSyncedAt)}</Text>
        </View>
        {state.error ? (
          <Text style={styles.error} accessibilityRole="alert">
            Could not refresh the queue ({state.error}). Pull down to try again.
          </Text>
        ) : null}
      </View>

      {state.loading ? (
        <View>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.row.key}
          renderItem={({ item }) => (
            <QueueRow row={item.row} onPress={() => (opening ? undefined : void open(item.entry))} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={() => void store.refresh(true)}
              colors={[colors.primary]}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={rows.length === 0 ? { flexGrow: 1 } : undefined}
          ListEmptyComponent={
            searching ? (
              <Empty
                glyph="👤"
                title={`No patient matches “${query.trim()}”`}
                body="Check the spelling, or search by the last 4 digits of the phone number. The search covers today’s queue."
                action="Clear search"
                onAction={() => setQuery('')}
              />
            ) : filter === 'mine' && n.all > 0 ? (
              <Empty
                glyph="☰"
                title="No patients booked for you yet"
                body="Patients appear here when the front desk books them. Pull down to refresh."
                action={`Show all patients (${n.all})`}
                onAction={() => setFilter('all')}
              />
            ) : (
              <Empty glyph="☰" title="No patients in today’s queue" body="Pull down to refresh." />
            )
          }
        />
      )}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && { color: colors.onPrimaryContainer }]}>
        {selected ? '✓  ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function Empty(p: { glyph: string; title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 32, color: colors.primary }}>{p.glyph}</Text>
      </View>
      <Text style={styles.emptyTitle}>{p.title}</Text>
      <Text style={styles.emptyBody}>{p.body}</Text>
      {p.action && p.onAction ? (
        <Pressable style={styles.emptyButton} onPress={p.onAction} accessibilityRole="button">
          <Text style={styles.emptyButtonText}>{p.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingLeft: spacing.md,
    paddingVertical: 6,
  },
  headerTitle: { ...type.titleLarge, color: colors.onPrimary },
  headerSub: { ...type.label, color: colors.onPrimary },
  controls: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { ...type.labelLarge, color: colors.onSurface },
  search: {
    ...type.body,
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.lg,
    color: colors.onSurface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchActive: { borderColor: colors.primary },
  syncLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  syncText: { ...type.label, color: colors.onSurfaceVariant },
  error: { ...type.label, color: colors.error },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...type.title, color: colors.onSurface, textAlign: 'center' },
  emptyBody: { ...type.body, color: colors.onSurfaceVariant, textAlign: 'center' },
  emptyButton: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    justifyContent: 'center',
  },
  emptyButtonText: { ...type.labelLarge, color: colors.primary },
});
