import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import {
  ListRow,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  StatusChip,
  SurfaceCard,
} from '@/components';
import { config } from '@/config/env';
import { borders, colors } from '@/theme/tokens';

export function SettingsScreen() {
  const version = Constants.expoConfig?.version ?? 'unknown';
  return (
    <ScreenContainer>
      <ScreenHeader title="Settings" />
      <SectionHeader title="Preferences" />
      <SurfaceCard padding="none">
        <ListRow
          title="Notifications"
          subtitle="Choose which alerts you receive"
          trailing={<StatusChip label="Later" tone="neutral" dot={false} />}
        />
        <View style={styles.divider}>
          <ListRow
            title="Appearance"
            subtitle="Dark theme"
            trailing={<StatusChip label="Fixed" tone="neutral" dot={false} />}
          />
        </View>
      </SurfaceCard>
      <SectionHeader title="About" />
      <SurfaceCard padding="none">
        <ListRow title="App version" trailing={<StatusChip label={version} dot={false} />} />
        <View style={styles.divider}>
          <ListRow
            title="Environment"
            trailing={<StatusChip label={config.appEnv} tone="primary" dot={false} />}
          />
        </View>
      </SurfaceCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.border },
});
