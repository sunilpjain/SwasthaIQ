import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { EYE_SIDES } from '@swasthyaiq/shared';
import Card from '../patient/Card';
import { istTime } from '../queue/queue-view';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';
import Chip, { Chips, chipStyles } from './Chip';
import type { DraftStore } from './draft-store';
import {
  COVER_TEST_OPTIONS,
  DILATATION,
  EXAM_ROWS,
  EYE_FIELD,
  eyeKey,
  IOP_METHODS,
  normalFillFor,
  iopWarning,
  PURPOSES,
  SIDES,
  VISION_ROWS,
  type Side,
  type TableRow,
} from '@swasthyaiq/shared';
import FieldBox from './FieldBox';

/** Cards for Dr. Samradnyee's eye consult (DIG-52, hi-fi screen 4b). OD and OS side by side. */

interface Props {
  d: DraftStore;
  readOnly: boolean;
}

/** One-of chips stored as a single field; tapping the selected chip clears it. */
function SingleChoice({
  d,
  field,
  options,
  readOnly,
}: Props & { field: string; options: readonly string[] }) {
  const value = d.value(field);
  return (
    <Chips>
      {options.map((o) => (
        <Chip
          key={o}
          label={o}
          selected={value === o}
          disabled={readOnly}
          onPress={() => d.setField(field, value === o ? '' : o)}
        />
      ))}
    </Chips>
  );
}

export function PurposeCard({ d, readOnly }: Props) {
  return (
    <Card title="Purpose of visit">
      <SingleChoice d={d} field={EYE_FIELD.purpose} options={PURPOSES} readOnly={readOnly} />
    </Card>
  );
}

function Cell({
  value,
  onChange,
  placeholder,
  active,
  onFocus,
  readOnly,
  keyboardType,
  label,
  warn,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  active?: boolean;
  onFocus?: () => void;
  readOnly: boolean;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  warn?: boolean;
}) {
  return (
    <TextInput
      style={[styles.cell, active && styles.cellActive, warn && { borderColor: colors.warning }]}
      value={value}
      onChangeText={onChange}
      onFocus={onFocus}
      placeholder={placeholder}
      placeholderTextColor={colors.onSurfaceVariant}
      editable={!readOnly}
      keyboardType={keyboardType}
      accessibilityLabel={label}
    />
  );
}

function TableHeader() {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel} />
      {SIDES.map((s) => (
        <Text key={s} style={styles.colHead}>
          {s}
        </Text>
      ))}
    </View>
  );
}

/** Vision & refraction: unaided, glasses, pinhole, near, refraction, add, BCVA for OD and OS. */
export function VisionCard({ d, readOnly }: Props) {
  return (
    <Card title="Vision & refraction">
      <TableHeader />
      {VISION_ROWS.map((r) => (
        <View key={r.key} style={styles.row}>
          <Text style={styles.rowLabel}>{r.label}</Text>
          {SIDES.map((s) => (
            <Cell
              key={s}
              label={`${r.label} ${s}`}
              value={d.value(eyeKey(s, r.key))}
              onChange={(v) => d.setField(eyeKey(s, r.key), v)}
              placeholder={r.placeholder}
              readOnly={readOnly}
            />
          ))}
        </View>
      ))}
    </Card>
  );
}

