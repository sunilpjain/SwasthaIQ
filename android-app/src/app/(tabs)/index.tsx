import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Placeholder from '../../components/Placeholder';
import { ApiClient } from '../../api/client';
import { env } from '../../config/env';
import { colors } from '../../theme/tokens';

// Sprint 1 goal: "the empty app logs in against real AWS". Until login lands (Sprint 2),
// the Queue tab proves connectivity by calling the public /health endpoint.
const api = new ApiClient(env.apiBaseUrl, async () => null);

export default function QueueScreen() {
  const [status, setStatus] = useState('Checking server…');

  useEffect(() => {
    api
      .health()
      .then((h) => setStatus(`Server ${h.status} · database ${h.db} · ${h.version}`))
      .catch(() => setStatus(`Cannot reach ${env.apiBaseUrl}`));
  }, []);

  return (
    <Placeholder title="Queue" sprint="Sprint 2">
      <Text style={styles.status}>{status}</Text>
    </Placeholder>
  );
}

const styles = StyleSheet.create({ status: { color: colors.onSurfaceVariant, fontSize: 14 } });
