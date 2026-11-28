import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { MedicineCatalogue, MedicineFavourite, RxLine, RxLineInput } from '@swasthyaiq/shared';
import { api } from '../../auth/SessionProvider';
import { colors, MIN_TAP, radius, spacing, type } from '../../theme/tokens';
import Chip, { Chips } from '../Chip';
import {
  addLines,
  dateRange,
  EYE_CHOICES,
  FREQUENCY_CHIPS,
  lineFromMedicine,
  lineFromText,
  lineSig,
  linesFromLastRx,
  linesFromOrderSet,
  lineTitle,
  LOCAL_LANGUAGES,
  localInstruction,
  RX_DURATION_CHIPS,
  searchMedicines,
  TIMING_CHIPS,
  type LocalLanguage,
} from './rx-lines';

/** The catalogue and favourites load once per app session (DIG-69). */
let catalogueCache: MedicineCatalogue | null = null;
let favouritesCache: MedicineFavourite[] | null = null;

const newId = () => Crypto.randomUUID();

type Panel = 'none' | 'favourites' | 'sets';

/**
 * Medication order (DIG-70, hi-fi screen 8): search the catalogue, favourites, order sets or
 * copy the last Rx; then adjust each line. Generic names only; quantity and dates are calculated.
 */
export default function RxSection({
  lines,
  onChange,
  lastRx,
  visitDate,
  readOnly,
}: {
  lines: RxLineInput[];
  onChange: (list: RxLineInput[]) => void;
  /** This doctor's last signed prescription for the patient, for "Copy last Rx". */
  lastRx: RxLine[];
  /** ISO date the Rx starts (the visit date). */
  visitDate: string;
  readOnly: boolean;
}) {
  const [catalogue, setCatalogue] = useState<MedicineCatalogue | null>(catalogueCache);
  const [favourites, setFavourites] = useState<MedicineFavourite[]>(favouritesCache ?? []);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<Panel>('none');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (catalogueCache) return;
    let live = true;
    Promise.all([api.medicines(), api.medicineFavourites().catch(() => [])])
      .then(([c, f]) => {
        catalogueCache = c;
        favouritesCache = f;
        if (live) {
          setCatalogue(c);
          setFavourites(f);
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const meds = catalogue?.medicines ?? [];
  const results = useMemo(() => searchMedicines(meds, query), [meds, query]);
  const favMeds = favourites.flatMap((f) => meds.filter((m) => m.id === f.medicineId));

  function add(added: RxLineInput[]) {
    const next = addLines(lines, added);
    onChange(next);
    setQuery('');
    setPanel('none');
    // Open the first new line so the doctor can check the sig (and pick the eye).
    const first = next.find((l) => !lines.some((x) => x.id === l.id));
    if (first) setOpen(first.id);
  }

  function update(id: string, patch: Partial<RxLineInput>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <View style={styles.wrap}>
      {!readOnly ? (
        <>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search generic name…"
            placeholderTextColor={colors.onSurfaceVariant}
            maxLength={80}
            accessibilityLabel="Search medicines"
          />
          {query.trim() ? (
            <View style={styles.results}>
              {results.map((m) => (
                <Pressable
                  key={m.id}
                  style={styles.result}
                  onPress={() => add([lineFromMedicine(m, newId())])}
                  accessibilityRole="button"
                >
                  <Text style={styles.resultTitle}>
                    {lineTitle({ medicineGeneric: `${m.generic} ${m.strength}`, form: m.form })}
                  </Text>
                  <Text style={styles.resultSub}>
                    {m.defaults.dose} · {m.defaults.frequency} · {m.defaults.duration}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.result}
                onPress={() => add([lineFromText(query, newId())])}
                accessibilityRole="button"
              >
                <Text style={styles.addFree}>+ Add “{query.trim()}” (not in the list)</Text>
              </Pressable>
            </View>
          ) : null}
          <Chips>
            <Chip
              label="★ Favourites"
              selected={panel === 'favourites'}
              disabled={!favMeds.length}
              onPress={() => setPanel(panel === 'favourites' ? 'none' : 'favourites')}
            />
            <Chip
              label="Order sets"
              selected={panel === 'sets'}
              disabled={!catalogue?.orderSets.length}
              onPress={() => setPanel(panel === 'sets' ? 'none' : 'sets')}
            />
            <Chip
              label="Copy last Rx"
              selected={false}
              disabled={!lastRx.length}
              onPress={() => add(linesFromLastRx(lastRx, newId))}
            />
          </Chips>
          {panel === 'favourites' ? (
            <Chips>
              {favMeds.map((m) => (
                <Chip
                  key={m.id}
                  label={`${m.generic} ${m.strength}`}
                  selected={false}
                  onPress={() => add([lineFromMedicine(m, newId())])}
                />
              ))}
            </Chips>
          ) : null}
          {panel === 'sets' ? (
            <Chips>
              {(catalogue?.orderSets ?? []).map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.name} (${s.lines.length})`}
                  selected={false}
                  onPress={() => add(linesFromOrderSet(s, meds, newId))}
                />
              ))}
            </Chips>
          ) : null}
          {failed ? (
            <Text style={styles.note}>
              Medicine list not loaded. You can still type a medicine and add it.
            </Text>
          ) : null}
        </>
      ) : null}

      {lines.length === 0 ? <Text style={styles.note}>No medicines yet.</Text> : null}
      {lines.map((l, i) => {
        const missingEye = l.route === 'eye' && !l.eye;
        const dates = dateRange(l.duration, visitDate);
        return (
          <View key={l.id} style={[styles.line, missingEye && styles.lineWarn]}>
            <Pressable
              onPress={() => setOpen(open === l.id ? null : l.id)}
              accessibilityRole="button"
              accessibilityLabel={`Medicine ${i + 1}, ${lineTitle(l)}. Tap to ${open === l.id ? 'close' : 'change'}`}
            >
              <Text style={styles.lineTitle}>
                {i + 1} {lineTitle(l)}
              </Text>
              <Text style={styles.lineSig}>{lineSig(l)}</Text>
              {l.taper ? <Text style={styles.lineSub}>Taper: {l.taper}</Text> : null}
              {dates ? <Text style={styles.lineSub}>{dates}</Text> : null}
              {l.instructionsLocal ? <Text style={styles.lineSub}>{l.instructionsLocal}</Text> : null}
              {missingEye ? <Text style={styles.warn}>⚠ Choose the eye: OD, OS or OU.</Text> : null}
            </Pressable>
            {open === l.id && !readOnly ? <LineEditor line={l} onChange={(p) => update(l.id, p)} /> : null}
            {open === l.id && !readOnly ? (
              <Pressable
                style={styles.remove}
                onPress={() => onChange(lines.filter((x) => x.id !== l.id))}
                accessibilityRole="button"
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Text style={styles.note}>
        Generic names only. Frequency is morning-noon-evening-night; quantity and dates are calculated.
        {catalogue ? ` ${catalogue.note}` : ''}
      </Text>
    </View>
  );
}

function LineEditor({
  line: l,
  onChange,
}: {
  line: RxLineInput;
  onChange: (p: Partial<RxLineInput>) => void;
}) {
  const [lang, setLang] = useState<LocalLanguage | null>(
    (l.instructionsLanguage as LocalLanguage | null) ?? null,
  );
  const input = (label: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        maxLength={200}
        accessibilityLabel={label}
      />
    </View>
  );
  return (
    <View style={styles.editor}>
      {l.route === 'eye' ? (
        <>
          <Text style={styles.label}>Eye (required)</Text>
          <Chips>
            {EYE_CHOICES.map((e) => (
              <Chip
                key={e.eye}
                label={e.label}
                selected={l.eye === e.eye}
                onPress={() => onChange({ eye: e.eye })}
              />
            ))}
          </Chips>
        </>
      ) : null}
      {input('Dose', l.dose, (v) => onChange({ dose: v }))}
      <Text style={styles.label}>Frequency (morning-noon-evening-night)</Text>
      <Chips>
        {FREQUENCY_CHIPS.map((f) => (
          <Chip key={f} label={f} selected={l.frequency === f} onPress={() => onChange({ frequency: f })} />
        ))}
      </Chips>
      {input('Frequency (or type)', l.frequency, (v) => onChange({ frequency: v }))}
      <Text style={styles.label}>Timing</Text>
      <Chips>
        {TIMING_CHIPS.map((t) => (
          <Chip
            key={t}
            label={t}
            selected={l.timing === t}
            onPress={() => onChange({ timing: l.timing === t ? null : t })}
          />
        ))}
      </Chips>
      <Text style={styles.label}>Duration</Text>
      <Chips>
        {RX_DURATION_CHIPS.map((d) => (
          <Chip key={d} label={d} selected={l.duration === d} onPress={() => onChange({ duration: d })} />
        ))}
      </Chips>
      {input('Duration (or type)', l.duration, (v) => onChange({ duration: v }))}
      {input(
        'Taper (optional)',
        l.taper ?? '',
        (v) => onChange({ taper: v || null }),
        'e.g. 6× a day for 1 week, then 4×…',
      )}
      {input('Instructions (English, optional)', l.instructionsEn ?? '', (v) =>
        onChange({ instructionsEn: v || null }),
      )}
      <Text style={styles.label}>Instruction line for the patient</Text>
      <Chips>
        {LOCAL_LANGUAGES.map((x) => (
          <Chip
            key={x.code}
            label={x.label}
            selected={lang === x.code}
            onPress={() => {
              setLang(x.code);
              onChange({ instructionsLanguage: x.code, instructionsLocal: localInstruction(l, x.code) });
            }}
          />
        ))}
        {lang ? (
          <Chip
            label="None"
            selected={false}
            onPress={() => {
              setLang(null);
              onChange({ instructionsLanguage: null, instructionsLocal: null });
            }}
          />
        ) : null}
      </Chips>
      {lang ? (
        <>
          {input('Instruction line (edit if needed)', l.instructionsLocal ?? '', (v) =>
            onChange({ instructionsLocal: v || null }),
          )}
          <Pressable
            style={styles.regen}
            onPress={() => onChange({ instructionsLocal: localInstruction(l, lang) })}
            accessibilityRole="button"
          >
            <Text style={styles.regenText}>Write again from the sig</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  search: {
    ...type.body,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
  },
  results: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.md },
  result: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  resultTitle: { ...type.bodyStrong, color: colors.onSurface },
  resultSub: { ...type.label, color: colors.onSurfaceVariant },
  addFree: { ...type.labelLarge, color: colors.primary },
  line: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  lineWarn: { borderColor: colors.warning, backgroundColor: colors.warningContainer },
  lineTitle: { ...type.bodyStrong, color: colors.onSurface },
  lineSig: { ...type.body, color: colors.onSurface },
  lineSub: { ...type.label, color: colors.onSurfaceVariant },
  warn: { ...type.label, color: colors.onWarningContainer },
  editor: { gap: spacing.sm, marginTop: spacing.sm },
  field: { gap: 2 },
  label: { ...type.label, color: colors.onSurfaceVariant },
  input: {
    ...type.body,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  regen: { alignSelf: 'flex-start', minHeight: MIN_TAP, justifyContent: 'center' },
  regenText: { ...type.labelLarge, color: colors.primary },
  remove: { alignSelf: 'flex-start', minHeight: MIN_TAP, justifyContent: 'center' },
  removeText: { ...type.labelLarge, color: colors.error },
  note: { ...type.label, color: colors.onSurfaceVariant },
});