export function IopCard({ d, readOnly }: Props) {
  const time = d.value(EYE_FIELD.iopTime);
  return (
    <Card title="IOP">
      <Text style={chipStyles.chipLabel}>Method</Text>
      <SingleChoice d={d} field={EYE_FIELD.iopMethod} options={IOP_METHODS} readOnly={readOnly} />
      <TableHeader />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>IOP mmHg</Text>
        {SIDES.map((s) => {
          const key = eyeKey(s, 'iop');
          const value = d.value(key);
          const warning = iopWarning(value);
          return (
            <View key={s} style={{ flex: 1 }}>
              <Cell
                label={`IOP ${s} in mmHg`}
                value={value}
                onChange={(v) => {
                  d.setField(key, v);
                  // Time of measurement defaults to when the first value is typed.
                  if (v && !time) d.setField(EYE_FIELD.iopTime, istTime(new Date().toISOString()));
                }}
                keyboardType="number-pad"
                readOnly={readOnly}
                warn={!!warning}
              />
              {warning ? <Text style={styles.warning}>{warning}</Text> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Time</Text>
        <Cell
          label="Time of IOP measurement"
          value={time}
          onChange={(v) => d.setField(EYE_FIELD.iopTime, v)}
          placeholder="10:38 am"
          readOnly={readOnly}
        />
        <View style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/**
 * Examination per eye. Tap a cell, then an option below fills it for that row; typing works too.
 * Cover test is one value for both eyes.
 */
export function ExamCard({ d, readOnly }: Props) {
  const [active, setActive] = useState<{ row: TableRow; side: Side | null } | null>(null);
  const activeKey = active ? (active.side ? eyeKey(active.side, active.row.key) : EYE_FIELD.coverTest) : null;
  const options = active ? (active.side ? (active.row.options ?? []) : COVER_TEST_OPTIONS) : [];
  const rows = [...EXAM_ROWS.slice(0, 2), { key: 'cover_test', label: 'Cover test' }, ...EXAM_ROWS.slice(2)];

  return (
    <Card title="Examination — per eye">
      {!readOnly ? (
        <View style={styles.normals}>
          {SIDES.map((side) => {
            const fill = normalFillFor(side, (k) => d.value(k));
            return (
              <Pressable
                key={side}
                style={[styles.normal, fill.length === 0 && { opacity: 0.5 }]}
                disabled={fill.length === 0}
                onPress={() => fill.forEach(([k, v]) => d.setField(k, v))}
                accessibilityRole="button"
                accessibilityLabel={`${side} all normal: fills ${fill.length} empty rows`}
              >
                <Text style={styles.normalText}>{side} all normal</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <TableHeader />
      {rows.map((r) =>
        r.key === 'cover_test' ? (
          <View key={r.key} style={styles.row}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Cell
              label="Cover test, both eyes"
              value={d.value(EYE_FIELD.coverTest)}
              onChange={(v) => d.setField(EYE_FIELD.coverTest, v)}
              onFocus={() => setActive({ row: r, side: null })}
              active={activeKey === EYE_FIELD.coverTest}
              readOnly={readOnly}
            />
            <View style={{ flex: 1 }} />
          </View>
        ) : (
          <View key={r.key} style={styles.row}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            {SIDES.map((s) => {
              const key = eyeKey(s, r.key);
              return (
                <Cell
                  key={s}
                  label={`${r.label} ${s}`}
                  value={d.value(key)}
                  onChange={(v) => d.setField(key, v)}
                  onFocus={() => setActive({ row: r, side: s })}
                  active={activeKey === key}
                  readOnly={readOnly}
                />
              );
            })}
          </View>
        ),
      )}
      {!readOnly ? (
        <>
          <Text style={chipStyles.chipLabel}>
            {active
              ? `${active.row.label}${active.side ? ` · ${active.side}` : ''}: tap an option`
              : 'Tap a cell, then an option'}
          </Text>
          <Chips>
            {options.map((o) => (
              <Chip
                key={o}
                label={o}
                selected={!!activeKey && d.value(activeKey) === o}
                onPress={() => activeKey && d.setField(activeKey, o)}
              />
            ))}
          </Chips>
        </>
      ) : null}
      <FieldBox
        label="Examination notes"
        value={d.value(EYE_FIELD.examNotes)}
        source={d.state.fields[EYE_FIELD.examNotes]?.source}
        onChange={(v) => d.setField(EYE_FIELD.examNotes, v)}
        placeholder="e.g. OD disc cupping CDR 0.6, no RAPD. OS nuclear cataract NS2."
        editable={!readOnly}
      />
    </Card>
  );
}

export function DilatationCard({ d, readOnly }: Props) {
  const value = d.value(EYE_FIELD.dilatation);
  return (
    <Card title="Dilatation">
      <SingleChoice d={d} field={EYE_FIELD.dilatation} options={DILATATION} readOnly={readOnly} />
      {value && value !== 'Not required' ? (
        <FieldBox
          label="Drug used"
          value={d.value(EYE_FIELD.dilatationDrug)}
          source={d.state.fields[EYE_FIELD.dilatationDrug]?.source}
          onChange={(v) => d.setField(EYE_FIELD.dilatationDrug, v)}
          placeholder="e.g. Tropicamide + phenylephrine × 3"
          multiline={false}
          editable={!readOnly}
        />
      ) : null}
    </Card>
  );
}

export function PhotosCard() {
  return (
    <Card title="Photos">
      <Text style={styles.note}>
        Fundus and slit-lamp photos, or a photo of a paper sketch, arrive with DIG-94 (photo attachments).
      </Text>
    </Card>
  );
}

export function SurgeryCard({ d, readOnly }: Props) {
  return (
    <Card title="Surgery plan">
      <Text style={chipStyles.chipLabel}>Eye</Text>
      <SingleChoice d={d} field={EYE_FIELD.surgeryEye} options={EYE_SIDES} readOnly={readOnly} />
      <FieldBox
        label="IOL"
        value={d.value(EYE_FIELD.surgeryIol)}
        source={d.state.fields[EYE_FIELD.surgeryIol]?.source}
        onChange={(v) => d.setField(EYE_FIELD.surgeryIol, v)}
        placeholder="e.g. Monofocal, power TBD"
        multiline={false}
        editable={!readOnly}
      />
    </Card>
  );
}

/** "OD / OS / OU" chips above the complaint box: each tap starts a complaint line for that eye. */
export function EyeTagChips({
  onTag,
  readOnly,
}: {
  onTag: (eye: (typeof EYE_SIDES)[number]) => void;
  readOnly: boolean;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={chipStyles.chipLabel}>Eye</Text>
      <Chips>
        {EYE_SIDES.map((e) => (
          <Pressable
            key={e}
            onPress={() => onTag(e)}
            disabled={readOnly}
            style={chipStyles.chip}
            accessibilityRole="button"
            accessibilityLabel={`Start a complaint for ${e}`}
          >
            <Text style={chipStyles.chipText}>{e}</Text>
          </Pressable>
        ))}
      </Chips>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowLabel: { ...type.label, color: colors.onSurfaceVariant, width: 92 },
  colHead: { ...type.labelLarge, color: colors.onSurface, flex: 1, textAlign: 'center' },
  cell: {
    ...type.body,
    flex: 1,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    color: colors.onSurface,
  },
  cellActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryContainer },
  warning: { ...type.caption, color: colors.warning },
  note: { ...type.body, color: colors.onSurfaceVariant },
  normals: { flexDirection: 'row', gap: spacing.sm },
  normal: {
    flex: 1,
    minHeight: MIN_TAP,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normalText: { ...type.labelLarge, color: colors.primary },
});
