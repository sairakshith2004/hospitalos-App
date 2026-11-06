import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Icon,
  ListRow,
  ScreenContainer,
  SectionHeader,
  StatusChip,
  SurfaceCard,
} from '@/components';
import { devToolsEnabled } from '@/features/dev/flags';
import { primaryRole } from '@/features/session/session-role';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { borders, colors, spacing } from '@/theme/tokens';

export function ProfileScreen() {
  const router = useRouter();
  const session = useSignedInSession();
  const roleTitle = primaryRole(session)?.title ?? 'No role assigned';

  return (
    <ScreenContainer bottomInset={false}>
      <AppText variant="title" accessibilityRole="header">
        Profile
      </AppText>
      <SurfaceCard>
        <View style={styles.identity}>
          <Avatar name={session.displayName} size="lg" />
          <View style={styles.identityText}>
            <AppText variant="headline">{session.displayName}</AppText>
            <AppText variant="bodySmall" color="textMuted">
              {roleTitle}
            </AppText>
            {session.kind === 'demo' ? (
              <StatusChip label="DEMO SESSION" tone="warning" dot={false} />
            ) : null}
          </View>
        </View>
      </SurfaceCard>

      <SectionHeader title="Account" />
      <SurfaceCard padding="none">
        <ListRow
          title="Settings"
          leading={<Icon name="settings" color={colors.textSecondary} />}
          onPress={() => router.push('/settings')}
        />
        {session.kind === 'authenticated' &&
        session.permissions.some(
          (p) => p === 'user:create' || p === 'user:manage' || p === 'user_role:assign',
        ) ? (
          <View style={styles.divider}>
            <ListRow
              title="Staff accounts"
              leading={<Icon name="people" color={colors.textSecondary} />}
              onPress={() => router.push('/admin/staff')}
            />
          </View>
        ) : null}
        {session.kind === 'authenticated' &&
        session.permissions.some((p) => p === 'nurse_assignment:manage') ? (
          <View style={styles.divider}>
            <ListRow
              title="Nurse assignments"
              leading={<Icon name="clipboard" color={colors.textSecondary} />}
              onPress={() => router.push('/admin/nurse-assignments')}
            />
          </View>
        ) : null}
        {session.kind === 'authenticated' ? (
          <View style={styles.divider}>
            <ListRow
              title="Change password"
              leading={<Icon name="settings" color={colors.textSecondary} />}
              onPress={() => router.push('/account/password')}
              accessibilityHint="Signs out your other devices"
            />
          </View>
        ) : null}
        <View style={styles.divider}>
          <ListRow
            title="Sign out"
            leading={<Icon name="sign-out" color={colors.danger} />}
            onPress={() => router.push('/sign-out')}
            accessibilityHint="Asks for confirmation"
          />
        </View>
      </SurfaceCard>

      {devToolsEnabled ? (
        <>
          <SectionHeader title="Developer tools" />
          <SurfaceCard padding="none">
            <ListRow
              title="Role preview"
              subtitle="Development only · not authorization"
              leading={<Icon name="swap" color={colors.warning} />}
              onPress={() => router.push('/role-preview')}
            />
            <View style={styles.divider}>
              <ListRow
                title="Component showcase"
                subtitle="Design system reference"
                leading={<Icon name="code" color={colors.warning} />}
                onPress={() => router.push('/showcase')}
              />
            </View>
          </SurfaceCard>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.xs },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.border },
});
