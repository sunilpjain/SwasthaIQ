import { Alert } from 'react-native';
import type { QueueEntry } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { api } from '../auth/SessionProvider';
import { queueStore } from './queue-instance';

/**
 * Opens one of the doctor's own patients for a consult (queue row tap, "Start consult").
 * The other doctor's patients are view-only (DIG-96); the API refuses them too.
 * Resolves true once the patient is open with this doctor.
 */
export async function openConsult(patientId: string): Promise<boolean> {
  try {
    const entry: QueueEntry = await api.openConsult(patientId);
    queueStore.upsert(entry);
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_your_patient') {
      Alert.alert(
        'View only',
        'This patient is booked with the other doctor. You can read their record but not consult.',
      );
    } else if (e instanceof ApiError && e.code === 'network') {
      Alert.alert('No connection', 'The patient was not opened. Check the internet and try again.');
    } else {
      Alert.alert('Could not open the patient', 'Nothing was changed. Please try again.');
    }
    return false;
  }
}
