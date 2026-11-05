import type { Tone } from '@/theme/tokens';

// Synthetic placeholder values for the design prototype. Not real hospital data.

type DemoMetric = { label: string; value: string; change: string; tone: Tone };
type DemoTask = { title: string; detail: string; tag: string; tone: Tone };

export const demoMetrics: readonly DemoMetric[] = [
  { label: 'Appointments', value: '128', change: '+12 today', tone: 'primary' },
  { label: 'Admitted patients', value: '46', change: '8 in ICU', tone: 'secondary' },
  { label: 'Pending bills', value: '₹2.4L', change: '18 invoices', tone: 'warning' },
];

export const demoTasks: readonly DemoTask[] = [
  {
    title: 'Review appointment schedule',
    detail: 'Reception · 12 upcoming',
    tag: 'Today',
    tone: 'primary',
  },
  {
    title: 'Pharmacy stock review',
    detail: 'Inventory · 4 low-stock items',
    tag: 'Attention',
    tone: 'warning',
  },
  {
    title: 'Laboratory results',
    detail: 'Lab · 7 reports pending',
    tag: 'Pending',
    tone: 'neutral',
  },
];
