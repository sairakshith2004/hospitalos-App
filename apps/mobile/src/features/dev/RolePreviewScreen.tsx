import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Banner, Icon, ListRow, ScreenContainer, ScreenHeader, SurfaceCard } from '@/components';
import { ROLE_IDS, ROLES } from '@/features/access/roles';
import { useSession } from '@/features/session/SessionProvider';
import { borders, colors } from '@/theme/tokens';

/**
 * DEVELOPMENT ONLY. Switches the demo session between the 11 role experiences.
 * Removed from the route tree in production builds and never sent to the API.
 */
export function RolePreviewScreen() {
  const router = useRouter();
  const { state, switchDemoRole } = useSession();
  const current = state.status === 'signed-in' ? state.session.demoRoleId : undefined;

  return (
    <ScreenContainer>
      <ScreenHeader title="Role preview" subtitle="Inspect each role's workspace" />
      <Banner
        title="DEVELOPMENT ONLY · NOT AUTHORIZATION"
        message="Changes what this demo shows. Production navigation will follow permissions returned by the API."
      />
      <SurfaceCard padding="none">
        {ROLE_IDS.map((id, index) => {
          const role = ROLES[id];
          const selected = id === current;
          return (
            <View key={id} style={index > 0 && styles.divider}>
              <ListRow
                testID={`role-${id}`}
                title={role.title}
                subtitle={role.summary}
                leading={<Icon name={role.icon} color={colors.primary} />}
                trailing={selected ? <Icon name="check" color={colors.success} /> : null}
                accessibilityHint={selected ? 'Currently selected' : 'Switch to this role'}
                onPress={() => {
                  switchDemoRole(id);
                  router.back();
                }}
              />
            </View>
          );
        })}
      </SurfaceCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.border },
});
