import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  DangerButton,
  EmptyState,
  ErrorState,
  GlassCard,
  Icon,
  IconButton,
  ListRow,
  LoadingSkeleton,
  MetricCard,
  PrimaryButton,
  ScreenContainer,
  SearchField,
  SecondaryButton,
  SectionHeader,
  StatusChip,
  SurfaceCard,
  TextField,
} from '@/components';
import { useReducedMotion, useReduceTransparency } from '@/hooks/useAccessibilitySetting';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { borders, colors, layout, radius, spacing, typography, type Tone } from '@/theme/tokens';

const PREVIEW_WIDTHS = [
  { key: 'device', label: 'Device', width: layout.maxContentWidth },
  { key: 'narrow', label: 'Narrow 320', width: 320 },
  { key: 'phone', label: 'Phone 390', width: 390 },
] as const;
type PreviewKey = (typeof PREVIEW_WIDTHS)[number]['key'];

const SWATCHES: readonly { name: keyof typeof colors }[] = [
  { name: 'background' },
  { name: 'backgroundElevated' },
  { name: 'surfaceStrong' },
  { name: 'surfaceRaised' },
  { name: 'primary' },
  { name: 'secondary' },
  { name: 'success' },
  { name: 'warning' },
  { name: 'danger' },
  { name: 'text' },
  { name: 'textSecondary' },
  { name: 'textMuted' },
];

const TONES: readonly Tone[] = ['neutral', 'primary', 'secondary', 'success', 'warning', 'danger'];
const TYPE_STYLES = Object.keys(typography).filter(
  (key): key is keyof typeof typography => key in typography,
);

