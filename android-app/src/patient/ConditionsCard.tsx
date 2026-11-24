import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CONDITION_STATUSES, type ConditionStatus, type PatientCondition } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { api } from '../auth/SessionProvider';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';
import Card, { cardStyles } from './Card';
import { CONDITION_STATUS_LABEL, shortDate } from './summary-view';

/**
 * Past conditions with their status (DIG-48). In Edit mode a tap changes the status, and
 * "Add condition" adds one; the API keeps every earlier status with date and doctor (DIG-40).
 */
export default function ConditionsCard({
  patientId,
  conditions,
  onChanged,
}: {
  patientId: string;
  conditions: PatientCondition[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  async function setStatus(c: PatientCondition, status: ConditionStatus) {
    try {
      await api.updateCondition(patientId, c.id, { status });
      onChanged();
    } catch (e) {
      Alert.alert(
        'Status not saved',
        e instanceof ApiError && e.code === 'network'
          ? 'No connection. Check the internet and try again.'
          : 'Nothing was changed. Please try again.',
      );
    }
  }

  function chooseStatus(c: PatientCondition) {
    const last = c.history[c.history.length - 1];
    const since = last
      ? `${CONDITION_STATUS_LABEL[last.status]} since ${shortDate(last.changedAt.slice(0, 10), true)}${last.changedByName ? ` · ${last.changedByName}` : ''}`
      : '';
    Alert.alert(c.name, since, [
      ...CONDITION_STATUSES.filter((s) => s !== c.status).map((s) => ({
        text: CONDITION_STATUS_LABEL[s],
        onPress: () => void setStatus(c, s),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  return (
    <Card
      title="Conditions (past history)"
      action={editing ? 'Done' : 'Edit'}
      onAction={() => setEditing(!editing)}
    >
      {conditions.length === 0 ? <Text style={cardStyles.empty}>No conditions recorded.</Text> : null}
      <View style={styles.chips}>
        {conditions.map((c) => (
          <Pressable
            key={c.id}
            disabled={!editing}
            onPress={() => chooseStatus(c)}
            style={[
              styles.chip,
              c.status === 'resolved' && styles.chipResolved,
              editing && styles.chipEditing,
            ]}
            accessibilityRole={editing ? 'button' : 'text'}
            accessibilityLabel={`${c.name}, ${CONDITION_STATUS_LABEL[c.status]}${editing ? ', tap to change' : ''}`}
          >
            <Text style={[styles.chipText, c.status === 'resolved' && { color: colors.onSurfaceVariant }]}>
              {c.name} · {CONDITION_STATUS_LABEL[c.status]}
            </Text>
          </Pressable>
        ))}
      </View>
      {editing ? (
        <Pressable style={styles.add} onPress={() => setAdding(true)} accessibilityRole="button">
          <Text style={styles.addText}>+ Add condition</Text>
        </Pressable>
      ) : null}
      <Text style={styles.hint}>
        {editing
          ? 'Tap a condition to change its status. Saved with date and doctor; earlier statuses are kept.'
          : 'Tap Edit to change a status (Active / Controlled / Resolved). Saved with date and doctor.'}
      </Text>
      <AddConditionModal
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={async (name, status) => {
          try {
            await api.addCondition(patientId, { name, status });
            setAdding(false);
            onChanged();
          } catch (e) {
            Alert.alert(
              'Condition not added',
              e instanceof ApiError && e.code === 'condition_exists'
                ? 'This condition is already listed. Change its status instead.'
                : e instanceof ApiError && e.code === 'network'
                  ? 'No connection. Check the internet and try again.'
                  : 'Nothing was changed. Please try again.',
            );
          }
        }}
      />
    </Card>
  );
}

function AddConditionModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, status: ConditionStatus) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ConditionStatus>('active');
  const [saving, setSaving] = useState(false);
  const canSave = name.trim().length > 0 && !saving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setName('')}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add condition</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Condition, e.g. Hypothyroidism"
            placeholderTextColor={colors.onSurfaceVariant}
            autoFocus
            maxLength={200}
            accessibilityLabel="Condition name"
          />
          <View style={styles.chips}>
            {CONDITION_STATUSES.map((s) => (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={[styles.chip, status === s && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: status === s }}
              >
                <Text style={[styles.chipText, status === s && { color: colors.onPrimaryContainer }]}>
                  {CONDITION_STATUS_LABEL[s]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttons}>
            <Pressable style={styles.secondary} onPress={onClose} accessibilityRole="button">
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primary, !canSave && { opacity: 0.5 }]}
              disabled={!canSave}
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave(name.trim(), status);
                } finally {
                  setSaving(false);
                }
              }}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    justifyContent: 'center',
  },
  chipEditing: { borderColor: colors.primary, borderStyle: 'dashed' },
  chipResolved: { backgroundColor: colors.surfaceContainer },
  chipSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { ...type.body, color: colors.onSurface },
  add: { minHeight: MIN_TAP, justifyContent: 'center' },
  addText: { ...type.labelLarge, color: colors.primary },
  hint: { ...type.label, color: colors.onSurfaceVariant },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: { ...type.titleLarge, color: colors.onSurface },
  input: {
    ...type.body,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  secondary: { minHeight: MIN_TAP, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  secondaryText: { ...type.labelLarge, color: colors.primary },
  primary: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  primaryText: { ...type.labelLarge, color: colors.onPrimary },
});
