import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors, MIN_TAP } from '../../theme/tokens';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

/** Bottom navigation from the spec: Queue, Patient, Consult, Rx. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.onSurface },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: { minHeight: MIN_TAP + 16 },
        tabBarLabelStyle: { fontSize: 13 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Queue', tabBarIcon: icon('☰') }} />
      <Tabs.Screen name="patient" options={{ title: 'Patient', tabBarIcon: icon('👤') }} />
      <Tabs.Screen name="consult" options={{ title: 'Consult', tabBarIcon: icon('✎') }} />
      <Tabs.Screen name="rx" options={{ title: 'Rx', tabBarIcon: icon('℞') }} />
    </Tabs>
  );
}
