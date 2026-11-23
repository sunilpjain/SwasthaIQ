import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Placeholder from '../../components/Placeholder';
import { api, useSession } from '../../auth/SessionProvider';
import { env } from '../../config/env';
import { colors } from '../../theme/tokens';

// Until the queue screen lands (DIG-47), the Queue tab shows who is signed in and that an
// authenticated call to the server works.

export default function QueueScreen() {
  const { me } = useSession();
  const [status, setStatus] = useState('Checking server…');

  useEffect(() => {
    api
      .queue()
      .then((q) => setStatus(`Signed in · ${q.length} patients in today's queue`))
      .catch(() => setStatus(`Cannot reach ${env.apiBaseUrl}`));
  }, []);

  return (
    <Placeholder title={me ? `Queue · ${me.displayName}` : 'Queue'} sprint="Sprint 2">
      <Text style={styles.status}>{status}</Text>
    </Placeholder>
  );
}

const styles = StyleSheet.create({ status: { color: colors.onSurfaceVariant, fontSize: 14 } });
