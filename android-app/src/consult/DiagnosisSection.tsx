import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  EYE_SIDES,
  type Diagnosis,
  type DiagnosisFavourite,
  type EyeSide,
  type Specialty,
} from '@swasthyaiq/shared';
import { api } from '../auth/SessionProvider';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';
import { shortDate } from '../patient/summary-view';
import {
  eyeFromTitle,
  ICD10_SOURCE,
  recentCodes,
  rememberPick,
  searchCodes,
  type Icd10Code,
} from './icd10/search';

/** Favourites load once per app session; the picker works offline without them. */
let favouritesCache: DiagnosisFavourite[] | null = null;

/**
 * Assessment → Diagnosis (DIG-53): ICD-10 only, Misc allowed, at least one needed to sign.
 * Each entry is tagged Primary / Co-morbidity and Provisional / Final with its date; eye
 * diagnoses also carry OD / OS / OU.
 */
export default function DiagnosisSection({
  diagnoses,
  onChange,
  specialty,
  today,
  readOnly,
}: {
  diagnoses: Diagnosis[];
  onChange: (list: Diagnosis[]) => void;
  specialty: Specialty;
  today: string;
  readOnly: boolean;
}) {
  const [picking, setPicking] = useState(false);

  function update(i: number, patch: Partial<Diagnosis>) {
    onChange(
      diagnoses.map((d, j) => {
        if (j === i) return { ...d, ...patch };
        // Only one Primary: making this one Primary turns the others into Co-morbidities.
        return patch.role === 'primary' ? { ...d, role: 'comorbidity' } : d;
      }),
    );
  }

  function add(d: Diagnosis) {
    onChange([
      ...diagnoses,
      { ...d, role: diagnoses.some((x) => x.role === 'primary') ? 'comorbidity' : 'primary' },
    ]);
    setPicking(false);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Diagnosis (ICD-10)</Text>
        <Text style={[styles.required, diagnoses.length === 0 && { color: colors.error }]}>
          required to sign
        </Text>
      </View>
      {diagnoses.length === 0 ? (
        <Text style={styles.empty}>No diagnosis yet. Add at least one (coded, or Misc) before signing.</Text>
      ) : null}
      {diagnoses.map((d, i) => (
        <View key={`${d.icd10Code ?? 'misc'}-${d.label}-${i}`} style={styles.item}>
          <View style={styles.itemTop}>
            <Text style={styles.itemText}>
              <Text style={styles.code}>{d.kind === 'icd10' ? d.icd10Code : 'Misc'}</Text> · {d.label}
            </Text>
            {!readOnly ? (
              <Pressable
                onPress={() => onChange(diagnoses.filter((_, j) => j !== i))}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${d.label}`}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.tags}>
            <Toggle
              options={[
                ['primary', 'Primary'],
                ['comorbidity', 'Co-morbidity'],
              ]}
              value={d.role ?? 'comorbidity'}
              disabled={readOnly}
              onChange={(role) => update(i, { role })}
            />
            <Toggle
              options={[
                ['provisional', 'Provisional'],
                ['final', 'Final'],
              ]}
              value={d.certainty ?? 'final'}
              disabled={readOnly}
              onChange={(certainty) => update(i, { certainty })}
            />
            {specialty === 'eye' ? (
              <Toggle
                options={EYE_SIDES.map((e) => [e, e] as [EyeSide, string])}
                value={d.eye ?? null}
                disabled={readOnly}
                onChange={(eye) => update(i, { eye: d.eye === eye ? null : eye })}
              />
            ) : null}
            <Text style={styles.date}>{shortDate(d.diagnosedOn ?? today)}</Text>
          </View>
        </View>
      ))}
      {!readOnly ? (
        <Pressable style={styles.addButton} onPress={() => setPicking(true)} accessibilityRole="button">
          <Text style={styles.addText}>+ Add diagnosis</Text>
        </Pressable>
      ) : null}
      <PickerModal
        visible={picking}
        specialty={specialty}
        chosen={diagnoses}
        onClose={() => setPicking(false)}
        onPickCode={(c) => {
          rememberPick(c.code);
          add({
            kind: 'icd10',
            icd10Code: c.code,
            label: c.title,
            certainty: 'final',
            eye: specialty === 'eye' ? eyeFromTitle(c.title) : null,
            diagnosedOn: today,
          });
        }}
        onPickMisc={(text) =>
          add({
            kind: 'misc',
            icd10Code: null,
            label: text,
            certainty: 'final',
            eye: null,
            diagnosedOn: today,
          })
        }
      />
    </View>
  );
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: [T, string][];
  value: T | null;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.toggle}>
      {options.map(([v, label]) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          disabled={disabled}
          style={[styles.toggleItem, value === v && styles.toggleOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === v, disabled }}
        >
          <Text style={[styles.toggleText, value === v && { color: colors.onPrimaryContainer }]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function PickerModal({
  visible,
  specialty,
  chosen,
  onClose,
  onPickCode,
  onPickMisc,
}: {
  visible: boolean;
  specialty: Specialty;
  chosen: Diagnosis[];
  onClose: () => void;
  onPickCode: (c: Icd10Code) => void;
  onPickMisc: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [favourites, setFavourites] = useState<DiagnosisFavourite[]>(favouritesCache ?? []);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    if (favouritesCache) return;
    api
      .diagnosisFavourites()
      .then((f) => {
        favouritesCache = f;
        setFavourites(f);
      })
      .catch(() => undefined); // offline: the bundled list still works
  }, [visible]);

  const sections = useMemo(
    () =>
      searchCodes(query, { specialty, favourites, recent: recentCodes() }).map((s) => ({
        title: s.title,
        data: s.codes,
      })),
    [query, specialty, favourites],
  );
  const taken = new Set(chosen.map((d) => d.icd10Code));
  const misc = query.trim();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Pressable
            onPress={onClose}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Add diagnosis</Text>
        </View>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="ICD-10 code or name, e.g. K21.9 or reflux"
          placeholderTextColor={colors.onSurfaceVariant}
          autoFocus
          autoCorrect={false}
          accessibilityLabel="Search ICD-10"
        />
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.code}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => {
            const already = taken.has(item.code);
            return (
              <Pressable
                style={[styles.result, already && { opacity: 0.5 }]}
                disabled={already}
                onPress={() => onPickCode(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.code}, ${item.title}${already ? ', already added' : ''}`}
              >
                <Text style={styles.resultCode}>{item.code}</Text>
                <Text style={styles.resultTitle}>
                  {item.title}
                  {already ? '  ✓' : ''}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {misc ? 'No ICD-10 code matches.' : 'Type a code or a few letters of the diagnosis.'}
            </Text>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {misc ? (
                <Pressable style={styles.misc} onPress={() => onPickMisc(misc)} accessibilityRole="button">
                  <Text style={styles.miscText}>Not listed? Add “{misc}” as Misc (no code)</Text>
                </Pressable>
              ) : null}
              <Text style={styles.source}>Codes: {ICD10_SOURCE}. Works offline.</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...type.label, color: colors.onSurfaceVariant },
  required: { ...type.label, color: colors.onSurfaceVariant },
  empty: { ...type.body, color: colors.onSurfaceVariant, padding: spacing.sm },
  item: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemText: { ...type.body, color: colors.onSurface, flex: 1 },
  code: { ...type.bodyStrong, color: colors.onSurface },
  remove: {
    width: MIN_TAP,
    height: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.sm,
  },
  removeText: { fontSize: 18, color: colors.onSurfaceVariant },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  toggleItem: { minHeight: MIN_TAP, paddingHorizontal: spacing.sm + 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.primaryContainer },
  toggleText: { ...type.label, color: colors.onSurface },
  date: { ...type.label, color: colors.onSurfaceVariant },
  addButton: {
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { ...type.labelLarge, color: colors.primary },
  modal: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: spacing.sm,
  },
  back: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 26, color: colors.onPrimary },
  modalTitle: { ...type.titleLarge, color: colors.onPrimary },
  search: {
    ...type.body,
    margin: spacing.md,
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.lg,
    color: colors.onSurface,
  },
  sectionTitle: {
    ...type.label,
    color: colors.onSurfaceVariant,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  result: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  resultCode: { ...type.bodyStrong, color: colors.primary, width: 84 },
  resultTitle: { ...type.body, color: colors.onSurface, flex: 1 },
  footer: { padding: spacing.md, gap: spacing.md },
  misc: {
    minHeight: MIN_TAP,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    padding: spacing.md,
    justifyContent: 'center',
  },
  miscText: { ...type.bodyStrong, color: colors.primary },
  source: { ...type.caption, color: colors.onSurfaceVariant },
});
