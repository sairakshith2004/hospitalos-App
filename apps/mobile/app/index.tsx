import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../src/components/GlassCard';
import { colors, radius, spacing } from '../src/theme/tokens';

const metrics = [
  { label: 'Appointments', value: '128', change: '+12 today', color: colors.primary },
  { label: 'Admitted patients', value: '46', change: '8 in ICU', color: colors.secondary },
  { label: 'Pending bills', value: '₹2.4L', change: '18 invoices', color: colors.warning },
];

const tasks = [
  { title: 'Review appointment schedule', detail: 'Reception · 12 upcoming', tag: 'Today' },
  { title: 'Pharmacy stock review', detail: 'Inventory · 4 low-stock items', tag: 'Attention' },
  { title: 'Laboratory results', detail: 'Lab · 7 reports pending', tag: 'Pending' },
];

export default function DashboardScreen() {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#142B49', colors.background, '#0B1220']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>THURSDAY, 05 NOVEMBER</Text>
            <Text style={styles.heading}>Good morning</Text>
            <Text style={styles.subheading}>Hospital overview</Text>
          </View>
          <Pressable style={styles.avatar} accessibilityRole="button" accessibilityLabel="Open profile">
            <Text style={styles.avatarText}>SA</Text>
          </Pressable>
        </View>

        <GlassCard style={styles.hero}>
          <Text style={styles.eyebrow}>HOSPITALOS OVERVIEW</Text>
          <Text style={styles.heroTitle}>Your hospital,{'\n'}in one view.</Text>
          <Text style={styles.heroCopy}>A clear picture of today's operations and priorities.</Text>
          <View style={styles.heroFooter}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>All systems operational · Demo data</Text>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <Text style={styles.muted}>Today</Text>
        </View>
        <View style={styles.metrics}>
          {metrics.map((item) => (
            <GlassCard key={item.label} style={styles.metricCard}>
              <View style={[styles.metricMark, { backgroundColor: item.color }]} />
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <Text style={styles.metricChange}>{item.change}</Text>
            </GlassCard>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Priority tasks</Text>
          <Text style={styles.link}>View all</Text>
        </View>
        {tasks.map((task, index) => (
          <GlassCard key={task.title} style={styles.taskCard}>
            <View style={styles.taskRow}>
              <View style={styles.taskNumber}>
                <Text style={styles.taskNumberText}>0{index + 1}</Text>
              </View>
              <View style={styles.taskBody}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDetail}>{task.detail}</Text>
              </View>
              <Text style={styles.taskTag}>{task.tag}</Text>
            </View>
          </GlassCard>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick access</Text>
        </View>
        <View style={styles.quickGrid}>
          {['Patients', 'Appointments', 'Pharmacy', 'Laboratory'].map((label, index) => (
            <Pressable key={label} style={styles.quickItem} accessibilityRole="button">
              <View style={styles.quickIcon}>
                <Text style={styles.quickIconText}>{['P', 'A', 'Rx', 'L'][index]}</Text>
              </View>
              <Text style={styles.quickLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.footer}>HOSPITALOS MOBILE · DESIGN PROTOTYPE</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 62, paddingBottom: 40, gap: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: 7 },
  subheading: { color: colors.textMuted, fontSize: 14, marginTop: 3 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#244568', borderWidth: 1, borderColor: '#4C789E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontWeight: '700' },
  hero: { marginTop: 6 },
  heroTitle: { color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: '700', marginTop: 13 },
  heroCopy: { color: '#C1CDDC', fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 260 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 22, gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  statusText: { color: '#B6C5D6', fontSize: 11 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, minWidth: 0 },
  metricMark: { width: 18, height: 3, borderRadius: 2, marginBottom: 13 },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  metricLabel: { color: '#C1CDDC', fontSize: 11, marginTop: 5 },
  metricChange: { color: colors.textMuted, fontSize: 10, marginTop: 8 },
  taskCard: { marginTop: -7 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  taskNumber: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#223A56', alignItems: 'center', justifyContent: 'center' },
  taskNumberText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  taskBody: { flex: 1 },
  taskTitle: { color: colors.text, fontSize: 12, fontWeight: '600' },
  taskDetail: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  taskTag: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: { width: '48%', flexGrow: 1, backgroundColor: 'rgba(21,34,56,0.65)', borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 10 },
  quickIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#203C5A', alignItems: 'center', justifyContent: 'center' },
  quickIconText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  quickLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  footer: { color: '#64748B', fontSize: 9, textAlign: 'center', letterSpacing: 1.5, marginTop: 10 },
});
