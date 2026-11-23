import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { session, useSession } from '../auth/SessionProvider';
import { colors, MIN_TAP, radius, spacing, type } from '../theme/tokens';

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Header button with the doctor's initials; opens the profile menu with Log out. */
export default function ProfileMenu() {
  const { me, state } = useSession();
  const [open, setOpen] = useState(false);
  const name = me?.displayName ?? (state.status === 'active' ? state.username : '');

  function confirmLogout() {
    Alert.alert(
      'Log out?',
      'You will need your password to sign in again. Data saved on this phone will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            setOpen(false);
            void session.signOut();
          },
        },
      ],
    );
  }

  return (
    <>
      <Pressable
        style={styles.avatar}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Profile and log out"
      >
        <Text style={styles.avatarText}>{initials(name) || '?'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close menu">
          <View style={styles.sheet}>
            <Text style={styles.name}>{name}</Text>
            {me?.qualifications ? <Text style={styles.detail}>{me.qualifications}</Text> : null}
            <Pressable style={styles.item} onPress={() => session.lock()} accessibilityRole="button">
              <Text style={styles.itemText}>Lock now</Text>
            </Pressable>
            <Pressable style={styles.item} onPress={confirmLogout} accessibilityRole="button">
              <Text style={[styles.itemText, { color: colors.error }]}>Log out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { ...type.labelLarge, color: colors.onPrimaryContainer },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  sheet: {
    marginTop: 96,
    marginRight: spacing.md,
    minWidth: 240,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: { ...type.title, color: colors.onSurface },
  detail: { ...type.label, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  item: { minHeight: MIN_TAP, justifyContent: 'center' },
  itemText: { ...type.labelLarge, color: colors.onSurface },
});
