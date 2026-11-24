import { Alert } from 'react-native';
import type { QueueEntry } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { api } from '../auth/SessionProvider';
import { queueStore } from './queue-instance';

/**
 * Opens a patient for a consult (queue row tap, "Start consult"). If another doctor has the
 * patient open, the doctor is warned by name and may open anyway; it is never a lock.
 * Resolves true once the patient is open with this doctor.
 */
export async function openConsult(patientId: string, force = false): Promise<boolean> {
  try {
    const entry: QueueEntry = await api.openConsult(patientId, force);
    queueStore.upsert(entry);
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'in_consult_with_other_doctor') {
      const who =
        typeof e.details.inConsultWithName === 'string' ? e.details.inConsultWithName : 'Another doctor';
      return new Promise((resolve) =>
        Alert.alert(
          `${who} has this patient open`,
          'You can still open the patient. Both of you will be able to work on the same patient.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Open anyway', onPress: () => void openConsult(patientId, true).then(resolve) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
    }
    if (e instanceof ApiError && e.code === 'network') {
      Alert.alert('No connection', 'The patient was not opened. Check the internet and try again.');
    } else {
      Alert.alert('Could not open the patient', 'Nothing was changed. Please try again.');
    }
    return false;
  }
}
