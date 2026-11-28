import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { InvestigationOrder, PatientDetail, Specialty, VisitDetail } from '@swasthyaiq/shared';
import { ApiError } from '../../api/client';
import { api, useSession } from '../../auth/SessionProvider';
import Placeholder from '../../components/Placeholder';
import ProfileMenu from '../../components/ProfileMenu';
import {
  appendPhrase,
  FIELD,
  FOLLOW_UP_OPTIONS,
  followUpDate,
  followUpLabel,
  GENERAL_EXAM_CHIPS,
  hasPhrase,
  INVESTIGATION_CHIPS,
  toggleInvestigation,
  VITALS,
  vitalWarning,
} from '../../consult/consult-fields';
import { isSameDayEdit } from '../../consult/amend';
import { forgetDraft, getDraft, keepDraft } from '../../consult/draft-registry';
import { buildReview, signErrorCode } from '../../consult/review';
import { ReviewBody, SignedBody, type SignState } from '../../consult/ReviewBody';
import { DraftStore, saveStatusLine, type DraftState } from '../../consult/draft-store';
import Chip from '../../consult/Chip';
import DiagnosisSection from '../../consult/DiagnosisSection';
import { suggestDiagnoses } from '../../consult/icd10/suggestions';
import PhraseChips from '../../consult/PhraseChips';
import { allergyEntries, checkRx, overridesFor } from '../../consult/rx/rx-checks';
import RxSection, { cachedMedicines } from '../../consult/rx/RxSection';
import { doctorLabel } from '../../patient/summary-view';
import {
  ALLERGY_CHIPS,
  appendDuration,
  COMPLAINT_CHIPS,
  DURATION_CHIPS,
  FAMILY_SOCIAL_CHIPS,
  NO_KNOWN_ALLERGIES,
  PROCEDURE_CHIPS,
} from '../../consult/pick-lists';
import { GastroExamCard, GastroPlanChips } from '../../consult/GastroSections';
import { addEyeTag } from '../../consult/eye-fields';
import {
  DilatationCard,
  ExamCard,
  EyeTagChips,
  IopCard,
  PhotosCard,
  PurposeCard,
  SurgeryCard,
  VisionCard,
} from '../../consult/EyeSections';
import FieldBox, { SourceBadge } from '../../consult/FieldBox';
import Card, { cardStyles } from '../../patient/Card';
import { queueStore } from '../../queue/queue-instance';
import { istTime } from '../../queue/queue-view';
import { colors, MIN_TAP, radius, spacing, type } from '../../theme/tokens';

const SPECIALTY_OPD: Record<Specialty, string> = { gastro: 'Gastro OPD', eye: 'Eye OPD' };

type Load =
  | { status: 'loading' }
  | { status: 'error'; offline: boolean }
  | { status: 'ready'; patient: PatientDetail; draft: DraftStore; editing: VisitDetail | null };

/** Today's draft by this doctor for this patient, if one was started earlier. */
async function openDraft(
  patientId: string,
  myUserId: string,
): Promise<{ patient: PatientDetail; draft: DraftStore }> {
  const patient = await api.patient(patientId);
  const kept = getDraft(patientId);
  if (kept) return { patient, draft: kept };
  const existing = patient.visits.find((v) => v.status === 'draft' && v.doctorId === myUserId);
  const draft = existing
    ? new DraftStore(api, { visitId: existing.id, patientId, existing: await api.visit(existing.id) })
    : new DraftStore(api, { visitId: Crypto.randomUUID(), patientId });
  keepDraft(patientId, draft);
  return { patient, draft };
}

/** DIG-97: a signed visit reopened in the form, pre-filled with its latest version. */
async function openEdit(
  patientId: string,
  visitId: string,
  myUserId: string,
): Promise<{ patient: PatientDetail; draft: DraftStore; editing: VisitDetail }> {
  const [patient, visit] = await Promise.all([api.patient(patientId), api.visit(visitId)]);
  if (visit.status !== 'signed' || visit.doctorId !== myUserId) {
    throw new ApiError(403, 'not_your_visit', 'Only the doctor who signed it can edit this visit');
  }
  const draft = new DraftStore(api, { visitId, patientId, existing: visit, edit: true });
  return { patient, draft, editing: visit };
}

