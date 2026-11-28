import { Text } from 'react-native';
import Card from '../patient/Card';
import Chip, { Chips, chipStyles } from './Chip';
import { appendPhrase, hasPhrase } from '@swasthyaiq/shared';
import type { DraftStore } from './draft-store';
import FieldBox from './FieldBox';
import {
  ALARM_FEATURES,
  FINDING_CHIPS,
  GASTRO_FIELD,
  NO_ALARM_FEATURES,
  OTHER_SYSTEMS_NAD,
  parseList,
  PLAN_TYPES,
  TENDERNESS_CHIPS,
  toggleListItem,
} from '@swasthyaiq/shared';

interface Props {
  d: DraftStore;
  readOnly: boolean;
}

/**
 * Systemic examination — Gastro (P/A) for Dr. Saiyam (DIG-51): tap-to-add chips write into the
 * free-text "Per abdomen findings" box (editable afterwards); alarm features are their own list.
 */
export function GastroExamCard({ d, readOnly }: Props) {
  const pa = d.value(GASTRO_FIELD.perAbdomen);
  const alarms = parseList(d.value(GASTRO_FIELD.alarmFeatures));
  const other = d.value(GASTRO_FIELD.otherSystems);
  const add = (phrase: string) => d.setField(GASTRO_FIELD.perAbdomen, appendPhrase(pa, phrase));

  return (
    <Card title="Systemic examination — P/A">
      <Text style={chipStyles.chipLabel}>Tenderness</Text>
      <Chips>
        {TENDERNESS_CHIPS.map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            selected={hasPhrase(pa, c.phrase)}
            disabled={readOnly}
            onPress={() => add(c.phrase)}
          />
        ))}
      </Chips>
      <Text style={chipStyles.chipLabel}>Findings</Text>
      <Chips>
        {FINDING_CHIPS.map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            selected={hasPhrase(pa, c.phrase)}
            disabled={readOnly}
            onPress={() => add(c.phrase)}
          />
        ))}
      </Chips>
      <Text style={chipStyles.chipLabel}>Alarm features</Text>
      <Chips>
        {[...ALARM_FEATURES, NO_ALARM_FEATURES].map((a) => (
          <Chip
            key={a}
            label={a}
            selected={alarms.includes(a)}
            disabled={readOnly}
            onPress={() =>
              d.setField(
                GASTRO_FIELD.alarmFeatures,
                toggleListItem(d.value(GASTRO_FIELD.alarmFeatures), a, NO_ALARM_FEATURES),
              )
            }
          />
        ))}
      </Chips>
      <FieldBox
        label="Per abdomen findings"
        value={pa}
        source={d.state.fields[GASTRO_FIELD.perAbdomen]?.source}
        onChange={(v) => d.setField(GASTRO_FIELD.perAbdomen, v)}
        placeholder="e.g. Soft, mild epigastric tenderness, no organomegaly, bowel sounds normal"
        editable={!readOnly}
      />
      <FieldBox
        label="Other systems"
        value={other}
        source={d.state.fields[GASTRO_FIELD.otherSystems]?.source}
        onChange={(v) => d.setField(GASTRO_FIELD.otherSystems, v)}
        placeholder={OTHER_SYSTEMS_NAD}
        multiline={false}
        editable={!readOnly}
      />
      {!readOnly && !other ? (
        <Chips>
          <Chip
            label={OTHER_SYSTEMS_NAD}
            selected={false}
            onPress={() => d.setField(GASTRO_FIELD.otherSystems, OTHER_SYSTEMS_NAD)}
          />
        </Chips>
      ) : null}
    </Card>
  );
}

/** Plan type chips: medical, surgery, or referral for OGD / colonoscopy (no endoscopy at the clinic). */
export function GastroPlanChips({ d, readOnly }: Props) {
  const types = parseList(d.value(GASTRO_FIELD.planType));
  return (
    <>
      <Text style={chipStyles.chipLabel}>Plan</Text>
      <Chips>
        {PLAN_TYPES.map((t) => (
          <Chip
            key={t}
            label={t}
            selected={types.includes(t)}
            disabled={readOnly}
            onPress={() =>
              d.setField(GASTRO_FIELD.planType, toggleListItem(d.value(GASTRO_FIELD.planType), t))
            }
          />
        ))}
      </Chips>
    </>
  );
}
