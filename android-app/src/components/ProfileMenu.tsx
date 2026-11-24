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

export interface MenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * The profile menu: doctor's name, any screen-specific items (e.g. Reset queue), Lock now and
 * Log out. `variant="kebab"` draws ⋮ for the blue queue header; the default is the initials avatar.
 */
export default function ProfileMenu({
  items = [],
  variant = 'avatar',
}: {
  items?: MenuItem[];
  variant?: 'avatar' | 'kebab';
}) {
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

  const all: MenuItem[] = [
    ...items,
    { label: 'Lock now', onPress: () => session.lock() },
    { label: 'Log out', onPress: confirmLogout, destructive: true },
  ];

  return (
    <>
      <Pressable
        style={variant === 'avatar' ? styles.avatar : styles.kebab}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Menu: profile and log out"
      >
        <Text style={variant === 'avatar' ? styles.avatarText : styles.kebabText}>
          {variant === 'avatar' ? initials(name) || '?' : '⋮'}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close menu">
          <View style={styles.sheet}>
            <Text style={styles.name}>{name}</Text>
            {me?.qualifications ? <Text style={styles.detail}>{me.qualifications}</Text> : null}
            {all.map((item) => (
              <Pressable
                key={item.label}
                style={styles.item}
                onPress={() => {
                  if (!item.destructive) setOpen(false);
                  item.onPress();
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.itemText, item.destructive && { color: colors.error }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
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
  kebab: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  kebabText: { fontSize: 24, lineHeight: 28, color: colors.onPrimary, fontWeight: '700' },
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
