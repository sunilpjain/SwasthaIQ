import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PatientDetail } from '@swasthyaiq/shared';
import { ApiError } from '../../api/client';
import { api, useSession } from '../../auth/SessionProvider';
import Placeholder from '../../components/Placeholder';
import ProfileMenu from '../../components/ProfileMenu';
import Card, { cardStyles } from '../../patient/Card';
import ConditionsCard from '../../patient/ConditionsCard';
import {
  currentMedicineRows,
  doctorLabel,
  labFlag,
  labText,
  lastVisitLines,
  maskPhone,
  pendingText,
  sharedLabel,
  shortDate,
  visitStatusLine,
} from '../../patient/summary-view';
import { openConsult } from '../../queue/open-consult';
import { queueStore } from '../../queue/queue-instance';
import { istTime } from '../../queue/queue-view';
import { colors, MIN_TAP, radius, spacing, type } from '../../theme/tokens';

type Load =
  { status: 'loading' } | { status: 'error'; offline: boolean } | { status: 'ready'; data: PatientDetail };

/** Patient summary (DIG-48, hi-fi screen 3): everything the doctor needs before the consult. */
export default function PatientScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [, setQueueTick] = useState(0);

  // The header's appointment and check-in times come from the queue.
  useEffect(() => queueStore.subscribe(() => setQueueTick((n) => n + 1)), []);

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    try {
      setLoad({ status: 'ready', data: await api.patient(id) });
    } catch (e) {
      setLoad({ status: 'error', offline: e instanceof ApiError && e.code === 'network' });
    }
  }, [id]);

  useEffect(() => {
    setLoad({ status: 'loading' });
    void fetchPatient();
  }, [fetchPatient]);

  if (!id) {
    return (
      <Placeholder title="Patient" sprint="the Queue tab">
        <Text style={cardStyles.empty}>Pick a patient in the Queue tab to see their summary.</Text>
      </Placeholder>
    );
  }
  if (load.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={cardStyles.empty}>Loading the patient summary…</Text>
      </View>
    );
  }
  if (load.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{load.offline ? 'No connection' : 'Could not load the patient'}</Text>
        <Text style={cardStyles.empty}>Nothing was changed.</Text>
        <Pressable
          style={styles.outlineButton}
          onPress={() => void fetchPatient()}
          accessibilityRole="button"
        >
          <Text style={styles.outlineText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const d = load.data;
  const p = d.patient;
  const myId = me?.id ?? null;
  const entry = queueStore.state.entries.find((e) => e.patient.id === p.id);
  const status = entry
    ? visitStatusLine(istTime(entry.appointmentAt), entry.checkedInAt ? istTime(entry.checkedInAt) : null)
    : null;
  const withMe = entry?.status === 'in_consult' && entry.inConsultWithUserId === myId;
  // DIG-96: the other doctor's patients are view-only.
  const mine = p.primaryDoctorId === myId;
  const shared = sharedLabel(d.visits, myId);
  const meds = currentMedicineRows(d.currentMedicines, myId);
  const last = lastVisitLines(d, myId);
  const subtitle = [maskPhone(p.phone), entry?.doctorName].filter(Boolean).join(' · ');

  async function startConsult() {
    setStarting(true);
    try {
      if (withMe || (await openConsult(p.id)))
        router.navigate({ pathname: '/consult', params: { id: p.id } });
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.navigate('/')}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back to the queue"
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} accessibilityRole="header">
              {p.fullName} · {p.ageYears} {p.sex}
            </Text>
            {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
          </View>
          <ProfileMenu variant="kebab" />
        </View>
        {p.allergies.length > 0 ? (
          <View style={styles.allergy} accessibilityRole="alert">
            <Text style={styles.allergyText}>Allergy: {p.allergies.join(', ')}</Text>
          </View>
        ) : (
          <Text style={styles.headerSub}>No known allergies</Text>
        )}
        {status ? <Text style={styles.headerStatus}>{status}</Text> : null}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchPatient();
              setRefreshing(false);
            }}
          />
        }
      >
        {shared ? (
          <View style={styles.shared}>
            <Text style={styles.sharedText}>{shared}</Text>
          </View>
        ) : null}

        <ConditionsCard patientId={p.id} conditions={d.conditions} onChanged={() => void fetchPatient()} />

        <Card title="Current medicines">
          {meds.length === 0 ? <Text style={cardStyles.empty}>No current medicines.</Text> : null}
          {meds.map((m) => (
            <View key={m.key} style={cardStyles.line}>
              <Text style={cardStyles.lineText}>{m.text}</Text>
              <Text style={cardStyles.lineSide}>{m.by}</Text>
            </View>
          ))}
        </Card>

        <Card
          title="Last visit"
          action={d.visits.length ? 'Timeline' : undefined}
          onAction={() => setTimelineOpen(true)}
        >
          {last ? (
            <>
              <Text style={styles.meta}>{last.meta}</Text>
              <Text style={styles.diagnosis}>{last.diagnosis}</Text>
              {last.rx ? <Text style={cardStyles.lineText}>{last.rx}</Text> : null}
            </>
          ) : (
            <Text style={cardStyles.empty}>No previous visits. This is the patient’s first visit.</Text>
          )}
        </Card>

        <Card title="Latest labs">
          {d.latestLabs.length === 0 ? <Text style={cardStyles.empty}>No lab results yet.</Text> : null}
          {d.latestLabs.map((l) => {
            const flag = labFlag(l);
            return (
              <View key={l.testCode} style={cardStyles.line}>
                <Text style={cardStyles.lineText}>
                  {labText(l)}
                  <Text style={styles.labDate}> {shortDate(l.reportDate)}</Text>
                </Text>
                <Text style={[styles.flag, flag.tone !== 'normal' && { color: colors.error }]}>
                  {flag.label}
                </Text>
              </View>
            );
          })}
          {d.pendingTests.map((t) => (
            <View key={`${t.visitId}-${t.testName}`} style={styles.pending}>
              <Text style={styles.pendingText}>Pending: {pendingText(t)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[styles.outlineButton, { flex: 1 }]}
          onPress={() => setTimelineOpen(true)}
          disabled={d.visits.length === 0}
          accessibilityRole="button"
        >
          <Text style={[styles.outlineText, d.visits.length === 0 && { color: colors.onSurfaceVariant }]}>
            Timeline
          </Text>
        </Pressable>
        {mine ? (
          <Pressable
            style={[styles.primaryButton, { flex: 1.3 }, starting && { opacity: 0.6 }]}
            onPress={() => void startConsult()}
            disabled={starting}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{withMe ? 'Continue consult' : 'Start consult'}</Text>
          </Pressable>
        ) : (
          <View style={[styles.viewOnly, { flex: 1.3 }]} accessibilityRole="text">
            <Text style={styles.viewOnlyText}>
              Booked with {entry?.doctorName ?? 'the other doctor'} · view only
            </Text>
          </View>
        )}
      </View>

      <Modal visible={timelineOpen} animationType="slide" onRequestClose={() => setTimelineOpen(false)}>
        <View style={styles.screen}>
          <View style={[styles.header, styles.headerTop]}>
            <Pressable
              onPress={() => setTimelineOpen(false)}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Close the timeline"
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.name}>Visits · {p.fullName}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {d.visits.map((v) => (
              <View key={v.id} style={styles.visit}>
                <Text style={styles.meta}>
                  {shortDate(v.visitDate, true)} · {doctorLabel(v.doctorId, v.doctorName, myId)}
                  {v.status === 'draft' ? ' · Draft' : ''}
                  {v.version > 1 ? ` · amended (v${v.version})` : ''}
                </Text>
                <Text style={styles.diagnosis}>{v.diagnosis ?? 'No diagnosis recorded'}</Text>
              </View>
            ))}
            <Text style={cardStyles.empty}>Opening a full visit record arrives with DIG-49.</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceContainer },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorTitle: { ...type.title, color: colors.onSurface },
  header: { backgroundColor: colors.primary, padding: spacing.md, gap: spacing.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 26, color: colors.onPrimary },
  name: { ...type.titleLarge, color: colors.onPrimary },
  headerSub: { ...type.label, color: colors.onPrimary },
  headerStatus: { ...type.bodyStrong, color: colors.onPrimary, marginLeft: MIN_TAP + spacing.sm },
  allergy: {
    alignSelf: 'flex-start',
    marginLeft: MIN_TAP + spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  allergyText: { ...type.bodyStrong, color: colors.onErrorContainer },
  body: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  shared: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  sharedText: { ...type.body, color: colors.onSurface },
  meta: { ...type.label, color: colors.onSurfaceVariant },
  diagnosis: { ...type.bodyStrong, color: colors.onSurface },
  labDate: { ...type.label, color: colors.onSurfaceVariant },
  flag: { ...type.label, color: colors.onSurfaceVariant, paddingTop: 2 },
  pending: { backgroundColor: colors.warningContainer, borderRadius: radius.md, padding: spacing.md },
  pendingText: { ...type.body, color: colors.onWarningContainer },
  visit: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  outlineButton: {
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
  primaryButton: {
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryText: { ...type.labelLarge, color: colors.onPrimary },
  viewOnly: {
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  viewOnlyText: { ...type.label, color: colors.onSurfaceVariant, textAlign: 'center' },
});