export function ShowcaseScreen() {
  const router = useRouter();
  const { width, isWide } = useResponsiveLayout();
  const reducedMotion = useReducedMotion();
  const reduceTransparency = useReduceTransparency();
  const [preview, setPreview] = useState<PreviewKey>('device');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const previewWidth =
    PREVIEW_WIDTHS.find((p) => p.key === preview)?.width ?? layout.maxContentWidth;

  return (
    <ScreenContainer maxWidth={previewWidth}>
      <View style={styles.header}>
        <IconButton
          icon="close"
          accessibilityLabel="Close showcase"
          onPress={() => router.back()}
        />
        <View style={styles.headerText}>
          <AppText variant="title" accessibilityRole="header">
            Design system
          </AppText>
          <AppText variant="caption" color="textMuted">
            Window {Math.round(width)}dp · {isWide ? 'wide' : 'compact'} layout · reduced motion{' '}
            {reducedMotion ? 'on' : 'off'} · reduce transparency {reduceTransparency ? 'on' : 'off'}
          </AppText>
        </View>
      </View>

      <View
        style={styles.segment}
        accessibilityRole="radiogroup"
        accessibilityLabel="Preview width"
      >
        {PREVIEW_WIDTHS.map((option) => {
          const selected = option.key === preview;
          return (
            <Pressable
              key={option.key}
              onPress={() => setPreview(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.segmentItem, selected && styles.segmentSelected]}
            >
              <AppText variant="label" color={selected ? 'textOnAccent' : 'textSecondary'}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Colour" />
      <View style={styles.swatches}>
        {SWATCHES.map(({ name: token }) => (
          <View key={token} style={styles.swatch}>
            <View style={[styles.swatchColor, { backgroundColor: colors[token] }]} />
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {token}
            </AppText>
          </View>
        ))}
      </View>

      <SectionHeader title="Typography" />
      <SurfaceCard>
        {TYPE_STYLES.map((variant) => (
          <AppText key={variant} variant={variant} numberOfLines={1}>
            {variant} · {typography[variant].fontSize}/{typography[variant].lineHeight}
          </AppText>
        ))}
      </SurfaceCard>

      <SectionHeader title="Surfaces" />
      <GlassCard>
        <AppText variant="headline">GlassCard</AppText>
        <AppText variant="bodySmall" color="textMuted">
          Blur on iOS. Opaque fallback on Android and with Reduce Transparency.
        </AppText>
      </GlassCard>
      <SurfaceCard>
        <AppText variant="headline">SurfaceCard</AppText>
        <AppText variant="bodySmall" color="textMuted">
          Opaque. For forms, lists and dense content.
        </AppText>
      </SurfaceCard>

      <SectionHeader title="Buttons" />
      <View style={styles.wrapRow}>
        <PrimaryButton
          label={loading ? 'Saving' : 'Save'}
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1200);
          }}
        />
        <SecondaryButton label="Cancel" onPress={() => {}} />
        <DangerButton label="Remove" onPress={() => {}} />
      </View>
      <View style={styles.wrapRow}>
        <PrimaryButton label="Disabled" onPress={() => {}} disabled />
        <SecondaryButton label="Disabled" onPress={() => {}} disabled />
      </View>
      <PrimaryButton
        label="Full width"
        fullWidth
        onPress={() => {}}
        icon={<Icon name="plus" size={16} color={colors.textOnAccent} />}
      />
      <View style={styles.wrapRow}>
        <IconButton icon="plus" accessibilityLabel="Add" onPress={() => {}} />
        <IconButton icon="search" accessibilityLabel="Search" onPress={() => {}} />
        <IconButton icon="check" accessibilityLabel="Confirm" variant="plain" onPress={() => {}} />
        <IconButton icon="close" accessibilityLabel="Close" size="sm" onPress={() => {}} />
        <IconButton icon="info" accessibilityLabel="Info" disabled onPress={() => {}} />
      </View>

      <SectionHeader title="Inputs" />
      <TextField
        label="Full name"
        placeholder="e.g. Asha Rao"
        value={name}
        onChangeText={setName}
        helperText="Synthetic names only during development."
      />
      <TextField
        label="Registration number"
        value="HOS-"
        onChangeText={() => {}}
        errorText="Enter the full registration number."
      />
      <TextField label="Disabled field" value="Read only" onChangeText={() => {}} disabled />
      <SearchField label="Search patients" value={search} onChangeText={setSearch} />

      <SectionHeader title="Status chips" />
      <View style={styles.wrapRow}>
        {TONES.map((tone) => (
          <StatusChip key={tone} label={tone} tone={tone} />
        ))}
      </View>

      <SectionHeader title="Metrics" />
      <View style={styles.wrapRow}>
        <MetricCard
          label="Beds available"
          value="32"
          caption="of 120"
          tone="success"
          style={styles.metric}
        />
        <MetricCard
          label="Wait time"
          value="18m"
          caption="+4m vs avg"
          tone="warning"
          style={styles.metric}
        />
        <MetricCard
          label="Discharges"
          value="9"
          caption="today"
          tone="secondary"
          style={styles.metric}
        />
      </View>

      <SectionHeader
        title="List rows and avatars"
        action={{ label: 'View all', onPress: () => {} }}
      />
      <SurfaceCard padding="none">
        <ListRow
          title="Synthetic Patient A"
          subtitle="OPD · 10:30"
          leading={<Avatar name="Synthetic Patient A" />}
          trailing={<StatusChip label="Checked in" tone="success" />}
          onPress={() => {}}
          accessibilityHint="Opens the demo record"
        />
        <View style={styles.divider}>
          <ListRow
            title="Synthetic Patient B"
            subtitle="Lab · awaiting sample"
            leading={<Avatar name="Synthetic Patient B" />}
            trailing={<StatusChip label="Waiting" tone="warning" />}
          />
        </View>
      </SurfaceCard>
      <View style={styles.wrapRow}>
        <Avatar name="Demo User" size="sm" />
        <Avatar name="Demo User" size="md" />
        <Avatar name="Demo User" size="lg" />
      </View>

      <SectionHeader title="States" />
      <SurfaceCard>
        <LoadingSkeleton rows={3} accessibilityLabel="Loading demo list" />
      </SurfaceCard>
      <SurfaceCard padding="none">
        <EmptyState
          title="No appointments"
          message="Appointments booked for today will appear here."
          action={{ label: 'Refresh', onPress: () => {} }}
        />
      </SurfaceCard>
      <SurfaceCard padding="none">
        <ErrorState onRetry={() => {}} />
      </SurfaceCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xxs },
  segment: {
    flexDirection: 'row',
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  segmentItem: {
    flex: 1,
    minHeight: layout.minTouchTarget - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  segmentSelected: { backgroundColor: colors.primary },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: { width: layout.swatchSize, gap: spacing.xs },
  swatchColor: {
    height: layout.swatchSize,
    borderRadius: radius.sm,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  metric: { flexGrow: 1, flexBasis: layout.metricMinWidth },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.border },
});