/** Consult note, typed (DIG-50, hi-fi screen 4). Specialty sections arrive with DIG-51/52. */
export default function ConsultScreen() {
  const { id, edit } = useLocalSearchParams<{ id?: string; edit?: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [state, setState] = useState<DraftState | null>(null);
  const [newTest, setNewTest] = useState('');
  // DIG-95: edit the note, review it, then sign.
  const [mode, setMode] = useState<'edit' | 'review' | 'signed'>('edit');
  const [sign, setSign] = useState<SignState>({ status: 'idle' });
  const [signedAt, setSignedAt] = useState('');
  // DIG-97: the version just saved, and the reason typed for an edit after the signing day.
  const [savedVersion, setSavedVersion] = useState(1);
  const [reason, setReason] = useState('');
  const [needReason, setNeedReason] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const amendmentId = useRef<string | null>(null);
  // Re-run the Rx checks once the medicine catalogue has loaded (DIG-71).
  const [, setCatalogueReady] = useState(0);
  useEffect(() => {
    setMode('edit');
    setSign({ status: 'idle' });
    setReason('');
    setNeedReason(false);
    setSavedVersion(1);
    amendmentId.current = null;
  }, [id, edit]);

  const start = useCallback(async () => {
    if (!id || !me) return;
    setLoad({ status: 'loading' });
    try {
      if (edit) {
        const { patient, draft, editing } = await openEdit(id, edit, me.id);
        setState(draft.state);
        setLoad({ status: 'ready', patient, draft, editing });
      } else {
        const { patient, draft } = await openDraft(id, me.id);
        setState(draft.state);
        setLoad({ status: 'ready', patient, draft, editing: null });
      }
    } catch (e) {
      setLoad({ status: 'error', offline: e instanceof ApiError && e.code === 'network' });
    }
  }, [id, edit, me]);

  useEffect(() => {
    void start();
  }, [start]);

  const draft = load.status === 'ready' ? load.draft : null;
  useEffect(() => (draft ? draft.subscribe(setState) : undefined), [draft]);

  // Save straight away when the doctor leaves the screen or the app goes to the background.
  useFocusEffect(
    useCallback(() => {
      const sub = AppState.addEventListener('change', (s) => {
        if (s !== 'active') void draft?.flush();
      });
      return () => {
        sub.remove();
        void draft?.flush();
      };
    }, [draft]),
  );

  if (!id) {
    return (
      <Placeholder title="Consult" sprint="the Queue tab">
        <Text style={cardStyles.empty}>Start a consult from the queue or a patient summary.</Text>
      </Placeholder>
    );
  }
  if (load.status === 'loading' || !state || !me) {
    if (load.status === 'error') {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            {load.offline ? 'No connection' : 'Could not open the consult'}
          </Text>
          <Text style={cardStyles.empty}>Nothing was lost.</Text>
          <Pressable style={styles.outlineButton} onPress={() => void start()} accessibilityRole="button">
            <Text style={styles.outlineText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (load.status !== 'ready') return null;

  const d = load.draft;
  const p = load.patient.patient;
  const now = new Date();
  const readOnly = state.status === 'signed';
  const editing = load.editing;
  const sameDay = editing ? isSameDayEdit(editing.signedAt, now) : true;
  const askReason = !!editing && (!sameDay || needReason);
  // DIG-71: advisory checks against the allergies and the other doctor's current Rx.
  const rxWarnings = checkRx({
    lines: state.rxLines,
    catalogue: cachedMedicines(),
    allergies: allergyEntries(p.allergies, d.value(FIELD.allergies)),
    otherRx: load.patient.currentMedicines
      .filter((r) => r.doctorId !== me.id)
      .map((r) => ({ by: doctorLabel(r.doctorId, r.doctorName, me.id), lines: r.lines })),
  });
  const field = (key: string) => state.fields[key];
  const entry = queueStore.state.entries.find((e) => e.patient.id === p.id);
  const specialty: Specialty = me.specialty ?? 'gastro';
  const tests = INVESTIGATION_CHIPS[specialty];
  const extraTests = state.investigations.filter(
    (t) => !tests.some((c) => c.testName.toLowerCase() === t.testName.toLowerCase()),
  );
  const generalExam = d.value(FIELD.generalExam);
  const eye = specialty === 'eye';

  const text = (key: string, label: string, placeholder?: string) => (
    <FieldBox
      label={label}
      value={d.value(key)}
      source={field(key)?.source}
      onChange={(v) => d.setField(key, v)}
      placeholder={placeholder}
      editable={!readOnly}
    />
  );

  /** DIG-99: a picked allergy also goes onto the patient's list (shown on every screen). */
  async function addAllergy(name: string) {
    if (name === NO_KNOWN_ALLERGIES || p.allergies.some((a) => a.toLowerCase() === name.toLowerCase()))
      return;
    try {
      const { allergies } = await api.addAllergy(p.id, name);
      setLoad((l) =>
        l.status === 'ready'
          ? { ...l, patient: { ...l.patient, patient: { ...l.patient.patient, allergies } } }
          : l,
      );
    } catch {
      Alert.alert(
        'Allergy not added to the list',
        'It is in the note. Try picking it again when you are online.',
      );
    }
  }

  const vitalsCard = (
    <Card title="Vitals">
      <View style={styles.vitals}>
        {VITALS.map((v) => {
          const value = d.value(v.key);
          const warning = vitalWarning(v.key, value);
          return (
            <View key={v.key} style={[styles.vital, warning && { borderColor: colors.warning }]}>
              <Text style={styles.vitalLabel}>
                {v.label} <Text style={styles.vitalUnit}>{v.unit}</Text>
              </Text>
              <TextInput
                style={styles.vitalInput}
                value={value}
                onChangeText={(t) => d.setField(v.key, t)}
                keyboardType={v.keyboard}
                maxLength={v.maxLength}
                placeholder={v.placeholder}
                placeholderTextColor={colors.onSurfaceVariant}
                editable={!readOnly}
                accessibilityLabel={`${v.label} in ${v.unit}`}
              />
              {warning ? <Text style={styles.vitalWarning}>{warning}</Text> : null}
            </View>
          );
        })}
      </View>
      {Object.keys(state.fields).some((k) => k.startsWith('vitals.')) ? <SourceBadge source="typed" /> : null}
    </Card>
  );

  /**
   * Saves anything unsaved, then signs. If the save or the sign fails, nothing is lost: the note
   * stays a draft and the patient stays In consult (hi-fi state S9).
   */
  async function signNow() {
    setSign({ status: 'signing' });
    const failed = (status: number, code: string) =>
      setSign({
        status: 'failed',
        code: signErrorCode(status, code),
        at: istTime(new Date().toISOString()),
        offline: code === 'network' || d.state.status === 'offline',
      });
    await d.flush();
    if (d.state.unsaved > 0) {
      failed(0, d.state.status === 'offline' ? 'network' : 'not_saved');
      return;
    }
    try {
      const v = await api.signVisit(d.state.visitId, { overrides: overridesFor(rxWarnings) });
      d.markSigned();
      forgetDraft(p.id);
      void queueStore.refresh();
      setSignedAt(v.signedAt ? istTime(v.signedAt) : istTime(new Date().toISOString()));
      setMode('signed');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'sign_blocked') {
        const problems = Array.isArray(e.details.problems) ? (e.details.problems as { code: string }[]) : [];
        setSign({
          status: 'blocked',
          problems: problems.map((x) =>
            x.code === 'no_diagnosis'
              ? 'Add at least one diagnosis (ICD-10 or Misc).'
              : x.code === 'rx_eye_missing'
                ? 'Choose the eye (OD, OS or OU) for every eye medicine.'
                : 'Confirm the dictated or scanned values.',
          ),
        });
      } else if (e instanceof ApiError) {
        failed(e.status, e.code);
      } else {
        failed(0, 'unknown');
      }
    }
  }

  /** DIG-97: saves the changes as the next version. The same id is reused on a retry. */
  async function saveEdit() {
    if (!editing) return;
    amendmentId.current ??= Crypto.randomUUID();
    const input = d.amendment(amendmentId.current, askReason ? reason : undefined);
    if (input?.rxLines?.some((l) => l.route === 'eye' && !l.eye)) {
      Alert.alert('Choose the eye', 'Pick OD, OS or OU for every eye medicine, then save.');
      return;
    }
    if (input && rxWarnings.length) input.overrides = overridesFor(rxWarnings);
    if (!input) {
      Alert.alert('Nothing changed', 'Change the note, then save it as a new version.');
      return;
    }
    setSavingEdit(true);
    try {
      const v = await api.amendVisit(editing.id, input);
      d.markSigned();
      amendmentId.current = null;
      setSavedVersion(v.version);
      setSignedAt(istTime(v.editedAt ?? new Date().toISOString()));
      setMode('signed');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'reason_required') {
        setNeedReason(true);
        Alert.alert(
          'Reason needed',
          'This visit was signed on an earlier day. Type a reason for the change.',
        );
      } else {
        const offline = e instanceof ApiError && e.code === 'network';
        Alert.alert(
          offline ? 'No connection' : 'Edit not saved',
          'Nothing was lost. The signed note is unchanged; try Save again.',
        );
      }
    } finally {
      setSavingEdit(false);
    }
  }

  const visitId = d.state.visitId;
  const editAgain = () => {
    if (edit === visitId) {
      setMode('edit');
      void start();
    } else {
      router.navigate({ pathname: '/consult', params: { id: p.id, edit: visitId } });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.navigate({ pathname: '/patient', params: { id: p.id } })}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back to the patient summary"
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} accessibilityRole="header">
              {p.fullName} · {p.ageYears} {p.sex}
            </Text>
            <Text style={styles.headerSub}>
              {mode === 'signed'
                ? 'Signed'
                : editing
                  ? `Editing v${editing.version}`
                  : mode === 'edit'
                    ? 'Consult'
                    : 'Review'}{' '}
              · {me.displayName} · {SPECIALTY_OPD[specialty]}
            </Text>
          </View>
          <ProfileMenu variant="kebab" />
        </View>
        <Text style={[styles.headerSub, styles.indent]}>
          {p.allergies.length ? `Allergy: ${p.allergies.join(', ')}` : 'No known allergies'}
          {entry ? ` · Appt ${istTime(entry.appointmentAt)}` : ''}
        </Text>
      </View>

      {mode === 'review' ? (
        <ReviewBody
          review={buildReview({
            specialty,
            fields: state.fields,
            diagnoses: state.diagnoses,
            investigations: state.investigations,
            rxLines: state.rxLines,
            rxWarnings: rxWarnings.map((w) => w.text),
            followUp: state.followUp,
            knownAllergies: p.allergies,
            now,
          })}
          sign={sign}
          onEdit={() => {
            setSign({ status: 'idle' });
            setMode('edit');
          }}
          onSign={() => void signNow()}
        />
      ) : mode === 'signed' ? (
        <SignedBody
          signedAt={signedAt}
          version={savedVersion}
          onEditNote={editAgain}
          onQueue={() => router.navigate('/')}
          onPatient={() => router.navigate({ pathname: '/patient', params: { id: p.id } })}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {editing ? (
              <View style={styles.editBanner} accessibilityRole="alert">
                <Text style={styles.editTitle}>
                  Editing version {editing.version} · saves as version {editing.version + 1}
                </Text>
                <Text style={styles.editBody}>
                  {sameDay && !needReason
                    ? 'Same-day edit: no reason needed until midnight.'
                    : 'Signed on an earlier day: give a reason for the change.'}{' '}
                  The signed version is kept.
                </Text>
                {askReason ? (
                  <TextInput
                    style={styles.reasonInput}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Reason, e.g. lab report came back"
                    placeholderTextColor={colors.onSurfaceVariant}
                    maxLength={500}
                    accessibilityLabel="Reason for the change"
                  />
                ) : null}
              </View>
            ) : (
              <>
                <View style={styles.modes}>
                  <ModeButton label="Dictate" disabled />
                  <ModeButton label="Scan" disabled />
                  <ModeButton label="Type" selected />
                </View>
                <Text style={styles.caption}>
                  {saveStatusLine(state, istTime)} · Dictate and Scan arrive in Sprint 3
                </Text>
              </>
            )}

            {eye ? <PurposeCard d={d} readOnly={readOnly} /> : null}

            <Card title={eye ? 'Main complaints & history' : 'Chief complaint & history'}>
              {eye ? (
                <EyeTagChips
                  readOnly={readOnly}
                  onTag={(tag) => d.setField(FIELD.complaint, addEyeTag(d.value(FIELD.complaint), tag))}
                />
              ) : null}
              <PhraseChips
                d={d}
                field={FIELD.complaint}
                options={COMPLAINT_CHIPS[specialty]}
                readOnly={readOnly}
              />
              <PhraseChips
                d={d}
                field={FIELD.complaint}
                options={DURATION_CHIPS}
                readOnly={readOnly}
                label="Duration"
                join={appendDuration}
              />
              {text(
                FIELD.complaint,
                eye ? 'Complaint and history (per eye)' : 'Complaint and history',
                eye
                  ? 'OS: blurred vision for 6 months, gradual, worsening'
                  : 'What brings the patient, since when, how it has changed',
              )}
            </Card>

            <Card title="Health history">
              {text(
                FIELD.pastMedical,
                'Past medical history',
                'e.g. Type 2 diabetes for 8 years, on metformin',
              )}
              <PhraseChips
                d={d}
                field={FIELD.procedures}
                options={PROCEDURE_CHIPS[specialty]}
                readOnly={readOnly}
              />
              {text(FIELD.procedures, 'Past procedures and surgeries')}
              <Text style={styles.known}>
                Known allergies: {p.allergies.length ? p.allergies.join(', ') : 'none recorded'}
              </Text>
              <PhraseChips
                d={d}
                field={FIELD.allergies}
                options={ALLERGY_CHIPS}
                readOnly={readOnly}
                onPick={(a) => void addAllergy(a)}
              />
              {text(FIELD.allergies, 'Allergy (anything new or more detail)')}
              <PhraseChips
                d={d}
                field={FIELD.familySocial}
                options={FAMILY_SOCIAL_CHIPS}
                readOnly={readOnly}
              />
              {text(
                FIELD.familySocial,
                'Family and social history',
                'e.g. Father diabetic; non-smoker; no alcohol',
              )}
            </Card>

            {!eye ? vitalsCard : null}

            {eye ? (
              <>
                <VisionCard d={d} readOnly={readOnly} />
                <IopCard d={d} readOnly={readOnly} />
                <ExamCard d={d} readOnly={readOnly} />
                <DilatationCard d={d} readOnly={readOnly} />
                <PhotosCard />
              </>
            ) : (
              <>
                <Card title="General examination">
                  <Text style={styles.chipLabel}>Tap to add</Text>
                  <View style={styles.chips}>
                    {GENERAL_EXAM_CHIPS.map((c) => (
                      <Chip
                        key={c}
                        label={c}
                        selected={hasPhrase(generalExam, c)}
                        disabled={readOnly}
                        onPress={() => d.setField(FIELD.generalExam, appendPhrase(generalExam, c))}
                      />
                    ))}
                  </View>
                  {text(FIELD.generalExam, 'General examination notes')}
                </Card>

                <GastroExamCard d={d} readOnly={readOnly} />
              </>
            )}

            <Card title="Assessment & diagnosis">
              <DiagnosisSection
                diagnoses={state.diagnoses}
                onChange={(list) => d.setDiagnoses(list)}
                specialty={specialty}
                today={followUpDate(0, now)}
                readOnly={readOnly}
                suggestions={suggestDiagnoses({
                  specialty,
                  fields: state.fields,
                  conditions: load.patient.conditions,
                  visits: load.patient.visits,
                  chosen: state.diagnoses,
                  myUserId: me.id,
                })}
              />
              {text(FIELD.assessment, 'Assessment', 'e.g. Likely GERD; rule out gallstones')}
            </Card>

            {eye ? <SurgeryCard d={d} readOnly={readOnly} /> : null}

            <Card title="Medication order">
              <RxSection
                lines={state.rxLines}
                onChange={(list) => d.setRxLines(list)}
                lastRx={
                  load.patient.currentMedicines.find(
                    (r) => r.doctorId === me.id && r.visitId !== state.visitId,
                  )?.lines ?? []
                }
                visitDate={editing?.visitDate ?? followUpDate(0, now)}
                readOnly={readOnly}
                warnings={rxWarnings}
                onCatalogue={() => setCatalogueReady((n) => n + 1)}
              />
            </Card>

            <Card title="Plan">
              <Text style={styles.chipLabel}>Investigations</Text>
              <View style={styles.chips}>
                {[...tests, ...extraTests].map((t) => (
                  <Chip
                    key={t.testName}
                    label={t.testName}
                    disabled={readOnly}
                    selected={state.investigations.some(
                      (s) => s.testName.toLowerCase() === t.testName.toLowerCase(),
                    )}
                    onPress={() => d.setInvestigations(toggleInvestigation(state.investigations, t))}
                  />
                ))}
              </View>
              {!readOnly ? (
                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.addInput]}
                    value={newTest}
                    onChangeText={setNewTest}
                    placeholder="Another test"
                    placeholderTextColor={colors.onSurfaceVariant}
                    maxLength={120}
                    accessibilityLabel="Add another test"
                  />
                  <Pressable
                    style={[styles.outlineButton, !newTest.trim() && { opacity: 0.5 }]}
                    disabled={!newTest.trim()}
                    onPress={() => {
                      const t: InvestigationOrder = { testName: newTest.trim(), testCode: null };
                      if (
                        !state.investigations.some(
                          (s) => s.testName.toLowerCase() === t.testName.toLowerCase(),
                        )
                      ) {
                        d.setInvestigations([...state.investigations, t]);
                      }
                      setNewTest('');
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.outlineText}>+ Add</Text>
                  </Pressable>
                </View>
              ) : null}
              {!eye ? <GastroPlanChips d={d} readOnly={readOnly} /> : null}
              {text(
                FIELD.plan,
                eye ? 'Action plan' : 'Plan',
                eye
                  ? 'e.g. Continue timolol OD; pre-op work-up for OS cataract'
                  : 'e.g. Medical management; review with reports',
              )}
              {text(FIELD.advice, 'Advice', 'e.g. Small meals; avoid late dinner')}
              <Text style={styles.chipLabel}>{eye ? 'Review after' : 'Follow-up'}</Text>
              <View style={styles.chips}>
                {FOLLOW_UP_OPTIONS.map((o) => {
                  const date = followUpDate(o.days, now);
                  return (
                    <Chip
                      key={o.id}
                      label={o.label}
                      disabled={readOnly}
                      selected={state.followUp === date}
                      onPress={() => d.setFollowUp(state.followUp === date ? null : date)}
                    />
                  );
                })}
              </View>
              <Text style={styles.followUp}>
                {state.followUp ? followUpLabel(state.followUp, now) : 'No follow-up set'}
              </Text>
            </Card>
            {eye ? vitalsCard : null}
          </ScrollView>

          {editing ? (
            <View style={styles.actions}>
              <Pressable
                style={[styles.outlineButton, { flex: 1 }]}
                onPress={() => router.navigate({ pathname: '/patient', params: { id: p.id } })}
                accessibilityRole="button"
              >
                <Text style={styles.outlineText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  { flex: 1.3 },
                  (readOnly || savingEdit || state.unsaved === 0 || (askReason && !reason.trim())) && {
                    opacity: 0.5,
                  },
                ]}
                onPress={() => void saveEdit()}
                disabled={readOnly || savingEdit || state.unsaved === 0 || (askReason && !reason.trim())}
                accessibilityRole="button"
              >
                {savingEdit ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryText}>Save as version {editing.version + 1}</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                style={[styles.outlineButton, { flex: 1 }]}
                onPress={() => void d.flush()}
                disabled={readOnly}
                accessibilityRole="button"
              >
                <Text style={styles.outlineText}>Save draft</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, { flex: 1.3 }, readOnly && { opacity: 0.5 }]}
                onPress={() => {
                  void d.flush();
                  setMode('review');
                }}
                disabled={readOnly}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>Next: Review</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function ModeButton({
  label,
  selected,
  disabled,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={[styles.mode, selected && styles.modeSelected, disabled && { opacity: 0.5 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
    >
      <Text style={[styles.modeText, selected && { color: colors.onPrimary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceContainer },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorTitle: { ...type.title, color: colors.onSurface },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 26, color: colors.onPrimary },
  name: { ...type.titleLarge, color: colors.onPrimary },
  headerSub: { ...type.label, color: colors.onPrimary },
  indent: { marginLeft: MIN_TAP + spacing.sm },
  content: { padding: spacing.md, gap: spacing.md },
  modes: { flexDirection: 'row', gap: spacing.sm },
  mode: {
    flex: 1,
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelected: { backgroundColor: colors.primary },
  modeText: { ...type.labelLarge, color: colors.onPrimaryContainer },
  caption: { ...type.label, color: colors.onSurfaceVariant },
  editBanner: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  editTitle: { ...type.title, color: colors.onSecondaryContainer },
  editBody: { ...type.body, color: colors.onSecondaryContainer },
  reasonInput: {
    ...type.body,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.onSurface,
  },
  known: { ...type.label, color: colors.onSurfaceVariant },
  vitals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vital: {
    width: '31%',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  vitalLabel: { ...type.label, color: colors.onSurfaceVariant },
  vitalUnit: { ...type.caption, color: colors.onSurfaceVariant },
  vitalInput: { ...type.title, color: colors.onSurface, minHeight: 40, padding: 0 },
  vitalWarning: { ...type.caption, color: colors.warning },
  chipLabel: { ...type.label, color: colors.onSurfaceVariant },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addInput: {
    ...type.body,
    flex: 1,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
  },
  followUp: { ...type.bodyStrong, color: colors.onSurface },
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
});
