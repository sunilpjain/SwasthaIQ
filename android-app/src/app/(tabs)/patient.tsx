import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import Placeholder from '../../components/Placeholder';
import { colors, type } from '../../theme/tokens';

/** The patient summary arrives with DIG-48; for now this confirms the queue opened a patient. */
export default function PatientScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Placeholder title="Patient" sprint="DIG-48 (patient summary)">
      <Text style={styles.note}>
        {id ? 'Patient opened from the queue.' : 'Pick a patient in the Queue tab.'}
      </Text>
    </Placeholder>
  );
}

const styles = StyleSheet.create({ note: { ...type.body, color: colors.onSurfaceVariant } });
