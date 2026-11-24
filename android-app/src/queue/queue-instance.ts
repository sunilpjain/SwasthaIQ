import { api } from '../auth/SessionProvider';
import { QueueStore } from './queue-store';

/** One queue for the app: the Queue tab polls it; the patient header reads appointment times from it. */
export const queueStore = new QueueStore(api);
