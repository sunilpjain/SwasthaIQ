import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import PrototypeBanner from '../components/PrototypeBanner';
import { SessionProvider, useSession } from '../auth/SessionProvider';
import LockScreen from '../screens/LockScreen';
import LoginScreen from '../screens/LoginScreen';
import { colors } from '../theme/tokens';

/** Patient screens are only mounted while the session is active (signed in and unlocked). */
function Gate() {
  const { state } = useSession();
  switch (state.status) {
    case 'loading':
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    case 'signedOut':
      return <LoginScreen reason={state.reason} lastUsername={state.lastUsername} />;
    case 'locked':
      return <LockScreen username={state.username} />;
    case 'active':
      return <Stack screenOptions={{ headerShown: false }} />;
  }
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.surface }}>
        <StatusBar style="dark" />
        <PrototypeBanner />
        <SessionProvider>
          <Gate />
        </SessionProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
